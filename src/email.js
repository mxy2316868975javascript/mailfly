import PostalMime from 'postal-mime';

export class EmailHandler {
  constructor(env) {
    this.db = env.DB;
  }

  async handle(message) {
    const to = message.to;
    const from = message.from;
    const subject = message.headers.get('subject') || '(无主题)';

    // 检查邮箱是否存在且未过期
    const inbox = await this.db.prepare(
      'SELECT * FROM inboxes WHERE address = ? AND expires_at > ?'
    ).bind(to, Date.now()).first();

    if (!inbox) {
      message.setReject('Mailbox not found or expired');
      return;
    }

    // 转发邮件（必须在读取 raw stream 之前）
    if (inbox.forward_to) {
      try {
        await message.forward(inbox.forward_to);
      } catch (e) {
        console.error('Failed to forward email:', e);
      }
    }

    // 解析邮件内容
    const rawArrayBuffer = await new Response(message.raw).arrayBuffer();
    
    let body = '';
    
    try {
      const parser = new PostalMime();
      const email = await parser.parse(rawArrayBuffer);
      
      if (email.html) {
        body = email.html;
      } else if (email.text) {
        body = `<pre style="white-space: pre-wrap; font-family: sans-serif;">${this.escapeHtml(email.text)}</pre>`;
      } else {
        body = '<i>(无正文内容)</i>';
      }
    } catch (e) {
      console.error('Failed to parse email:', e);
      body = '<i>(邮件解析失败，请查看原始邮件)</i>';
    }

    const id = crypto.randomUUID();
    const rawText = new TextDecoder().decode(rawArrayBuffer);
    const now = Date.now();

    // 使用单个事务存储邮件和统计记录
    await this.db.batch([
      this.db.prepare('INSERT INTO emails (id, inbox_address, from_addr, subject, body, raw, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, to, from, subject, body, rawText, now),
      this.db.prepare('INSERT INTO stats (from_addr, received_at) VALUES (?, ?)').bind(from, now)
    ]);
  }
  
  escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }
}
