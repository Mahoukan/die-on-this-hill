'use client';

import { useEffect, useRef, useState } from 'react';
import type { Ack, DisplayView, PublicAnswer } from '../shared/types';
import { createSocket } from '../lib/socket';
import { signed, useRemaining } from './game-common';
import { AudioSettingsControl, useAudio } from './audio-provider';

const nameFor = (room: DisplayView, id: string) => room.players.find((player) => player.id === id)?.name || 'Player';

export function DisplayScreen({ roomCode }: { roomCode: string }) {
  const audio = useAudio();
  const [room, setRoom] = useState<DisplayView | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [hillPlayerId, setHillPlayerId] = useState<string | null>(null);
  const seenHills = useRef(new Set<string>());
  const previousState = useRef<{ phase: DisplayView['phase']; revealStep: DisplayView['revealStep'] } | null>(null);
  const awardTimer = useRef<number | null>(null);

  const hillKey = room?.hillPlayerIds.join('|');
  useEffect(() => {
    const socket = createSocket();
    const join = () => {
      setConnected(true);
      socket.timeout(8000).emit('display:join', { roomCode }, (timeout: Error | null, result: Ack<DisplayView>) => {
        if (timeout) { setError('Unable to reach this game. Reconnecting...'); return; }
        if (!result.ok) { setRoom(null); setError('Game not found'); return; }
        setError(''); setRoom(result.data);
      });
    };
    socket.on('connect', join);
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => { setConnected(false); setError('Connection lost. Reconnecting...'); });
    socket.on('display:state', (state) => { setRoom(state); setError(''); });
    socket.on('display:closed', () => { setRoom(null); setError('This game is no longer available.'); });
    socket.connect();
    return () => { socket.removeAllListeners(); socket.disconnect(); };
  }, [roomCode]);

  useEffect(() => {
    if (!room || room.phase !== 'vote') { seenHills.current.clear(); setHillPlayerId(null); return; }
    const fresh = room.hillPlayerIds.find((id) => !seenHills.current.has(id));
    room.hillPlayerIds.forEach((id) => seenHills.current.add(id));
    if (!fresh) return;
    setHillPlayerId(fresh);
    audio.play('hill-activate');
    const timer = window.setTimeout(() => setHillPlayerId(null), 3500);
    return () => window.clearTimeout(timer);
  }, [room?.phase, hillKey, audio]);

  useEffect(() => { if (!room) return; if (room.phase !== 'final-results' && awardTimer.current !== null) { window.clearTimeout(awardTimer.current); awardTimer.current = null; } const before = previousState.current; previousState.current = { phase: room.phase, revealStep: room.revealStep }; if (!before) return;
    if (before.phase !== room.phase && room.phase === 'debate-transition') audio.play('countdown-sequence'); else if (before.phase !== room.phase && ['bluff', 'debate', 'vote'].includes(room.phase)) audio.play('phase-change');
    if (before.revealStep !== room.revealStep) { if (room.revealStep === 'correct') { audio.play('correct'); const outcomes = room.hillPlayerIds.map((id) => room.answerPool.some((answer) => answer.isCorrect && answer.voterIds?.includes(id))); if (outcomes.some(Boolean)) window.setTimeout(() => audio.play('hill-success'), 650); if (outcomes.some((correct) => !correct)) window.setTimeout(() => audio.play('hill-fail'), outcomes.some(Boolean) ? 3300 : 650); } if (room.revealStep === 'bluffs') audio.play('bluffs'); }
    if (before.phase !== room.phase && room.phase === 'results') { const gained = room.results.some((result) => result.roundPoints > 0); const lost = room.results.some((result) => result.roundPoints < 0); if (gained) audio.play('score-gain'); if (lost) window.setTimeout(() => audio.play('score-loss'), gained ? 2100 : 0); }
    if (before.phase !== room.phase && room.phase === 'final-results') { audio.play('winner'); if (room.awards.length) awardTimer.current = window.setTimeout(() => { audio.play('award-reveal'); awardTimer.current = null; }, 9000); }
  }, [room, audio]);
  useEffect(() => () => { if (awardTimer.current !== null) window.clearTimeout(awardTimer.current); }, []);

  const fullscreen = async () => { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); } catch { /* Fullscreen can be unavailable or denied by the browser. */ } };
  if (!room) return <div className="page page-display"><div className="display-shell"><DisplayHeader code={roomCode} connected={connected} fullscreen={fullscreen} /><main className="display-main display-message"><div className="eyebrow">Shared display</div><h1>{error || (connected ? 'CONNECTING TO GAME...' : 'RECONNECTING TO GAME...')}</h1><p>{connected ? 'Check the four-letter room code.' : 'The display will reconnect automatically.'}</p></main></div></div>;
  return <div className="page page-display"><div className="display-shell"><DisplayHeader code={room.roomCode} connected={connected} fullscreen={fullscreen} round={room.round} totalRounds={room.totalRounds} /><main className="display-main"><DisplayPhase room={room} /></main><footer className="display-footer"><span>Optional shared display. Keep playing on your phones</span><span>{connected ? `Room ${room.roomCode}, live` : 'Reconnecting...'}</span></footer>{hillPlayerId && <div className="display-hill-announcement" role="status"><span>{nameFor(room, hillPlayerId)} has decided</span><strong>TO DIE ON THIS HILL</strong><small>Their answer remains secret.</small></div>}</div></div>;
}

