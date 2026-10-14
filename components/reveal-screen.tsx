'use client';

import type { RoomView } from '../shared/types';
import { useGame } from './game-provider';
import { playerName, RoundStrip, signed } from './game-common';

function RevealContinue({ room, label }: { room: RoomView; label: string }) {
  const game = useGame();
  return room.hostPlayerId === room.me.id
    ? <div className="page-actions"><button className="btn btn-primary btn-large" disabled={!game.connected || game.restoring || game.pending} onClick={() => void game.act('reveal:continue')}>{label}</button></div>
    : <p className="phase-note reveal-wait" role="status">Waiting for {playerName(room, room.hostPlayerId)} to continue...</p>;
}

export function RevealScreen({ room }: { room: RoomView }) {
  if (room.revealStep === 'bluffs') return <BluffRecap room={room} />;
  const votesVisible = room.revealStep !== 'ready';
  const correctVisible = room.revealStep === 'correct';
  return <main className="game-shell game-shell-wide"><RoundStrip room={room} /><section aria-labelledby="reveal-title"><div className="eyebrow">05 / The reveal</div><h1 className="stage-title" id="reveal-title">{room.votedCount === room.players.length ? 'EVERYONE HAS VOTED' : 'VOTING HAS CLOSED'}</h1><p className="stage-copy">The arguments are over. Let’s see where everyone landed.</p><p className="question-small">{room.question?.text}</p>
    {votesVisible && <section className={`reveal-stage${correctVisible ? ' has-correct' : ''}`} aria-label="Player votes"><div className="answer-pool">{room.answerPool.map((answer) => <article className={`answer-card${answer.isCorrect ? ' is-correct' : correctVisible ? ' is-incorrect' : ''}`} key={answer.id}><h2>{answer.text}</h2>{answer.voterIds?.length ? <ul className="voter-list">{answer.voterIds.map((id) => <li key={id}>{playerName(room, id)}{room.hillPlayerIds.includes(id) && <span className="voter-hill" title="Used I WILL DIE ON THIS HILL">Hill</span>}</li>)}</ul> : <p className="no-votes">No votes</p>}{answer.isCorrect && <span className="correct-label">Correct answer</span>}</article>)}</div>{room.votedCount < room.players.length && <p className="phase-note">No final vote: {room.players.filter((player) => !room.answerPool.some((answer) => answer.voterIds?.includes(player.id))).map((player) => player.name).join(', ')}</p>}</section>}
    {correctVisible && <section className="correct-reveal" aria-labelledby="correct-title"><div className="eyebrow">THE CORRECT ANSWER IS...</div><h2 id="correct-title">{room.correctAnswer?.toUpperCase()}</h2>{room.explanation ? <p className="answer-explanation">{room.explanation}</p> : <p>That’s one hill worth defending.</p>}{room.hillPlayerIds.map((id) => {
      const correct = room.answerPool.some((answer) => answer.isCorrect && answer.voterIds?.includes(id));
      return <div className="hill-survivor" key={id}><div><strong>{playerName(room, id)} chose: I WILL DIE ON THIS HILL</strong><span>{correct ? 'And was correct. Double points. Bragging rights included.' : 'And was wrong. Double the stakes, double the fall.'}</span></div><span className={correct ? 'positive' : 'negative'}>{correct ? '+200' : '-100'}</span></div>;
    })}</section>}
    <RevealContinue room={room} label={room.revealStep === 'ready' ? 'SHOW THE VOTES' : room.revealStep === 'votes' ? 'REVEAL THE ANSWER' : 'WHO FOOLED WHO?'} />
  </section></main>;
}

function BluffRecap({ room }: { room: RoomView }) {
  const correct = room.answerPool.find((answer) => answer.isCorrect);
  if (!correct || room.results.length === 0) return <ResultFallback room={room} />;
  return <main className="game-shell game-shell-wide"><RoundStrip room={room} /><div className="eyebrow">06 / Bluff results</div><h1 className="stage-title">YOU BOUGHT THAT?</h1><p className="stage-copy">Some answers were facts. Some were your friends getting creative.</p><section className="bluff-recap" aria-label="Bluff results">
    {room.answerPool.filter((answer) => !answer.isCorrect).map((answer) => <article className={`bluff-result${answer.bluffPlayerIds?.length ? ' bluff-success' : ''}`} key={answer.id}><div className="eyebrow">{answer.bluffPlayerIds?.length ? 'A convincing little lie' : 'An honest wrong guess'}</div><h2>{answer.text.toUpperCase()}</h2>{answer.bluffPlayerIds?.length ? answer.bluffPlayerIds.map((id) => {
      const outcome = answer.bluffOutcomes?.find((item) => item.playerId === id);
      const fooled = outcome?.fooledPlayerIds ?? [];
      return <div key={id}><p>Submitted by <strong>{playerName(room, id)}</strong> as a bluff</p><div className={`fooled-player${!fooled.length ? ' nobody-fooled' : ''}`}>{fooled.length ? `${fooled.map((voterId) => playerName(room, voterId)).join(', ')} fell for it` : 'Nobody believed it'}</div><div className="bluff-payoff">{playerName(room, id)} <strong className={outcome?.points ? 'positive' : ''}>{signed(outcome?.points ?? 0)}</strong></div></div>;
    }) : <p>Genuine answer from {answer.genuinePlayerIds?.map((id) => playerName(room, id)).join(', ')}</p>}{Boolean(answer.bluffPlayerIds?.length && answer.genuinePlayerIds?.length) && <p className="input-help">Also genuinely guessed by {answer.genuinePlayerIds?.map((id) => playerName(room, id)).join(', ')}</p>}</article>)}
    <article className="bluff-result truth-card"><div className="eyebrow positive">Correct Answer</div><h2>{correct.text.toUpperCase()}</h2><p>The truth was hiding in plain sight.</p><div className="genuine-correct"><span>Originally guessed correctly</span><strong>{correct.genuinePlayerIds?.length ? correct.genuinePlayerIds.map((id) => playerName(room, id)).join(', ') : 'Nobody this round'}</strong></div>{Boolean(correct.bluffPlayerIds?.length) && <p className="input-help">Also submitted as a bluff by {correct.bluffPlayerIds?.map((id) => playerName(room, id)).join(', ')}. Correct answers earn no bluff points.</p>}</article>
  </section><p className="phase-note">Friendship intact? Good. Time to count the points.</p><RevealContinue room={room} label="SEE ROUND RESULTS" /></main>;
}

function ResultFallback({ room }: { room: RoomView }) {
  return <main className="game-shell"><RoundStrip room={room} /><div className="eyebrow">06 / Bluff results</div><h1 className="stage-title">YOU BOUGHT THAT?</h1><p className="phase-note" role="status">Waiting for round results...</p></main>;
}
