# Die on This Hill

Trivia is easy. Convincing your friends isn't.

## What it is

Die on This Hill is a browser-based multiplayer trivia party game. Players answer privately, invent believable alternatives, argue their case, and then vote on the truth. The server controls game state, timing, answers, votes, scoring, and room permissions.

## How the game works

1. Answer the trivia question genuinely.
2. Submit a believable wrong answer as a bluff.
3. Debate the combined answer pool with the group.
4. Vote for the answer you believe is correct.
5. Reveal the truth, votes, and bluff owners.
6. Score the round and continue to the final leaderboard.

Once per game, a player can choose I WILL DIE ON THIS HILL to double the stakes of their vote.

## Features

- Multiplayer rooms with reconnect handling and configurable game length
- Single Pack and Mixed Game modes
- Six built-in question packs and persistent custom packs
- Optional read-only Shared Displays for TVs and extra browsers
- Majority debate readiness with a host override
- Multi-round scoring, statistics, final rankings, and awards
- Bundled audio with synthesized fallback cues and per-device sound controls
- Keyboard-friendly controls and reduced-motion support

## Requirements

- Node.js 22 or newer
- npm, using the committed `package-lock.json`

## Local development

```sh
npm install
npm run dev
```

The application listens on `http://localhost:3000` by default. The development command starts the custom server that hosts both Next.js and Socket.IO.

## Production

```sh
npm install
npm run build
npm run start
```

The production start command must be used instead of `next start` because multiplayer connections are attached by the custom Node server in `server.ts`. Run a single application process unless the deployment adds shared room state and a Socket.IO adapter. Put the server behind TLS and a suitable reverse proxy for public internet deployment.

## Environment

Copy `.env.example` to an appropriate local environment file or configure these values in the deployment platform:

- `HOST`: listening interface. Defaults to `0.0.0.0`.
- `PORT`: listening port. Defaults to `3000`.
- `CUSTOM_PACKS_DIR`: optional absolute or project-relative path to persistent custom-pack storage. Defaults to `data/custom-packs/`.

The custom-pack directory must be writable by the application and stored on persistent storage in production.

## Question packs

### Built-in packs

Built-in packs are read-only application source data under `server/questions/`. They are version controlled and validated by the automated tests.

### Custom packs

Custom packs are server-side JSON files stored under `data/custom-packs/` by default. Create or import them through the Custom Packs interface at `/packs`; the Import Pack flow validates the schema, limits, IDs, and duplicate questions.

To back up or migrate custom packs, stop writes to the application and copy the configured custom-pack directory. Custom pack JSON files are intentionally ignored by Git, while `data/custom-packs/.gitkeep` retains the default directory.

## Shared Display

Open `/display/ROOMCODE`, replacing `ROOMCODE` with the four-letter room code. Any player can open or copy this read-only link. Shared Displays do not join as players, submit actions, affect readiness, or receive private answer data before reveal. A TV is optional; everyone can play entirely on their own devices.

## Persistence

Active rooms, sessions, and scores are held in server memory. Restarting the server ends active games. A room with no connected players is removed after ten minutes. Custom packs persist independently in the configured storage directory.

## Audio

Bundled audio is under `public/audio/`. Sound and mute preferences are local to each browser. Synthesized Web Audio cues provide intentional fallbacks for events without selected files.

Before distributing or publicly deploying the application, maintainers must confirm that they hold appropriate production rights for every bundled audio asset. No asset license is asserted by this repository.

## Testing

```sh
npm test
npm run typecheck
npm run build
```
