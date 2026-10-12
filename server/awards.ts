import type { GameAward, LeaderboardEntry, Player } from '../shared/types';

export function buildLeaderboard(players: Player[]): LeaderboardEntry[] {
  const sorted = [...players].sort((left, right) =>
    right.score - left.score
    || right.stats.correctFinalAnswers - left.stats.correctFinalAnswers
    || right.stats.successfulBluffVotes - left.stats.successfulBluffVotes
  );
  const entries: LeaderboardEntry[] = [];
  sorted.forEach((player, index) => {
    const previous = sorted[index - 1];
    const tied = previous
      && previous.score === player.score
      && previous.stats.correctFinalAnswers === player.stats.correctFinalAnswers
      && previous.stats.successfulBluffVotes === player.stats.successfulBluffVotes;
    entries.push({
      playerId: player.id,
      rank: tied ? entries[index - 1].rank : index + 1,
      score: player.score,
      correctFinalAnswers: player.stats.correctFinalAnswers,
      successfulBluffVotes: player.stats.successfulBluffVotes,
      hillSuccessful: player.stats.hillSuccessful,
    });
  });
  return entries;
}

type PositiveStat = 'correctInitialAnswers' | 'successfulBluffVotes' | 'changedWrongToCorrect' | 'changedCorrectToWrong' | 'answerChanges';
const DEFINITIONS: Array<{ key: GameAward['key']; title: string; description: string; stat: PositiveStat; singular: string; plural: string }> = [
  { key: 'human-wikipedia', title: 'HUMAN WIKIPEDIA', description: 'Most correct genuine initial answers', stat: 'correctInitialAnswers', singular: 'correct initial answer', plural: 'correct initial answers' },
  { key: 'master-bullshitter', title: 'MASTER BULLSHITTER', description: 'Most total players fooled by bluffs', stat: 'successfulBluffVotes', singular: 'player fooled', plural: 'players fooled' },
  { key: 'great-recovery', title: 'GREAT RECOVERY', description: 'Most changes from wrong to correct', stat: 'changedWrongToCorrect', singular: 'great recovery', plural: 'great recoveries' },
  { key: 'talked-out-of-it', title: 'TALKED OUT OF IT', description: 'Most changes from correct to wrong', stat: 'changedCorrectToWrong', singular: 'time talked out of it', plural: 'times talked out of it' },
  { key: 'most-persuadable', title: 'MOST PERSUADABLE', description: 'Changed final answer most often', stat: 'answerChanges', singular: 'answer changed', plural: 'answers changed' },
];

export function calculateAwards(players: Player[]): GameAward[] {
  const awards = DEFINITIONS.flatMap((definition) => {
    const value = Math.max(...players.map((player) => player.stats[definition.stat]));
    if (value <= 0) return [];
    return [{ key: definition.key, title: definition.title, description: definition.description, winnerIds: players.filter((player) => player.stats[definition.stat] === value).map((player) => player.id), value, valueLabel: `${value} ${value === 1 ? definition.singular : definition.plural}` }];
  });
  const worstImpact = Math.min(0, ...players.map((player) => player.stats.hillScoreImpact));
  if (worstImpact < 0) awards.push({
    key: 'worst-hill',
    title: 'WORST HILL TO DIE ON',
    description: 'Largest negative Hill score impact',
    winnerIds: players.filter((player) => player.stats.hillScoreImpact === worstImpact).map((player) => player.id),
    value: worstImpact,
    valueLabel: `${worstImpact} extra points`,
  });
  return awards;
}