function DisplayHeader({ code, connected, fullscreen, round, totalRounds }: { code: string; connected: boolean; fullscreen: () => Promise<void>; round?: number; totalRounds?: number }) {
  return <header className="display-header"><div className="brand-mark"><span className="brand-flame" aria-hidden="true" /><span>Die on This Hill</span></div>{round ? <span className="display-round">Round <strong>{round}</strong> of {totalRounds}</span> : <span className="display-round">Room <strong>{code}</strong></span>}<div className="display-utilities"><AudioSettingsControl compact /><button className="display-fullscreen" type="button" onClick={() => void fullscreen()}>{connected ? 'Fullscreen' : 'Reconnecting...'}</button></div></header>;
}

function DisplayPhase({ room }: { room: DisplayView }) {
  if (room.phase === 'lobby') return <DisplayLobby room={room} />;
  if (room.phase === 'answer' || room.phase === 'bluff') return <DisplaySubmission room={room} />;
  if (room.phase === 'debate' || room.phase === 'debate-transition') return <DisplayDebate room={room} />;
  if (room.phase === 'vote') return <DisplayVote room={room} />;
  if (room.phase === 'reveal') return <DisplayReveal room={room} />;
  if (room.phase === 'results') return <DisplayResults room={room} />;
  return <DisplayFinal room={room} />;
}

function DisplayLobby({ room }: { room: DisplayView }) {
  const players = room.players.filter((player) => player.connected);
  const packs = room.questionPacks.filter((pack) => room.selectedPackIds.includes(pack.id));
  return <section className="display-lobby"><div className="eyebrow">Room code</div><h1>{room.roomCode}</h1><p className="display-tagline">Trivia is easy. Convincing your friends isn’t.</p><div className="display-lobby-grid"><div><strong>{players.length} {players.length === 1 ? 'player' : 'players'}</strong><ul>{players.map((player) => <li key={player.id}>{player.name}{player.isHost ? ', Host' : ''}</li>)}</ul></div><div><strong>{room.totalRounds} rounds, {room.questionMode === 'mixed' ? 'Mixed Game' : 'Single Pack'}</strong><p>{packs.map((pack) => pack.name).join(', ')}</p><p>{room.availableQuestionCount} questions available. Waiting for the host...</p></div></div></section>;
}

function DisplaySubmission({ room }: { room: DisplayView }) {
  const seconds = useRemaining(room); const bluff = room.phase === 'bluff'; const count = bluff ? room.bluffCount : room.answeredCount;
  return <section><DisplayHeading eyebrow={`${bluff ? '02 / The bluff' : '01 / Genuine answer'}, ${room.question?.category || ''}`} title={bluff ? 'NOW MAKE SOMETHING UP' : 'WHAT DO YOU ACTUALLY THINK?'} seconds={seconds} timerLabel={bluff ? 'to bluff' : 'to answer'} /><p className="display-question">{room.question?.text}</p><p className="display-instruction">{bluff ? 'Submit a believable wrong answer.' : 'Answers stay private.'}</p><p className="display-progress">{count} OF {room.players.length} PLAYERS {bluff ? 'READY' : 'ANSWERED'}</p></section>;
}

function DisplayDebate({ room }: { room: DisplayView }) {
  const seconds = useRemaining(room); const transitioning = room.phase === 'debate-transition'; const majorityReady = room.debateReadyCount >= room.debateRequiredCount;
  return <section><DisplayHeading eyebrow={`03 / The debate, ${room.question?.category || ''}`} title={transitioning ? majorityReady ? 'MAJORITY READY' : 'DEBATE ENDED' : 'MAKE YOUR CASE'} seconds={seconds} timerLabel={transitioning ? 'until voting' : 'to debate'} /><p className="display-question">{room.question?.text}</p><AnswerPool answers={room.answerPool} /><p className={`display-instruction${transitioning ? ' display-transition-copy' : ''}`}>{transitioning ? `FINAL ANSWERS IN ${Math.max(1, seconds)}...` : `READY TO VOTE: ${room.debateReadyCount} / ${room.debateRequiredCount} REQUIRED`}</p></section>;
}

