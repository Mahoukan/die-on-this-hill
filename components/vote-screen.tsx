'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { RoomView } from '../shared/types';
import { useGame } from './game-provider';
import { playerName, RoundStrip, Timer, useRemaining } from './game-common';
import { useAudio } from './audio-provider';

export function VoteScreen({ room }: { room: RoomView }) {
  const game = useGame();
  const [selected, setSelected] = useState(room.me.vote?.answerId || '');
  const dialog = useRef<HTMLDialogElement>(null);
  const lastTick = useRef(0);
  const seconds = useRemaining(room);
  const me = room.players.find((player) => player.id === room.me.id)!;
  const locked = room.me.vote !== null;
  const unavailable = locked || !game.connected || game.restoring || game.pending || !selected || seconds === 0;
  const selectedAnswer = room.answerPool.find((answer) => answer.id === (room.me.vote?.answerId || selected));
  const waitingFor = Math.max(0, room.players.length - room.votedCount);
  const audio = useAudio();

  useEffect(() => { if (seconds === 0 || locked || !game.connected) dialog.current?.close(); }, [seconds, locked, game.connected]);
  useEffect(() => { if (!locked && seconds > 0 && seconds <= 5 && seconds !== lastTick.current) { lastTick.current = seconds; audio.play('countdown-tick'); } }, [seconds, locked, audio]);
  const confirm = async () => { if (await game.vote(selected, true)) dialog.current?.close(); };
  const submit = (event: FormEvent) => { event.preventDefault(); if (!unavailable) void game.vote(selected, false); };
  return <>
    <main className="game-shell"><RoundStrip room={room} /><section aria-labelledby="vote-title"><div className="stage-heading"><div><div className="eyebrow">04 / The vote</div><h1 id="vote-title">FINAL ANSWER</h1></div><Timer seconds={seconds} label="to choose" locked={locked} /></div><div className="question-meta">{room.question?.category}</div><p className="question-small">{room.question?.text}</p>
      <form onSubmit={submit}><fieldset className="vote-fieldset" disabled={locked || game.pending || !game.connected || game.restoring || seconds === 0}><legend className="input-help">Choose the answer you believe is right.</legend><div className="answer-pool">{room.answerPool.map((answer) => <label className="vote-choice" key={answer.id}><input type="radio" name="final-answer" value={answer.id} required checked={(room.me.vote?.answerId || selected) === answer.id} onChange={() => setSelected(answer.id)} /><span className="answer-card">{answer.text}</span></label>)}</div></fieldset><button className="btn btn-secondary btn-large full-width" disabled={unavailable}>{locked ? 'ANSWER LOCKED' : game.pending ? 'LOCKING...' : seconds === 0 ? 'TIME’S UP' : 'LOCK ANSWER'}</button><div className="hill-action"><button className="btn btn-hill full-width" type="button" disabled={unavailable || me.hillUsed} onClick={() => dialog.current?.showModal()}><span>{me.hillUsed ? 'HILL USED' : 'I WILL DIE ON THIS HILL'}</span></button><p>{me.hillUsed ? 'USED' : '1 remaining'} <span>{me.hillUsed ? 'Your Hill is spent for this game.' : 'Once per game. Double the stakes.'}</span></p></div></form>
      {locked && <p className="waiting-message vote-status" role="status"><strong>{selectedAnswer?.text}</strong> locked{room.me.vote?.hill ? '. You will die on this hill.' : '.'} {waitingFor ? `Waiting for ${waitingFor} ${waitingFor === 1 ? 'player' : 'players'}...` : 'Everyone has voted.'}</p>}
      <p className="players-status">{room.votedCount} of {room.players.length} players voted</p>
      <div className="hill-announcements" aria-live="polite">{room.hillPlayerIds.map((id) => <p key={id}>{playerName(room, id)} has decided to <strong>DIE ON THIS HILL.</strong></p>)}</div>
    </section></main>
    <dialog className="hill-dialog" ref={dialog} aria-labelledby="hill-confirm-title" aria-describedby="hill-confirm-copy"><form method="dialog"><button className="dialog-close" aria-label="Close confirmation" value="cancel">X</button></form><div className="eyebrow">Your one shot. Make it count.</div><h2 id="hill-confirm-title">YOU ARE ABOUT TO DIE ON THIS HILL.</h2><div className="chosen-hill">{selectedAnswer?.text}</div><p id="hill-confirm-copy">Points won or lost from this answer will be doubled.</p>{game.error && <p className="form-error" role="alert">{game.error}</p>}<div className="dialog-actions"><button className="btn btn-secondary" type="button" autoFocus onClick={() => dialog.current?.close()}>GO BACK</button><button className="btn btn-primary" type="button" disabled={unavailable || me.hillUsed} onClick={() => void confirm()}>I ACCEPT MY FATE</button></div></dialog>
  </>;
}
