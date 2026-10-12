# Die on This Hill

Trivia is easy. Convincing your friends isn't.

## What it is

Die on This Hill is a browser-based multiplayer trivia party game. Players answer privately, invent believable alternatives, debate, and vote on the truth. The custom Node server controls game state, timing, answers, votes, scoring, and Socket.IO connections.

## How the game works

1. Answer the trivia question genuinely.
2. Submit a believable wrong answer as a bluff.
3. Debate the combined answer pool.
4. Vote for the answer you believe is correct.
5. Reveal the truth, votes, and bluff owners.
6. Score the round and continue to the final leaderboard.

Once per game, a player can choose I WILL DIE ON THIS HILL to double the stakes of their vote.

## Features

- Multiplayer rooms with reconnect handling and configurable game length
- Single Pack and Mixed Game modes
- Six built-in question packs and persistent custom packs
- Optional read-only Shared Displays
- Majority debate readiness with a host override
- Multi-round scoring, statistics, final rankings, and awards
- Bundled audio, synthesized fallback cues, and reduced-motion support

## Requirements

- Node.js 22 or newer
- npm, using the committed `package-lock.json`
- Docker for container deployment

## Local development

Set `PACK_ADMIN_PASSWORD` in a local ignored environment file to enable custom-pack administration, then run:

```sh
npm install
npm run dev
```

The development server listens on `http://localhost:3000` by default.

## Production without Docker

```sh
npm install
npm run build
npm run start
```

Use `npm run start`, not `next start`. The custom command starts both Next.js and Socket.IO. Production startup fails if `PACK_ADMIN_PASSWORD` is missing.

## Environment

See `.env.example` for safe example values.

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT=3000`
- `CUSTOM_PACKS_DIR=/data/custom-packs`
- `CUSTOM_PACKS_MAX_STORAGE_MB=100`
- `PACK_ADMIN_PASSWORD`: required production secret for `/packs`

Do not commit real passwords or production environment files.

## Docker

The multi-stage image builds with Node.js 22 and runs as the non-root `node` user. It exposes port 3000 and stores custom packs outside the application at `/data/custom-packs`.

```sh
docker build -t die-on-this-hill .
docker run -d \
  --name die-on-this-hill \
  --restart unless-stopped \
  --env-file .env \
  -p 3000:3000 \
  -v die-on-this-hill-packs:/data/custom-packs \
  die-on-this-hill
