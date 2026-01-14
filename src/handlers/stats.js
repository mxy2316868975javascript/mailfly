export class StatsHandler {
  constructor(db) {
    this.db = db;
  }

  async getGlobal() {
    const totalInboxes = await this.db.prepare('SELECT COUNT(*) as count FROM inboxes').first();
    const activeInboxes = await this.db.prepare('SELECT COUNT(*) as count FROM inboxes WHERE expires_at > ?').bind(Date.now()).first();
    const totalEmails = await this.db.prepare('SELECT COUNT(*) as count FROM stats').first();
    const todayEmails = await this.db.prepare('SELECT COUNT(*) as count FROM stats WHERE received_at > ?').bind(Date.now() - 86400000).first();
    const topSenders = await this.db.prepare('SELECT from_addr, COUNT(*) as count FROM stats GROUP BY from_addr ORDER BY count DESC LIMIT 5').all();
    const emailsByHour = await this.db.prepare(`SELECT (received_at / 3600000 % 24) as hour, COUNT(*) as count FROM stats WHERE received_at > ? GROUP BY hour ORDER BY hour`).bind(Date.now() - 86400000).all();

    return {
      data: {
        total_inboxes: totalInboxes?.count || 0,
        active_inboxes: activeInboxes?.count || 0,
        total_emails: totalEmails?.count || 0,
        today_emails: todayEmails?.count || 0,
        top_senders: topSenders?.results || [],
        emails_by_hour: emailsByHour?.results || []
      }
    };
  }

  async getInbox(address) {
    const inbox = await this.db.prepare('SELECT * FROM inboxes WHERE address = ?').bind(address).first();
    if (!inbox) return { error: 'Inbox not found', status: 404 };

    const totalEmails = await this.db.prepare('SELECT COUNT(*) as count FROM emails WHERE inbox_address = ?').bind(address).first();
    const topSenders = await this.db.prepare('SELECT from_addr, COUNT(*) as count FROM emails WHERE inbox_address = ? GROUP BY from_addr ORDER BY count DESC LIMIT 5').bind(address).all();

    return {
      data: {
        address,
        total_emails: totalEmails?.count || 0,
        top_senders: topSenders?.results || []
      }
    };
  }

  async cleanup() {
    const now = Date.now();
    await this.db.prepare('DELETE FROM emails WHERE inbox_address IN (SELECT address FROM inboxes WHERE expires_at < ?)').bind(now).run();
    await this.db.prepare('DELETE FROM inboxes WHERE expires_at < ?').bind(now).run();
  }
}
