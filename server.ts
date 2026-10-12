import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';
import { RoomStore } from './server/rooms';
import { attachGameSockets, broadcastRoom, displayChannel, type GameServer } from './server/socket';
import { PackAdminAuth } from './server/pack-admin';

async function main() {
  const dev = !process.argv.includes('--production');
  const hostname = process.env.HOST || '0.0.0.0';
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('PORT must be an integer between 1 and 65535.');
  const adminPassword = process.env.PACK_ADMIN_PASSWORD?.trim();
  if (!dev && !adminPassword) throw new Error('PACK_ADMIN_PASSWORD is required in production.');
  if (dev && !adminPassword) console.warn('Custom pack administration is disabled. Set PACK_ADMIN_PASSWORD to enable it.');
  const packAdmin = new PackAdminAuth(adminPassword, !dev);
  const app = next({ dev, hostname, port, webpack: true });
  await app.prepare();
  const handler = app.getRequestHandler();
  const httpServer = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'SAMEORIGIN');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    try {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      if (request.method === 'GET' && pathname === '/api/health') {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.writeHead(200);
        response.end('{"status":"ok"}');
        return;
      }
      if (await packAdmin.handle(request, response)) return;
      await handler(request, response);
    } catch (error: unknown) {
      console.error('HTTP request failed:', error instanceof Error ? error.message : 'Unknown error');
      if (!response.headersSent) response.writeHead(500);
      response.end('Server error');
    }
  });
  const io: GameServer = new Server(httpServer, {
    maxHttpBufferSize: 2_200_000,
    // Keep browser connections on the same origin; LAN addresses work without
    // a permissive CORS wildcard. Non-browser test clients may omit Origin.
    allowRequest(request, callback) {
      const origin = request.headers.origin;
      try { callback(null, !origin || new URL(origin).host === request.headers.host); }
      catch { callback(null, false); }
    },
  });
  const rooms = new RoomStore((code) => broadcastRoom(io, rooms, code), {}, (code) => io.to(displayChannel(code)).emit('display:closed'));
  attachGameSockets(io, rooms, packAdmin);
  httpServer.listen(port, hostname, () => console.log(`Die on This Hill: http://localhost:${port} (${dev ? 'development' : 'production'}), listening on ${hostname}`));
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}. Shutting down.`);
    const forced = setTimeout(() => {
      console.error('Graceful shutdown timed out.');
      httpServer.closeAllConnections();
      process.exit(1);
    }, 10_000);
    forced.unref();
    rooms.close();
    const httpClosed = new Promise<void>((resolve) => httpServer.close(() => resolve()));
    const socketsClosed = new Promise<void>((resolve) => io.close(() => resolve()));
    await Promise.allSettled([httpClosed, socketsClosed, app.close()]);
    clearTimeout(forced);
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => { console.error('Server startup failed:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1; });
