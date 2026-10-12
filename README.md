# Die on This Hill

*Trivia is easy. Convincing your friends isn't.*

A complete in-memory multiplayer party game built with Next.js, React, TypeScript, Socket.IO, and a custom Node server. Players answer genuine trivia questions, submit bluffs, debate, vote, optionally stake their once-per-game Hill, and compete across a configurable multi-round game. An optional read-only shared display can follow the room on a TV or projector.

## Run locally

Use Node.js 22 or newer:

```sh
npm install
npm run dev
```

Open **http://localhost:3000**. For phones on the same Wi-Fi, use **http://YOUR-COMPUTER-LAN-IP:3000** and allow Node through the local firewall if prompted. The server listens on `0.0.0.0`.

Checks and production:

```sh
npm run typecheck
npm test
npm run build
npm start
```

Use the supplied custom server commands; plain `next dev` or `next start` will not attach Socket.IO.

## Game flow

The host chooses Recommended, 5, 8, 10, or 12 rounds. Recommended resolves from the live lobby population: 2–3 players get 10 rounds, 4–5 get 8, 6–7 get 6, and 8+ get 5. An explicit host choice is retained as players join or leave.

The host selects either one built-in question pack or a Mixed Game containing two or more packs. The six local packs contain 72 questions across General Knowledge, Science & Technology, Geography, History, Movies & TV, and Food & Culture. Every pack supports a 12-round game. Pack selection and availability are synchronized room settings and are retained by Play Again.

At game start, the server gathers only eligible questions, removes duplicate IDs, shuffles the combined pool, selects the exact required number without repeats, and owns the complete sequence. Mixed Game currently samples randomly from the combined pool without category balancing. Every round follows:

```text
Genuine Answer → Bluff → Debate → Vote → Reveal → Round Results
```

During Debate, connected players can toggle Ready to Vote. A strict majority starts a synchronized three-second voting transition; the host can trigger the same transition with End Debate Now. Natural timer expiry still opens voting immediately. The host advances to the next round or, after the final round, to Final Results. Scores, statistics, and Hill usage persist between rounds. Round submissions, answer cards, votes, reveal state, and timers reset. Play Again keeps the room, players, and round setting while resetting the game itself.

Open `/display/ROOM`—for example, `/display/HILL`—for the optional shared display. It has a separate read-only socket subscription, never becomes a player, and automatically follows lobby, gameplay, reveal, results, and Play Again. The host lobby includes Open Shared Display and Copy Display Link controls.

## Rules

- Correct final answer: **+100**; wrong final answer: **-50**.
- Hill doubles only final-answer stakes to **+200/-100** and is usable once per player per game.
- Each other player fooled by a bluff awards its author **+100**. Hill never doubles bluff points.
- Missed final votes score zero. Negative total scores are valid.
- The final leaderboard sorts by score, correct final answers, then successful bluff votes. Players still equal after those criteria share a rank.
- Awards are calculated server-side from game statistics. Zero-value awards are hidden and tied winners share the award.
- Genuine-answer statistics accept deterministic variants configured with each question. Matching ignores case, repeated spaces, and common punctuation; it does not use fuzzy or AI matching.

## Architecture

- `server/rooms.ts`: authoritative room lifecycle, settings, rounds, timers, reconnect state, statistics, and private public-view projection.
- `server/questions/`: six local pack modules plus safe metadata, availability, lookup, and server-side no-repeat selection.
- `server/answer-matching.ts`: deterministic accepted-answer normalization and comparison.
- `server/scoring.ts`: round scoring and Hill impact.
- `server/awards.ts`: final leaderboard and tied award calculations.
- `server/socket.ts`: acknowledged typed Socket.IO actions and per-player broadcasts.
- `shared/types.ts`: internal models, safe client views, and socket contracts.
- `components/`: live React screens based on the approved static prototypes.
- `components/display-screen.tsx`: 16:9 shared-display phase renderer with fullscreen and private Hill announcements.
- `tests/`: rule, privacy, timer, multi-round, awards, reconnect, and real Socket.IO integration coverage.

The server broadcasts an allowlisted `RoomView`, not its internal room model. Lobby clients receive only pack names, descriptions, and real question counts. Private submissions, accepted answers, explanations, votes, correctness, answer origins, score deltas, and statistics are withheld until their appropriate reveal or final-results phase. Optional explanations appear only during the correct-answer reveal step.

Rooms and game history exist only in memory. Restarting the server removes them. New players cannot join after a game starts, but an existing player can reconnect with their private session token and recover the current phase, score, Hill state, statistics, and locked actions.

## Manual multi-browser test

1. Create a room and join it from two more independent browser windows.
2. Select 5 rounds as the host and confirm every lobby shows that setting.
3. Complete round 1 and note each overall score.
4. Start round 2 and confirm scores persist while submissions and answer cards reset.
5. Use Hill in round 2; confirm it shows **USED** and cannot be selected in later rounds.
6. Finish all five rounds and choose **Final Results**.
7. Confirm the shared leaderboard, tied ranks where applicable, awards, and successful-Hill badges.
8. Choose **Play Again** and confirm everyone returns to the same lobby with zero scores, cleared statistics, and Hill restored.
9. Start again and confirm the retained 5-round setting generates a fresh no-repeat question sequence.

The original root-level HTML and CSS files remain unchanged as visual references, including `final-results.html`.
