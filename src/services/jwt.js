export class JWTService {
  constructor(secretKey = 'jwt-secret-key') {
    this.secretKey = secretKey;
  }

  async generate(userId) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = { sub: userId, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 * 30 };
    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '');
    const signature = await this.sign(encodedHeader + '.' + encodedPayload);
    return encodedHeader + '.' + encodedPayload + '.' + signature;
  }

  async sign(data) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(this.secretKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }

  async verify(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const signature = await this.sign(parts[0] + '.' + parts[1]);
      if (signature !== parts[2]) return null;
      const payload = JSON.parse(atob(parts[1]));
      if (payload.exp < Math.floor(Date.now() / 1000)) return null;
      return payload.sub;
    } catch {
      return null;
    }
  }
}
