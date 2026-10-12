'use client';

import type { RoomView } from '../shared/types';
import { RoundStrip, Timer, useRemaining } from './game-common';

export function DebateScreen({ room }: { room: RoomView }) {
  const seconds = useRemaining(room);
  return <main className="game-shell game-shell-wide"><RoundStrip room={room} /><section aria-labelledby="debate-title"><div className="stage-heading"><div><div className="eyebrow">03 / The debate</div><h1 id="debate-title">MAKE YOUR CASE</h1></div><Timer seconds={seconds} label="to debate" /></div><p className="question">{room.question?.text}</p><div className="answer-pool" aria-label="Answers to discuss">{room.answerPool.map((answer) => <article className="answer-card" key={answer.id}><h2>{answer.text}</h2></article>)}</div><p className="phase-note">Argue amongst yourselves. Voting opens when the timer ends.</p></section></main>;
}
