import { CryptoService } from '../services/crypto.js';
import { JWTService } from '../services/jwt.js';

export class AuthHandler {
  constructor(db) {
    this.db = db;
    this.crypto = new CryptoService();
    this.jwt = new JWTService();
  }

  async register(username, password) {
    if (!username || !password || username.length < 3 || password.length < 6) {
      return { error: 'Invalid username or password', status: 400 };
    }
    const existing = await this.db.prepare('SELECT 1 FROM users WHERE username = ?').bind(username).first();
    if (existing) {
      return { error: 'Username already exists', status: 409 };
    }
    const id = crypto.randomUUID();
    const passwordHash = await this.crypto.hashPassword(password);
    await this.db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').bind(id, username, passwordHash, Date.now()).run();
    const token = await this.jwt.generate(id);
    return { data: { token, user_id: id, username } };
  }

  async login(username, password) {
    if (!username || !password) {
      return { error: 'Invalid credentials', status: 400 };
    }
    const user = await this.db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
    if (!user || !await this.crypto.verifyPassword(password, user.password_hash)) {
      return { error: 'Invalid credentials', status: 401 };
    }
    const token = await this.jwt.generate(user.id);
    return { data: { token, user_id: user.id, username: user.username } };
  }

  async getUserId(authHeader) {
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    return await this.jwt.verify(token);
  }
}
