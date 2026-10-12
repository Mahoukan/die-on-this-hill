import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

const COOKIE_NAME = 'doth_pack_admin';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 4096;

class AdminRequestError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of (header ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) cookies.set(name, value);
  }
  return cookies;
}

function passwordMatches(candidate: string, expected: string): boolean {
  const left = createHash('sha256').update(candidate).digest();
  const right = createHash('sha256').update(expected).digest();
  return timingSafeEqual(left, right);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const declared = Number(request.headers['content-length'] ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new AdminRequestError(413, 'Request is too large.');
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += value.length;
    if (total > MAX_BODY_BYTES) throw new AdminRequestError(413, 'Request is too large.');
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new AdminRequestError(400, 'Request must contain valid JSON.'); }
}

export class PackAdminAuth {
  private readonly sessions = new Map<string, number>();

  constructor(private readonly password: string | undefined, private readonly secureCookies: boolean) {}

  get configured(): boolean { return Boolean(this.password); }

  isAuthorized(cookieHeader: string | undefined): boolean {
    const token = parseCookies(cookieHeader).get(COOKIE_NAME);
    if (!token) return false;
    const expiresAt = this.sessions.get(token);
    if (!expiresAt || expiresAt <= Date.now()) { this.sessions.delete(token); return false; }
    return true;
  }

  async handle(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (!pathname.startsWith('/api/pack-admin/')) return false;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    try {
      if (pathname === '/api/pack-admin/session' && request.method === 'GET') {
        this.json(response, 200, { configured: this.configured, authorized: this.isAuthorized(request.headers.cookie) });
        return true;
      }
      if (pathname === '/api/pack-admin/login' && request.method === 'POST') {
        if (!this.password) throw new AdminRequestError(503, 'Custom pack administration is not configured.');
        const body = await readJson(request);
        const candidate = body && typeof body === 'object' ? (body as Record<string, unknown>).password : undefined;
        if (typeof candidate !== 'string' || candidate.length < 1 || candidate.length > 512 || !passwordMatches(candidate, this.password)) {
          await new Promise((resolve) => setTimeout(resolve, 350));
          throw new AdminRequestError(401, 'Incorrect admin password.');
        }
        this.removeExpired();
        const token = randomBytes(32).toString('base64url');
        this.sessions.set(token, Date.now() + SESSION_TTL_MS);
        response.setHeader('Set-Cookie', this.cookie(token, Math.floor(SESSION_TTL_MS / 1000)));
        this.json(response, 200, { authorized: true });
        return true;
      }
      if (pathname === '/api/pack-admin/logout' && request.method === 'POST') {
        const token = parseCookies(request.headers.cookie).get(COOKIE_NAME);
        if (token) this.sessions.delete(token);
        response.setHeader('Set-Cookie', this.cookie('', 0));
        this.json(response, 200, { authorized: false });
        return true;
      }
      this.json(response, 405, { error: 'Method not allowed.' });
      return true;
    } catch (error) {
      const status = error instanceof AdminRequestError ? error.status : 500;
      const message = error instanceof AdminRequestError ? error.message : 'Admin request failed.';
      if (status === 500) console.error('Pack admin request failed:', error instanceof Error ? error.message : 'Unknown error');
      this.json(response, status, { error: message });
      return true;
    }
  }

  private removeExpired(): void {
    const now = Date.now();
    for (const [token, expiresAt] of this.sessions) if (expiresAt <= now) this.sessions.delete(token);
  }

  private cookie(value: string, maxAge: number): string {
    return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${this.secureCookies ? '; Secure' : ''}`;
  }

  private json(response: ServerResponse, status: number, body: object): void {
    response.writeHead(status);
    response.end(JSON.stringify(body));
  }
}
