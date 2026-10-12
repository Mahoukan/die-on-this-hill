'use client';

import type { RoomView } from '../shared/types';
import { useGame } from './game-provider';
import { RoundStrip, Timer, useRemaining } from './game-common';

export function DebateScreen({ room }: { room: RoomView }) {
  const game = useGame();
  const seconds = useRemaining(room);
  const transitioning = room.phase === 'debate-transition';
  const majorityReady = room.debateReadyCount >= room.debateRequiredCount;
  const isHost = room.hostPlayerId === room.me.id;
  return <main className="game-shell game-shell-wide"><RoundStrip room={room} /><section aria-labelledby="debate-title">
    <div className="stage-heading"><div><div className="eyebrow">03 / The debate</div><h1 id="debate-title">{transitioning ? majorityReady ? 'MAJORITY READY' : 'DEBATE ENDED' : 'MAKE YOUR CASE'}</h1></div><Timer seconds={seconds} label={transitioning ? 'until voting' : 'to debate'} /></div>
    <p className="question">{room.question?.text}</p><div className="answer-pool" aria-label="Answers to discuss">{room.answerPool.map((answer) => <article className="answer-card" key={answer.id}><h2>{answer.text}</h2></article>)}</div>
    {transitioning ? <div className="debate-transition" role="status"><strong>VOTING BEGINS...</strong><span>Get ready to choose your final answer.</span></div> : <><p className="phase-note">Argue amongst yourselves. Vote to move on when the room is ready.</p><div className="debate-readiness"><p><strong>{room.debateReadyCount}</strong> / {room.debateRequiredCount} required</p><button className={`btn ${room.me.debateReady ? 'btn-secondary' : 'btn-primary'} btn-large`} disabled={!game.connected || game.restoring || game.pending || seconds === 0} onClick={() => void game.debateReady(!room.me.debateReady)}>{room.me.debateReady ? 'NOT READY — KEEP DEBATING' : 'READY TO VOTE'}</button></div>{isHost && <div className="host-debate-controls"><span className="eyebrow">Host controls</span><button className="btn btn-secondary" disabled={!game.connected || game.restoring || game.pending || seconds === 0} onClick={() => void game.endDebate()}>END DEBATE NOW</button></div>}</>}
  </section></main>;
}