function DisplayVote({ room }: { room: DisplayView }) {
  const seconds = useRemaining(room);
  return <section><DisplayHeading eyebrow={`04 / The vote, ${room.question?.category || ''}`} title="FINAL ANSWER" seconds={seconds} timerLabel="to choose" /><p className="display-question">{room.question?.text}</p><AnswerPool answers={room.answerPool} /><p className="display-instruction">{room.votedCount} OF {room.players.length} VOTES LOCKED</p></section>;
}

function DisplayReveal({ room }: { room: DisplayView }) {
  const title = room.revealStep === 'ready' ? 'EVERYONE HAS VOTED' : room.revealStep === 'votes' ? 'HERE’S WHERE YOU LANDED' : room.revealStep === 'correct' ? 'THE CORRECT ANSWER IS...' : 'YOU BOUGHT THAT?';
  return <section><div className="eyebrow">05 / The reveal, {room.question?.category}</div><h1 className="display-title">{title}</h1><p className="display-question">{room.question?.text}</p>{room.revealStep !== 'ready' && <div className="answer-pool display-pool">{room.answerPool.map((answer) => <article className={`answer-card${answer.isCorrect ? ' is-correct' : ''}`} key={answer.id}><h2>{answer.text}</h2>{answer.voterIds && <p>{answer.voterIds.length ? answer.voterIds.map((id) => nameFor(room, id)).join(', ') : 'No votes'}</p>}{room.revealStep === 'bluffs' && answer.bluffPlayerIds?.length ? <p>Bluff by {answer.bluffPlayerIds.map((id) => nameFor(room, id)).join(' & ')}</p> : null}</article>)}</div>}{room.revealStep === 'correct' && <div className="display-correct"><strong>{room.correctAnswer}</strong>{room.explanation && <p>{room.explanation}</p>}{room.hillPlayerIds.map((id) => { const survived = room.answerPool.some((answer) => answer.isCorrect && answer.voterIds?.includes(id)); return <span key={id}>{nameFor(room, id)} {survived ? 'died on the Hill and lived: +200' : 'fell on the wrong Hill: -100'}</span>; })}</div>}{room.revealStep === 'bluffs' && <p className="display-instruction">Bluff owners and voters revealed</p>}</section>;
}

function DisplayResults({ room }: { room: DisplayView }) {
  const results = [...room.results].sort((left, right) => right.totalScore - left.totalScore);
  return <section><div className="eyebrow">07 / The reckoning</div><h1 className="display-title">ROUND {room.round} RESULTS</h1><div className="display-scoreboard">{results.map((result) => <div key={result.playerId} className="display-score-row"><strong>{nameFor(room, result.playerId)}</strong>{result.hill && <span className="display-hill-badge">HILL {result.correct ? 'LIVED' : 'FELL'}</span>}<span className={result.roundPoints < 0 ? 'negative' : 'positive'}>{signed(result.roundPoints)}</span><b>{result.totalScore.toLocaleString()}</b></div>)}</div><p className="display-instruction">Waiting for the host...</p></section>;
}

function DisplayFinal({ room }: { room: DisplayView }) {
  return <section><div className="eyebrow">Game over. The last ones standing</div><h1 className="display-title">THE HILL HAS CLAIMED ITS VICTIMS</h1><div className="display-final-layout"><ol className="display-rankings">{room.leaderboard.map((entry) => <li key={entry.playerId} className={entry.rank === 1 ? 'champion' : ''}><span>{entry.rank}</span><strong>{nameFor(room, entry.playerId)}</strong>{entry.hillSuccessful && <small>Hill survivor</small>}<b>{entry.score.toLocaleString()}</b></li>)}</ol><div className="display-awards">{room.awards.map((award) => <article key={award.key}><span>{award.title}</span><strong>{award.winnerIds.map((id) => nameFor(room, id)).join(' & ')}</strong><small>{award.valueLabel}</small></article>)}</div></div><p className="display-instruction">Waiting for the host...</p></section>;
}

function DisplayHeading({ eyebrow, title, seconds, timerLabel }: { eyebrow: string; title: string; seconds: number; timerLabel: string }) {
  const audio = useAudio(); const lastTick = useRef(0); const tick = timerLabel === 'to debate' || timerLabel === 'to choose';
  useEffect(() => { if (tick && seconds > 0 && seconds <= 5 && seconds !== lastTick.current) { lastTick.current = seconds; audio.play('countdown-tick'); } }, [seconds, tick, audio]);
  return <div className="display-stage-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div><div className={`timer display-timer${seconds <= 10 ? ' is-urgent' : ''}`} role="timer"><span className="timer-value">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span><span className="timer-label">{timerLabel}</span></div></div>;
}

function AnswerPool({ answers }: { answers: PublicAnswer[] }) {
  return <div className="answer-pool display-pool">{answers.map((answer) => <article className="answer-card" key={answer.id}><h2>{answer.text}</h2></article>)}</div>;
}
