# Die on This Hill

*Trivia is easy. Convincing your friends isn't.*

The multiplayer milestone supports creating/joining a room, a live lobby, one synchronized trivia round, staged reveal, scoring, and restarting from the lobby. The approved static prototype remains intact at the repository root.

## Run locally

Use Node.js 22 or newer and npm:

```sh
npm install
npm run dev
```

Open **http://localhost:3000**. Use `npm.cmd` instead of `npm` if your PowerShell execution policy blocks npm's PowerShell wrapper.

For phones on the same Wi-Fi, open **http://YOUR-COMPUTER-LAN-IP:3000** on each device. The server listens on `0.0.0.0`. Allow the Node process through your local firewall if prompted. Invite links use the browser's current address, so open the host browser using that LAN address before copying an invitation for phones.

Optional PowerShell port override:

```powershell
$env:PORT = '3001'
npm.cmd run dev
```

Production checks and local production server:

```sh
npm run typecheck
npm test
npm run build
npm start
```

`npm start` requires a completed build. Use the supplied custom server scripts; `next dev` and `next start` alone do not attach the game's Socket.IO server.

## Architecture and files

- `app/`: Next.js App Router at `/` and `/game/[roomCode]`; the layout imports the existing prototype CSS directly. `app/multiplayer.css` contains only small additions for connection/errors, name entry, and live score details.
- `components/`: React versions of the prototype markup, split by game phase. `game-provider.tsx` handles the socket lifecycle and acknowledged actions. Existing typography, cards, buttons, colours, spacing, and breakpoints are reused.
- `server.ts`: one long-lived Node HTTP process serving Next.js and Socket.IO on the same port.
- `server/socket.ts`: socket handlers, connection identity, acknowledgements, and per-player broadcasts.
- `server/rooms.ts`: in-memory rooms, validated actions, private submissions, answer pool, phase transitions, server deadlines, reconnect credentials, host handover, and room cleanup.
- `server/scoring.ts`: final-answer and bluff scoring, kept separate from transport and React.
- `shared/types.ts`: explicit internal room types, public/private client projection, and typed socket events.
- `lib/socket.ts`: client socket factory and tab-specific session storage.
- `tests/`: game-rule/privacy/timer tests and an integration test with real Socket.IO clients.
- Added `package.json`, `package-lock.json`, TypeScript/Next.js config, `next-env.d.ts`, and `.gitignore`; updated this README. Original HTML, CSS, JavaScript, and `display.html` remain unchanged as design references.

The server broadcasts an allowlisted `RoomView`, never its internal `GameRoom`. Each player receives only their own genuine answer, bluff, and locked vote. Correctness, contributors, other players' votes, and score deltas are withheld until their reveal step. Hill announcements reveal the player but not their choice.

The server owns all phase transitions. Clients display a countdown from `phaseEndsAt`, adjusted against `serverNow`, and cannot extend or complete a phase. The durations are **30s answer → 30s bluff → 60s debate → 15s vote**. Answer/bluff/vote phases also finish early when every participant locks in. Debate always lasts 60 seconds.

The original prototype does not prevent voting for your own bluff, so the milestone preserves that behavior. The server excludes a player's own vote from that player's bluff rewards.

