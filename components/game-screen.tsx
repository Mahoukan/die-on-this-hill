'use client';

import Link from 'next/link';
import { useGame } from './game-provider';
import { DebateScreen } from './debate-screen';
import { DevStatus, GameNotice, Header } from './game-common';
import { Home } from './home';
import { Lobby } from './lobby';
import { ResultsScreen } from './results-screen';
import { RevealScreen } from './reveal-screen';
import { SubmissionScreen } from './submission-screen';
import { VoteScreen } from './vote-screen';

export function GameScreen({ roomCode }: { roomCode: string }) {
  const game = useGame();
  const room = game.room;
  if (game.restoring && !room) return <div className="page game-page"><Header /><main className="status-shell game-panel"><h1 className="question">Returning to your hill...</h1><p className="stage-copy" role="status">Restoring your player and the current round.</p><GameNotice /></main></div>;
  if (!game.session) return <Home initialCode={roomCode} />;
  if (game.session.roomCode !== roomCode) return <div className="page game-page"><Header /><main className="status-shell game-panel"><h1 className="question">You’re already in a game.</h1><p className="stage-copy">Return to room {game.session.roomCode}, or leave it from the home page before joining {roomCode}.</p><Link className="btn btn-primary" href={`/game/${game.session.roomCode}`}>RETURN TO YOUR GAME →</Link></main></div>;
  if (!room) return <div className="page game-page"><Header /><GameNotice /><p className="phase-note">Connecting to room {roomCode}...</p></div>;
  if (room.phase === 'lobby') return <><Lobby room={room} /><DevStatus room={room} /></>;
  const page = room.phase === 'reveal' && room.revealStep === 'bluffs' ? 'bluff-results' : room.phase;
  const note = { answer: 'Know it. Fake it. Defend it.', bluff: 'A little plausible nonsense.', debate: 'Convincing your friends isn’t.', vote: 'Pick your hill.', reveal: 'No more changing your mind.', results: 'Still standing?' }[room.phase];
  return <div className={`page game-page page-${page}`}><Header note={note} /><GameNotice />
    {(room.phase === 'answer' || room.phase === 'bluff') && <SubmissionScreen key={`${room.round}-${room.phase}`} room={room} />}
    {room.phase === 'debate' && <DebateScreen room={room} />}
    {room.phase === 'vote' && <VoteScreen key={room.round} room={room} />}
    {room.phase === 'reveal' && <RevealScreen room={room} />}
    {room.phase === 'results' && <ResultsScreen room={room} />}
    <footer className={`prototype-footer${['debate', 'reveal'].includes(room.phase) ? ' live-footer-wide' : ''}`}><span>Room {room.roomCode}</span><span>{game.connected ? 'Connected' : 'Reconnecting...'}</span></footer>
    <DevStatus room={room} />
  </div>;
}
