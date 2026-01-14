import { AuthHandler } from './handlers/auth.js';
import { InboxHandler } from './handlers/inbox.js';
import { MailHandler } from './handlers/mail.js';
import { StatsHandler } from './handlers/stats.js';

export class ApiHandler {
  constructor(env) {
    this.db = env.DB;
    this.domains = (env.DOMAINS || env.DOMAIN || '').split(',').map(d => d.trim()).filter(Boolean);
    this.ttl = parseInt(env.MAIL_TTL) * 1000;
    this.adminToken = env.ADMIN_TOKEN || null;

    this.authHandler = new AuthHandler(this.db);
    this.inboxHandler = new InboxHandler(this.db, this.domains, this.ttl);
    this.mailHandler = new MailHandler(this.db);
    this.statsHandler = new StatsHandler(this.db);
  }

  async handle(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return this.cors(new Response(null, { status: 204 }));
    }

    try {
      if (path === '/' && method === 'GET') {
        return this.html();
      }

      if (path === '/api/auth/register' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const result = await this.authHandler.register(body.username, body.password);
        return this.cors(this.handleResult(result));
      }
      if (path === '/api/auth/login' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const result = await this.authHandler.login(body.username, body.password);
        return this.cors(this.handleResult(result));
      }

      if (path === '/api/tokens' && method === 'GET') {
        if (!this.checkAdmin(request)) return this.cors(this.json({ error: 'Unauthorized' }, 401));
        return this.cors(await this.listTokens());
      }
      if (path === '/api/tokens' && method === 'POST') {
        if (!this.checkAdmin(request)) return this.cors(this.json({ error: 'Unauthorized' }, 401));
        const body = await request.json().catch(() => ({}));
        return this.cors(await this.createToken(body.name));
      }
      if (path.startsWith('/api/tokens/') && method === 'DELETE') {
        if (!this.checkAdmin(request)) return this.cors(this.json({ error: 'Unauthorized' }, 401));
        const token = path.split('/')[3];
        return this.cors(await this.deleteToken(token));
      }

      if (path.startsWith('/api/') && this.adminToken && !path.startsWith('/api/auth/')) {
        const authOk = await this.checkAuth(request);
        if (!authOk) return this.cors(this.json({ error: 'Invalid or missing API token' }, 401));
      }

      if (path === '/api/inbox' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const userId = await this.authHandler.getUserId(request.headers.get('Authorization'));
        const result = await this.inboxHandler.create(body.prefix, body.domain, userId);
        return this.cors(this.handleResult(result));
      }

      if (path === '/api/domains' && method === 'GET') {
        return this.cors(this.json({ domains: this.domains }));
      }

      if (path === '/api/stats' && method === 'GET') {
        const result = await this.statsHandler.getGlobal();
        return this.cors(this.handleResult(result));
      }

      if (path.startsWith('/api/inbox/') && path.endsWith('/stats') && method === 'GET') {
        const address = decodeURIComponent(path.split('/')[3]);
        const accessKey = url.searchParams.get('key');
        const userId = await this.authHandler.getUserId(request.headers.get('Authorization'));
        if (!await this.inboxHandler.checkAccess(address, accessKey, userId)) {
          return this.cors(this.json({ error: 'Access denied' }, 403));
        }
        const result = await this.statsHandler.getInbox(address);
        return this.cors(this.handleResult(result));
      }

      if (path.startsWith('/api/inbox/') && path.endsWith('/renew') && method === 'POST') {
        const address = decodeURIComponent(path.split('/')[3]);
        const body = await request.json().catch(() => ({}));
        const userId = await this.authHandler.getUserId(request.headers.get('Authorization'));
        if (!await this.inboxHandler.checkAccess(address, body.key, userId)) {
          return this.cors(this.json({ error: 'Access denied' }, 403));
        }
        const result = await this.inboxHandler.renew(address);
        return this.cors(this.handleResult(result));
      }

      if (path.startsWith('/api/inbox/') && path.endsWith('/forward') && method === 'POST') {
        const address = decodeURIComponent(path.split('/')[3]);
        const body = await request.json().catch(() => ({}));
        const userId = await this.authHandler.getUserId(request.headers.get('Authorization'));
        if (!await this.inboxHandler.checkAccess(address, body.key, userId)) {
          return this.cors(this.json({ error: 'Access denied' }, 403));
        }
        const result = await this.inboxHandler.setForward(address, body.forward_to);
        return this.cors(this.handleResult(result));
      }

      if (path.startsWith('/api/inbox/') && method === 'GET') {
        const address = decodeURIComponent(path.split('/')[3]);
        const accessKey = url.searchParams.get('key');
        const userId = await this.authHandler.getUserId(request.headers.get('Authorization'));
        if (!await this.inboxHandler.checkAccess(address, accessKey, userId)) {
          return this.cors(this.json({ error: 'Access denied' }, 403));
        }
        const result = await this.inboxHandler.getEmails(address);
        return this.cors(this.handleResult(result));
      }

      if (path.startsWith('/api/inbox/') && method === 'DELETE') {
        const address = decodeURIComponent(path.split('/')[3]);
        const body = await request.json().catch(() => ({}));
        const userId = await this.authHandler.getUserId(request.headers.get('Authorization'));
        if (!await this.inboxHandler.checkAccess(address, body.key, userId)) {
          return this.cors(this.json({ error: 'Access denied' }, 403));
        }
        const result = await this.inboxHandler.delete(address);
        return this.cors(this.handleResult(result));
      }

      if (path.startsWith('/api/mail/') && method === 'DELETE') {
        const id = path.split('/')[3];
        const body = await request.json().catch(() => ({}));
        const userId = await this.authHandler.getUserId(request.headers.get('Authorization'));
        if (!await this.mailHandler.checkAccess(id, body.key, userId)) {
          return this.cors(this.json({ error: 'Access denied' }, 403));
        }
        const result = await this.mailHandler.delete(id);
        return this.cors(this.handleResult(result));
      }

      if (path.startsWith('/api/mail/') && method === 'GET') {
        const id = path.split('/')[3];
        const accessKey = url.searchParams.get('key');
        const userId = await this.authHandler.getUserId(request.headers.get('Authorization'));
        if (!await this.mailHandler.checkAccess(id, accessKey, userId)) {
          return this.cors(this.json({ error: 'Access denied' }, 403));
        }
        if (url.searchParams.get('format') === 'raw') {
          const result = await this.mailHandler.getRaw(id);
          if (result.error) return this.cors(this.handleResult(result));
          return this.cors(new Response(result.data, { headers: result.headers }));
        }
        const result = await this.mailHandler.get(id);
        return this.cors(this.handleResult(result));
      }

      return this.cors(this.json({ error: 'Not found' }, 404));
    } catch (e) {
      console.error(e);
      return this.cors(this.json({ error: e.message }, 500));
    }
  }

  handleResult(result) {
    if (result.error) {
      return this.json({ error: result.error }, result.status || 500);
    }
    return this.json(result.data);
  }

  checkAdmin(request) {
    if (!this.adminToken) return true;
    const auth = request.headers.get('Authorization');
    return auth === `Bearer ${this.adminToken}`;
  }

  async checkAuth(request) {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return false;
    const token = auth.slice(7);
    if (this.adminToken && token === this.adminToken) return true;
    const row = await this.db.prepare('SELECT 1 FROM api_tokens WHERE token = ?').bind(token).first();
    return !!row;
  }

  async listTokens() {
    const tokens = await this.db.prepare('SELECT token, name, created_at FROM api_tokens ORDER BY created_at DESC').all();
    return this.json({ tokens: tokens.results || [] });
  }

  async createToken(name) {
    const token = 'mf_' + crypto.randomUUID().replace(/-/g, '');
    await this.db.prepare('INSERT INTO api_tokens (token, name, created_at) VALUES (?, ?, ?)').bind(token, name || 'Unnamed', Date.now()).run();
    return this.json({ token, name: name || 'Unnamed' });
  }

  async deleteToken(token) {
    await this.db.prepare('DELETE FROM api_tokens WHERE token = ?').bind(token).run();
    return this.json({ success: true });
  }

  async scheduled(event) {
    await this.statsHandler.cleanup();
  }

  json(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  cors(response) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
  }

  html() {
    return new Response('Mailfly API', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}
