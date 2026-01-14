export class MailHandler {
  constructor(db) {
    this.db = db;
  }

  async get(id) {
    const email = await this.db.prepare(
      'SELECT id, inbox_address, from_addr, subject, body, received_at FROM emails WHERE id = ?'
    ).bind(id).first();

    if (!email) {
      return { error: 'Email not found', status: 404 };
    }
    email.code = this.extractCode(email.subject + ' ' + email.body);
    return { data: email };
  }

  async getRaw(id) {
    const email = await this.db.prepare(
      'SELECT raw FROM emails WHERE id = ?'
    ).bind(id).first();

    if (!email) {
      return { error: 'Email not found', status: 404 };
    }

    return {
      raw: true,
      data: email.raw,
      headers: {
        'Content-Type': 'message/rfc822',
        'Content-Disposition': `attachment; filename="${id}.eml"`
      }
    };
  }

  async delete(id) {
    await this.db.prepare('DELETE FROM emails WHERE id = ?').bind(id).run();
    return { data: { success: true } };
  }

  async checkAccess(emailId, accessKey, userId) {
    const email = await this.db.prepare('SELECT inbox_address FROM emails WHERE id = ?').bind(emailId).first();
    if (!email) return false;

    const inbox = await this.db.prepare('SELECT access_key, user_id FROM inboxes WHERE address = ?').bind(email.inbox_address).first();
    if (!inbox) return false;
    if (accessKey && inbox.access_key === accessKey) return true;
    if (userId && inbox.user_id === userId) return true;
    return false;
  }

  extractCode(text) {
    if (!text) return null;
    const plain = text.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
    let m = plain.match(/(?:验证码|code|码|Code|CODE)[^\d]*(\d{6})\b/i);
    if (m) return m[1];
    m = plain.match(/\b(\d{6})\b[^\d]*(?:验证码|code|码)/i);
    if (m) return m[1];
    m = plain.match(/(?:验证码|code|码|Code|CODE)[^\d]*(\d{4,8})\b/i);
    if (m) return m[1];
    m = plain.match(/(?:验证码|code|码|Code|CODE)[^a-zA-Z0-9]*([A-Za-z0-9]{4,8})\b/i);
    if (m) return m[1];
    return null;
  }
}
