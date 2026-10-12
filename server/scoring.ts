import type { GameRoom, RoundResult } from '../shared/types';

export function scoreRound(room: GameRoom): RoundResult[] {
  return room.players.map((player) => {
    const vote = room.votes.find((item) => item.playerId === player.id);
    const option = room.answerPool.find((item) => item.id === vote?.answerId);
    const correct = Boolean(option?.isCorrect);
    // A missed vote earns zero. Only an actual wrong final vote costs points.
    const finalAnswerPoints = vote ? (correct ? 100 : -50) * (vote.hill ? 2 : 1) : 0;
    let bluffPoints = 0;
    for (const answer of room.answerPool) {
      // An accidentally correct bluff is accepted privately, but fools nobody.
      // Every duplicate bluff author earns +100 per OTHER voter independently.
      // Genuine guesses and a player's own vote never earn bluff points.
      if (!answer.isCorrect && answer.bluffPlayerIds.includes(player.id)) {
        bluffPoints += room.votes.filter((item) => item.answerId === answer.id && item.playerId !== player.id).length * 100;
      }
    }
    const roundPoints = finalAnswerPoints + bluffPoints;
    return { playerId: player.id, finalAnswerPoints, bluffPoints, roundPoints, totalScore: player.score + roundPoints, hill: Boolean(vote?.hill), correct };
  });
}
