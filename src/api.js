import { AuthHandler } from './handlers/auth.js';
import { InboxHandler } from './handlers/inbox.js';
import { MailHandler } from './handlers/mail.js';
import { StatsHandler } from './handlers/stats.js';
import { getHtmlTemplate } from './html.js';

export class ApiHandler {
  constructor(env) {
    this.db = env.DB;
    this.domains = (env.DOMAINS || env.DOMAIN || '').split(',').map(d => d.trim()).filter(Boolean);
    this.ttl = parseInt(env.MAIL_TTL) * 1000;
    this.adminToken = env.ADMIN_TOKEN || null;
    this.auth = new AuthHandler(this.db);
    this.inbox = new InboxHandler(this.db, this.domains, this.ttl);
    this.mail = new MailHandler(this.db);
    this.stats = new StatsHandler(this.db);
  }

  async handle(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return this.cors(new Response(null, { status: 204 }));
    }

    try {
      // 首页
      if (path === '/' && method === 'GET') {
        return this.html();
      }

      // 认证 API（无需 token）
      if (path === '/api/auth/register' && method === 'POST') {
        return this.handleAuth(request, 'register');
      }
      if (path === '/api/auth/login' && method === 'POST') {
        return this.handleAuth(request, 'login');
      }

      // Token 管理 API（需要 Admin Token）
      if (path === '/api/tokens') {
        return this.handleTokens(request, method);
      }
      if (path.startsWith('/api/tokens/') && method === 'DELETE') {
        return this.handleTokenDelete(request, path);
      }

      // 需要认证的 API
      if (path.startsWith('/api/') && this.adminToken && !path.startsWith('/api/auth/')) {
        if (!await this.checkAuth(request)) {
          return this.cors(this.json({ error: 'Invalid or missing API token' }, 401));
        }
      }

      // 域名列表
      if (path === '/api/domains' && method === 'GET') {
        return this.cors(this.json({ domains: this.domains }));
      }

      // 全局统计
      if (path === '/api/stats' && method === 'GET') {
        const result = await this.stats.getGlobal();
        return this.cors(this.json(result.data));
      }

      // 创建邮箱
      if (path === '/api/inbox' && method === 'POST') {
        return this.handleInboxCreate(request);
      }

      // 邮箱相关路由
      if (path.startsWith('/api/inbox/')) {
        return this.handleInboxRoutes(request, url, path, method);
      }

      // 邮件相关路由
      if (path.startsWith('/api/mail/')) {
        return this.handleMailRoutes(request, url, path, method);
      }

      return this.cors(this.json({ error: 'Not found' }, 404));
    } catch (e) {
      console.error(e);
      return this.cors(this.json({ error: e.message }, 500));
    }
  }

  // === 路由处理器 ===

  async handleAuth(request, action) {
    const body = await request.json().catch(() => ({}));
    const result = action === 'register'
      ? await this.auth.register(body.username, body.password)
      : await this.auth.login(body.username, body.password);
    return this.cors(this.json(result.data || { error: result.error }, result.status || 200));
  }

  async handleTokens(request, method) {
    if (!this.checkAdmin(request)) {
      return this.cors(this.json({ error: 'Unauthorized' }, 401));
    }
    if (method === 'GET') {
      const tokens = await this.db.prepare('SELECT token, name, created_at FROM api_tokens ORDER BY created_at DESC').all();
      return this.cors(this.json({ tokens: tokens.results || [] }));
    }
    if (method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const token = 'mf_' + crypto.randomUUID().replace(/-/g, '');
      await this.db.prepare('INSERT INTO api_tokens (token, name, created_at) VALUES (?, ?, ?)').bind(token, body.name || 'Unnamed', Date.now()).run();
      return this.cors(this.json({ token, name: body.name || 'Unnamed' }));
    }
    return this.cors(this.json({ error: 'Method not allowed' }, 405));
  }

  async handleTokenDelete(request, path) {
    if (!this.checkAdmin(request)) {
      return this.cors(this.json({ error: 'Unauthorized' }, 401));
    }
    const token = path.split('/')[3];
    await this.db.prepare('DELETE FROM api_tokens WHERE token = ?').bind(token).run();
    return this.cors(this.json({ success: true }));
  }

  async handleInboxCreate(request) {
    const body = await request.json().catch(() => ({}));
    const userId = await this.auth.getUserId(request.headers.get('Authorization'));
    const result = await this.inbox.create(body.prefix, body.domain, userId);
    return this.cors(this.json(result.data || { error: result.error }, result.status || 200));
  }

  async handleInboxRoutes(request, url, path, method) {
    const parts = path.split('/');
    const address = decodeURIComponent(parts[3]);
    const action = parts[4];
    const userId = await this.auth.getUserId(request.headers.get('Authorization'));

    // 邮箱统计
    if (action === 'stats' && method === 'GET') {
      const accessKey = url.searchParams.get('key');
      if (!await this.inbox.checkAccess(address, accessKey, userId)) {
        return this.cors(this.json({ error: 'Access denied' }, 403));
      }
      const result = await this.stats.getInbox(address);
      return this.cors(this.json(result.data || { error: result.error }, result.status || 200));
    }

    // 续期
    if (action === 'renew' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!await this.inbox.checkAccess(address, body.key, userId)) {
        return this.cors(this.json({ error: 'Access denied' }, 403));
      }
      const result = await this.inbox.renew(address);
      return this.cors(this.json(result.data || { error: result.error }, result.status || 200));
    }

    // 转发设置
    if (action === 'forward' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!await this.inbox.checkAccess(address, body.key, userId)) {
        return this.cors(this.json({ error: 'Access denied' }, 403));
      }
      const result = await this.inbox.setForward(address, body.forward_to);
      return this.cors(this.json(result.data || { error: result.error }, result.status || 200));
    }

    // 获取邮件列表
    if (!action && method === 'GET') {
      const accessKey = url.searchParams.get('key');
      if (!await this.inbox.checkAccess(address, accessKey, userId)) {
        return this.cors(this.json({ error: 'Access denied' }, 403));
      }
      const result = await this.inbox.getEmails(address);
      return this.cors(this.json(result.data || { error: result.error }, result.status || 200));
    }

    // 删除邮箱
    if (!action && method === 'DELETE') {
      const body = await request.json().catch(() => ({}));
      if (!await this.inbox.checkAccess(address, body.key, userId)) {
        return this.cors(this.json({ error: 'Access denied' }, 403));
      }
      const result = await this.inbox.delete(address);
      return this.cors(this.json(result.data));
    }

    return this.cors(this.json({ error: 'Not found' }, 404));
  }

  async handleMailRoutes(request, url, path, method) {
    const id = path.split('/')[3];
    const userId = await this.auth.getUserId(request.headers.get('Authorization'));

    // 删除邮件
    if (method === 'DELETE') {
      const body = await request.json().catch(() => ({}));
      if (!await this.mail.checkAccess(id, body.key, userId)) {
        return this.cors(this.json({ error: 'Access denied' }, 403));
      }
      const result = await this.mail.delete(id);
      return this.cors(this.json(result.data));
    }

    // 获取邮件
    if (method === 'GET') {
      const accessKey = url.searchParams.get('key');
      if (!await this.mail.checkAccess(id, accessKey, userId)) {
        return this.cors(this.json({ error: 'Access denied' }, 403));
      }
      // 原始格式
      if (url.searchParams.get('format') === 'raw') {
        const result = await this.mail.getRaw(id);
        if (result.error) return this.cors(this.json({ error: result.error }, result.status));
        return this.cors(new Response(result.data, { headers: result.headers }));
      }
      const result = await this.mail.get(id);
      return this.cors(this.json(result.data || { error: result.error }, result.status || 200));
    }

    return this.cors(this.json({ error: 'Not found' }, 404));
  }

  // === 辅助方法 ===

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

  async scheduled(event) {
    await this.stats.cleanup();
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
    return new Response(getHtmlTemplate(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}
