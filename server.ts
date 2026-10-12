import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';
import { RoomStore } from './server/rooms';
import { attachGameSockets, broadcastRoom, displayChannel, type GameServer } from './server/socket';

async function main() {
  const dev = !process.argv.includes('--production');
  const hostname = process.env.HOST || '0.0.0.0';
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('PORT must be an integer between 1 and 65535.');
  const app = next({ dev, hostname, port, webpack: true });
  await app.prepare();
  const handler = app.getRequestHandler();
  const httpServer = createServer((request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'SAMEORIGIN');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    handler(request, response).catch((error: unknown) => {
      console.error('HTTP request failed:', error instanceof Error ? error.message : 'Unknown error');
      if (!response.headersSent) response.writeHead(500);
      response.end('Server error');
    });
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
  attachGameSockets(io, rooms);
  httpServer.listen(port, hostname, () => console.log(`Die on This Hill: http://localhost:${port} (${dev ? 'development' : 'production'}), listening on ${hostname}`));
  const shutdown = () => {
    rooms.close();
    io.close();
    httpServer.close();
    void app.close().finally(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((error: unknown) => { console.error('Server startup failed:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1; });
