'use client';

import type { RoomView } from '../shared/types';
import { scoreTransitionValues } from '../lib/audio-settings';
import { useGame } from './game-provider';
import { playerName, RoundStrip, signed } from './game-common';

function ScoreChange({ total, round }: { total: number; round: number }) {
  const score = scoreTransitionValues(total, round);
  return <span className="score-change" aria-label={`${score.final} points`}><small>{score.previous}</small><i>{signed(score.delta)}</i><strong>{score.final}</strong></span>;
}

export function ResultsScreen({ room }: { room: RoomView }) {
  const game = useGame();
  const results = [...room.results].sort((left, right) => right.totalScore - left.totalScore);
  const isFinalRound = room.round === room.totalRounds;
  if (results.length === 0) return <main className="game-shell"><RoundStrip room={room} /><div className="eyebrow">07 / The reckoning</div><h1 className="stage-title">ROUND {room.round} RESULTS</h1><p className="phase-note" role="status">Waiting for round results...</p></main>;
  return <main className="game-shell"><RoundStrip room={room} /><div className="eyebrow">07 / The reckoning</div><h1 className="stage-title">ROUND {room.round} RESULTS</h1><p className="stage-copy">The truth is out. Here’s what your opinions were worth.</p>
    <section className="round-scoreboard" aria-label="Round scoreboard"><table><caption className="scoreboard-caption">Final answer points, bluff points, Hill impact, this round, and total score</caption><thead><tr><th scope="col">Player</th><th scope="col">This Round</th><th scope="col">Total</th></tr></thead><tbody>{results.map((result, index) => <tr key={result.playerId} className={index === 0 ? 'leader-row' : ''} style={{ animationDelay: `${index * 90}ms` }}><th scope="row"><span className="score-player"><span className="score-avatar">{Array.from(playerName(room, result.playerId))[0]}</span><span>{playerName(room, result.playerId)} {result.playerId === room.me.id && <span className="you-label">You</span>}</span></span>{result.hill && <span className={`result-tag${result.correct ? '' : ' negative-tag'}`}>{result.correct ? 'DIED ON THE HILL AND LIVED' : 'DIED ON THE HILL'}</span>}<span className="score-breakdown">Final answer {signed(result.finalAnswerPoints)}<br />Bluffs {signed(result.bluffPoints)}{result.hill && <><br />Hill impact {signed(result.hillImpact)}</>}</span></th><td className={result.roundPoints > 0 ? 'positive' : result.roundPoints < 0 ? 'negative' : ''}>{signed(result.roundPoints)}</td><td className={result.totalScore < 0 ? 'negative' : ''}><ScoreChange total={result.totalScore} round={result.roundPoints} /></td></tr>)}</tbody></table></section>
    <p className="phase-note">{isFinalRound ? 'Every point is counted. Time to see who owns the hill.' : `${room.totalRounds - room.round} rounds remain. Ready to defend another opinion?`}</p>{room.hostPlayerId === room.me.id ? <div className="page-actions"><button className="btn btn-primary btn-large" disabled={!game.connected || game.restoring || game.pending} onClick={() => void game.act('game:advance')}>{isFinalRound ? 'FINAL RESULTS' : 'NEXT ROUND'}</button></div> : <p className="phase-note" role="status">Waiting for {playerName(room, room.hostPlayerId)} to continue.</p>}
  </main>;
}