```

The image healthcheck calls `GET /api/health` every 30 seconds. The endpoint returns `{"status":"ok"}` without reading or changing game state.

For the portable Compose example, replace its example password before starting it:

```sh
docker compose -f docker-compose.example.yml up -d --build
```

## Coolify

1. Connect the GitHub repository and select Dockerfile deployment.
2. Set the internal application port to `3000`. Do not assign container ports 80 or 443.
3. Configure all environment variables listed above with a strong `PACK_ADMIN_PASSWORD`.
4. Mount persistent Coolify storage at `/data/custom-packs`.
5. Ensure Nginx Proxy Manager can reach the Coolify-managed application on port 3000, either through an appropriate Docker network or a host port that is not publicly exposed.
6. Deploy and wait for the container healthcheck to pass.

`CUSTOM_PACKS_MAX_STORAGE_MB` is a runtime, application-level limit on total persistent custom pack JSON storage in `CUSTOM_PACKS_DIR`. It defaults to 100 MB (1 MB = 1,048,576 bytes). To change it in Coolify, set the application's runtime environment variable `CUSTOM_PACKS_MAX_STORAGE_MB` to the desired positive number, save, and redeploy. Missing values use the default; invalid, zero, negative, or out-of-range values log a warning and fall back to 100 MB.

The `/packs` screen shows current usage and the cap. Creates, imports, and growing edits are rejected if they would exceed it. Replacements subtract the existing file size first. Deletion and export remain available, and edits that do not increase storage remain possible if the cap is lowered below current usage. Only regular JSON files directly inside the configured directory count, including invalid JSON files; atomic-write temporary files and subdirectories do not count. This is a persistent pack quota, not a filesystem quota; atomic writes still need temporary disk space. Use one application server process per pack directory.

An empty Docker-managed volume inherits the image directory permissions. For a host bind mount, ensure the mounted directory is writable by the container's `node` user, UID 1000 in the selected base image. Do not use mode 777 as the default fix.

## Nginx Proxy Manager

Create a proxy host such as `game.example.com` with:

- Scheme: `http`
- Forward hostname or IP: the address that reaches the Coolify application
- Forward port: `3000`
- WebSocket support: enabled for Socket.IO
- SSL certificate: configured at Nginx Proxy Manager
- Force SSL: enabled
- HTTP/2: optional

TLS terminates at Nginx Proxy Manager. The application uses plain HTTP on the trusted internal network and needs no separate WebSocket port. Preserve the public `Host` header so same-origin Socket.IO checks succeed. Security headers already come from the application; avoid adding conflicting duplicates at the proxy.

## Custom pack administration

Gameplay, room creation, joining, and Shared Displays remain passwordless. Visiting `/packs` requires the server-side `PACK_ADMIN_PASSWORD`.

A successful unlock creates a random 12-hour server session and an HttpOnly, SameSite=Strict cookie. Production cookies are Secure and therefore require HTTPS. The password is not stored in browser storage or included in client JavaScript. Pack listing, creation, editing, import, export, and deletion are all authorized again by the server. Lock Admin ends the server session and clears the cookie.

If `PACK_ADMIN_PASSWORD` is missing, production startup fails. Development mode stays available, but pack administration is disabled.

## Question packs

Built-in packs are read-only source data under `server/questions/`. Custom packs are JSON files in `CUSTOM_PACKS_DIR`. Use the validated `/packs` import interface instead of manually creating files.

Normal players receive only the safe pack metadata needed for lobby selection. They do not need admin access to select or play custom packs.

## Shared Display

Open `/display/ROOMCODE`, replacing `ROOMCODE` with the four-letter room code. Any player can open or copy this read-only link. Displays do not join as players, submit actions, affect readiness, or receive private answer data before reveal.

## Persistence and restarts

Active rooms, sessions, and scores exist only in server memory. Container replacement or restart ends active games, and players must create or join a new room. Custom packs survive rebuilds and redeployments only when persistent storage is mounted at `/data/custom-packs`.

## Backup

Custom packs are the only persistent application data that currently requires backup. Temporarily prevent pack editing, then archive the mounted directory from its host or volume backup location:

```sh
tar -C /path/to/custom-packs -czf die-on-this-hill-custom-packs.tar.gz .
```

Store the archive somewhere separate from the application server.

## Restore

1. Stop the application or otherwise prevent pack editing.
2. Inspect the archive contents before extraction.
3. Back up or move aside any existing JSON files that must not be overwritten.
4. Extract the archive into the persistent custom-pack directory.
5. Confirm the directory and files are readable and writable by the container user.
6. Start or restart the application and verify the packs through `/packs`.

## Upgrade

1. Push the new version to the GitHub repository.
2. Let Coolify detect the change or start a deployment manually.
3. Coolify builds the new Docker image and replaces the container.
4. Verify the healthcheck and application logs.
5. Confirm custom packs remain available from the mounted `/data/custom-packs` storage.

Container replacement interrupts active games. The persistent pack volume is not part of the image and should remain attached across deployments.

## Audio

Bundled audio is under `public/audio/`. Sound preferences are local to each browser. Maintainers must confirm appropriate production rights for every bundled audio asset; this repository does not assert an asset license.

## Testing

### PWA installation

The app has a standalone manifest at `/manifest.webmanifest`, Apple Add to Home Screen metadata, and icons resized without cropping from `public/hill.jpg`: `public/icons/icon-192.png`, `public/icons/icon-512.png`, and `public/icons/apple-touch-icon.png` (180 x 180). The PNGs preserve the opaque JPEG artwork. No PWA dependency is required.

Service-worker registration runs only in production on a secure origin (HTTPS or localhost). The worker caches only `/offline.html`. A full navigation to `/` always tries the network and shows that notice only if the request fails. It never caches application HTML, RSC responses, room state, `/game/*`, `/display/*`, `/packs`, `/api/*`, or `/socket.io/*`. Static assets use normal browser HTTP caching. Offline gameplay is not supported. Updates wait until open app windows/tabs close; there are no forced reloads. Bump the cache version in `public/sw.js` when changing the offline page or cache policy.

To test locally, run `npm run build`, set the existing `PACK_ADMIN_PASSWORD` environment variable, and run `npm run start`. Open `http://localhost:3000` in Chrome or Edge. Development mode (`npm run dev`) does not register a worker. Use a separate browser profile or unregister the worker in DevTools when switching the same origin back to development.

1. In DevTools, check Application > Manifest for the name, icons, start URL, and standalone mode. Check Application > Service Workers for `/sw.js`, then reload once so it controls the page.
2. Use the browser's Install app action and launch the installed app. Check portrait/landscape layouts and safe areas on a mobile device.
3. After the first online visit, disconnect the device from the network (or stop the local test server) and reload `/`. Only the internet-connection notice should appear. Direct offline visits to game, display, admin, and API routes should fail normally without cached application content. Cache Storage should contain only the offline page.
4. Restore the network and test creating/joining a room with two clients, a Shared Display, reconnecting, and pack administration. Requests to Socket.IO must still use the network.

In production, deploy normally and repeat these checks at `https://hill.arulmozhis.com`. On iPhone/iPad, open the site in Safari and use Share > Add to Home Screen, then launch the home-screen icon. Phone testing needs HTTPS; an HTTP LAN address is not a secure origin. No new Coolify environment variables, volumes, ports, or Docker changes are needed. Keep HTTPS and the existing WebSocket proxy configuration, and let the application serve `/sw.js` with its no-store header instead of adding proxy caching for it.

### Automated checks

```sh
npm test
npm run typecheck
npm run build
```
