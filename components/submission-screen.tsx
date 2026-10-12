'use client';

import { useState, type FormEvent } from 'react';
import type { RoomView } from '../shared/types';
import { useGame } from './game-provider';
import { RoundStrip, Timer, useRemaining } from './game-common';

export function SubmissionScreen({ room }: { room: RoomView }) {
  const game = useGame();
  const isBluff = room.phase === 'bluff';
  const saved = isBluff ? room.me.bluff : room.me.genuineAnswer;
  const [answer, setAnswer] = useState(saved || '');
  const seconds = useRemaining(room);
  const locked = saved !== null;
  const unavailable = locked || game.pending || !game.connected || game.restoring || seconds === 0;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = event.currentTarget.querySelector('input')!;
    if (!answer.trim()) { input.setCustomValidity('Enter an answer before locking it in.'); input.reportValidity(); return; }
    void game.submit(isBluff ? 'bluff' : 'answer', answer.trim());
  };
  return <main className="game-shell">
    <RoundStrip room={room} />
    <section className="game-panel" aria-labelledby="submission-title">
      {isBluff && <><p className="question-small">{room.question?.text}</p><div className="genuine-receipt"><span>YOUR ANSWER:</span><strong>{room.me.genuineAnswer || 'No answer submitted'}</strong></div></>}
      <div className="stage-heading"><div><div className="eyebrow">{isBluff ? '02 / The bluff' : '01 / Genuine answer'}</div>{isBluff ? <h1 id="submission-title">NOW MAKE SOMETHING UP</h1> : <p className="answer-intro">What do you actually think?</p>}</div><Timer seconds={seconds} label={isBluff ? 'to bluff' : 'to answer'} locked={locked} /></div>
      {isBluff ? <p className="stage-copy">Submit a believable wrong answer. If someone falls for it, you score.</p> : <h1 className="question" id="submission-title">{room.question?.text}</h1>}
      <form className="answer-form" onSubmit={submit}><label htmlFor="submission-answer">{isBluff ? 'Your believable wrong answer' : 'Your genuine answer'}</label><input className="answer-input" id="submission-answer" name="answer" type="text" placeholder={isBluff ? 'Try a country that sounds plausible…' : 'I think it’s…'} autoComplete="off" maxLength={80} required aria-describedby="submission-help" disabled={locked} value={saved ?? answer} onChange={(event) => { event.target.setCustomValidity(''); setAnswer(event.target.value); }} /><p className="input-help" id="submission-help">{isBluff ? 'A country with a long coastline or lots of lakes could sound convincing. Keep it short; you’ll make your case out loud.' : 'Trust your gut. Save the convincing for later.'}</p><button className={`btn btn-primary btn-large full-width${locked ? ' is-locked' : ''}`} disabled={unavailable}>{locked ? isBluff ? 'BLUFF LOCKED' : 'ANSWER LOCKED' : game.pending ? 'LOCKING...' : seconds === 0 ? 'TIME’S UP' : isBluff ? 'SUBMIT BLUFF' : 'LOCK IN'}</button></form>
      {locked && <p className="waiting-message" role="status">{isBluff ? 'Bluff locked.' : 'Your answer is locked.'} Waiting for everyone else...</p>}
      <p className="players-status">{isBluff ? room.bluffCount : room.answeredCount} of {room.players.length} players {isBluff ? 'submitted a bluff' : 'answered'}</p>
    </section>
  </main>;
}