Rooms exist only in this process. Restarting the server deletes rooms. Empty/disconnected rooms are cleaned up after ten minutes. This architecture requires a persistent Node process, not a static website or a serverless-only deployment. See the [Next.js custom server guide](https://nextjs.org/docs/app/guides/custom-server).

## Manual test: three browser windows

Open independently created tabs/windows (or different browsers) at `http://localhost:3000`. Session identity uses `sessionStorage`, so refresh preserves a player while independently opened tabs can be separate players. Duplicating an existing game tab may copy its session; the newest connection takes over that player and the old tab is notified. Use a fresh tab for another player.

1. **Suriya:** Create Game, enter your name, and copy the four-letter room code.
2. **Perry** and **Hunter:** Join with the code and your names. Confirm all three appear in every lobby. Only Suriya has Start Game.
3. Start. Submit genuine answers: Suriya **Canada**, Perry **Sweden**, Hunter **Finland**. Confirm submissions stay private. Try refreshing one browser after submitting; its locked answer and shared timer should return.
4. Submit bluffs: Suriya **Norway**, Perry **Canada**, Hunter **Indonesia**. Confirm one Canada card appears despite the duplicate genuine/bluff entries.
5. Debate for 60 seconds. All browsers show the same shuffled pool with no origins or correct-answer labels. The server moves everyone into voting.
6. Suriya votes **Sweden** with **I WILL DIE ON THIS HILL**; Perry votes **Norway** normally; Hunter votes **Canada** with Hill. Check the confirmation UI, public Hill announcements, private selections, and locked states.
7. Suriya advances the reveal: **Show the Votes → Reveal the Answer → Who Fooled Who? → See Round Results**. Each step updates all devices together.
8. Expected totals: **Suriya +300** (+200 final answer, +100 bluff), **Perry +50** (-50 final answer, +100 bluff), **Hunter -100** (wrong Hill). Verify the successful/failed Hill badges and separate bluff breakdown.
9. Host selects **Back to Lobby**. Everyone returns; scores, submissions, and Hill usage reset. Start again to test timeouts, missed submissions/votes, duplicate bluffs, and disconnects.

## Rules and edge cases

- One hard-coded question: **Which country has the most islands in the world?** Correct answer: **Sweden**. A minimum of two connected players is needed; rooms allow up to twelve.
- Names are trimmed, limited to 24 characters, and unique within a room. Codes contain four uppercase letters, excluding I and O.
- Answer comparison trims whitespace and ignores letter case. Visible duplicates merge while all genuine/bluff contributors remain recorded internally. The pool order is shuffled once on the server and shared by everyone.
- Normal final vote: correct **+100**, wrong **-50**. Hill makes these **+200/-100**. Bluff rewards are never doubled; negative scores remain valid.
- Each duplicate bluff author earns **+100 per other voter** who chooses that false answer, independently. Genuine guesses never earn bluff points. A bluff that matches Sweden is silently accepted and merged with the correct answer, but earns no bluff points because its voters were not fooled.
- A missed genuine answer or bluff remains absent; drafts are not submitted on timeout. A missed final vote earns **0**, not a wrong-answer penalty. A Hill confirmation that expires is not accepted and does not spend the ability.
- Locked submissions/votes cannot be changed. Identical retries are idempotent while their phase remains open. Invalid, late, non-host, and forged actions are rejected by the server.
- Refresh/reconnect uses a generated player ID and a private random reconnect token. Public player IDs alone cannot reclaim another player's session. Score, submissions, locked vote, and Hill usage are retained while the room exists.
- Disconnected players are marked immediately and remain participants for the current round, which continues on server timers. The host has ten seconds to refresh; if still absent, a connected player becomes host. Explicitly leaving hands over host controls immediately. Offline lobby players are omitted when the next game starts.
- The host drives synchronized reveal steps. Guests wait; there are no phase-skip, timer, question, score, or admin controls.
- Back to Lobby starts a fresh one-round game, resetting totals and Hill usage. There are no multiple questions, full-game awards, accounts, database, casting, or cross-game persistence in this milestone.
- Development-only console logs show room code, local player ID, socket connection, phase, and phase deadline. `DevStatus` in `components/game-common.tsx` can be removed independently.

## Static design reference

Open `index.html` directly in a browser to explore the original independent prototype:

`index.html` → `lobby.html` → `answer.html` → `bluff.html` → `debate.html` → `vote.html` → `reveal.html` → `bluff-results.html` → `results.html` → `final-results.html`

`display.html` remains the optional TV design reference. These static pages still use their original local prototype interactions and scripted data; they do not connect to the multiplayer server.
