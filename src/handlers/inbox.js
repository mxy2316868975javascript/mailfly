export class InboxHandler {
  constructor(db, domains, ttl) {
    this.db = db;
    this.domains = domains;
    this.ttl = ttl;
  }

  async create(prefix, domain, userId) {
    const selectedDomain = this.domains.includes(domain) ? domain : this.domains[0];
    let name = prefix ? prefix.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    if (!name || name.length < 3) name = this.randomName();

    let address = `${name}@${selectedDomain}`;
    let exists = await this.db.prepare('SELECT 1 FROM inboxes WHERE address = ?').bind(address).first();

    if (exists) {
        name = `${name}${this.randomName().slice(0, 3)}`;
        address = `${name}@${selectedDomain}`;
    }

    const now = Date.now();
    const accessKey = 'key_' + crypto.randomUUID().replace(/-/g, '');
    await this.db.prepare('INSERT INTO inboxes (address, created_at, expires_at, access_key, user_id) VALUES (?, ?, ?, ?, ?)')
        .bind(address, now, now + this.ttl, accessKey, userId || null).run();

    return { data: { address, expires_at: now + this.ttl, access_key: accessKey } };
  }

  async getEmails(address) {
    const inbox = await this.db.prepare(
      'SELECT * FROM inboxes WHERE address = ? AND expires_at > ?'
    ).bind(address, Date.now()).first();

    if (!inbox) {
      return { error: 'Inbox not found or expired', status: 404 };
    }

    const emails = await this.db.prepare(
      'SELECT id, from_addr, subject, received_at FROM emails WHERE inbox_address = ? ORDER BY received_at DESC'
    ).bind(address).all();

    return { data: { address, expires_at: inbox.expires_at, forward_to: inbox.forward_to || null, emails: emails.results } };
  }

  async renew(address) {
    const inbox = await this.db.prepare(
      'SELECT * FROM inboxes WHERE address = ?'
    ).bind(address).first();

    if (!inbox) {
      return { error: 'Inbox not found', status: 404 };
    }

    const newExpiry = Date.now() + this.ttl;
    await this.db.prepare('UPDATE inboxes SET expires_at = ? WHERE address = ?')
      .bind(newExpiry, address).run();

    return { data: { address, expires_at: newExpiry } };
  }

  async setForward(address, forwardTo) {
    const inbox = await this.db.prepare(
      'SELECT * FROM inboxes WHERE address = ?'
    ).bind(address).first();

    if (!inbox) {
      return { error: 'Inbox not found', status: 404 };
    }

    await this.db.prepare('UPDATE inboxes SET forward_to = ? WHERE address = ?')
      .bind(forwardTo || null, address).run();

    return { data: { address, forward_to: forwardTo || null } };
  }

  async delete(address) {
    await this.db.batch([
        this.db.prepare('DELETE FROM emails WHERE inbox_address = ?').bind(address),
        this.db.prepare('DELETE FROM inboxes WHERE address = ?').bind(address)
    ]);
    return { data: { success: true } };
  }

  async checkAccess(address, accessKey, userId) {
    const inbox = await this.db.prepare('SELECT access_key, user_id FROM inboxes WHERE address = ?').bind(address).first();
    if (!inbox) return false;
    if (accessKey && inbox.access_key === accessKey) return true;
    if (userId && inbox.user_id === userId) return true;
    return false;
  }

  randomName() {
    const adjs = [
      'cool', 'super', 'best', 'fast', 'blue', 'red', 'green', 'gold', 'silver', 'iron',
      'happy', 'smart', 'swift', 'wild', 'calm', 'brave', 'neon', 'cyber', 'retro', 'pro',
      'sky', 'star', 'moon', 'sun', 'cloud', 'rain', 'snow', 'wind', 'fire', 'ice'
    ];
    const nouns = [
      'panda', 'tiger', 'lion', 'eagle', 'wolf', 'bear', 'fox', 'hawk', 'owl', 'cat',
      'dog', 'bird', 'fish', 'shark', 'whale', 'duck', 'goose', 'swan', 'deer', 'elk',
      'coder', 'dev', 'user', 'guest', 'admin', 'tester', 'runner', 'player', 'winner', 'hero',
      'smith', 'jones', 'bond', 'doe', 'black', 'white', 'brown', 'green', 'scott', 'king'
    ];

    const adj = adjs[Math.floor(Math.random() * adjs.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 1000);

    return `${adj}${noun}${num}`;
  }
}
