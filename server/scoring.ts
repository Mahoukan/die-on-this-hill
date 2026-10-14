import type { BluffOutcome, GameRoom, RoundResult } from '../shared/types';

export function bluffOutcomes(room: GameRoom, answerId: string): BluffOutcome[] {
  const answer = room.answerPool.find((item) => item.id === answerId);
  if (!answer || answer.isCorrect) return [];
  return answer.bluffPlayerIds.map((playerId) => {
    const fooledPlayerIds = room.votes.filter((vote) => vote.answerId === answer.id && vote.playerId !== playerId).map((vote) => vote.playerId);
    return { playerId, fooledPlayerIds, points: fooledPlayerIds.length * 100 };
  });
}

export function scoreRound(room: GameRoom): RoundResult[] {
  return room.players.map((player) => {
    const vote = room.votes.find((item) => item.playerId === player.id);
    const option = room.answerPool.find((item) => item.id === vote?.answerId);
    const correct = Boolean(option?.isCorrect);
    // A missed vote earns zero. Only an actual wrong final vote costs points.
    const finalAnswerPoints = vote ? (correct ? 100 : -50) : 0;
    // Every duplicate author earns independently. Correct bluffs and self-votes earn nothing.
    const bluffPoints = room.answerPool.flatMap((answer) => bluffOutcomes(room, answer.id)).filter((outcome) => outcome.playerId === player.id).reduce((total, outcome) => total + outcome.points, 0);
    const hillImpact = vote?.hill ? finalAnswerPoints : 0;
    const roundPoints = finalAnswerPoints + hillImpact + bluffPoints;
    return { playerId: player.id, finalAnswerPoints, bluffPoints, hillImpact, roundPoints, totalScore: player.score + roundPoints, hill: Boolean(vote?.hill), correct };
  });
}
