export type GamePhase = 'lobby' | 'answer' | 'bluff' | 'debate' | 'debate-transition' | 'vote' | 'reveal' | 'results' | 'final-results';
export type RevealStep = 'ready' | 'votes' | 'correct' | 'bluffs';
export type RoundSetting = 'recommended' | 5 | 8 | 10 | 12;

export interface PlayerStats {
  correctInitialAnswers: number;
  correctFinalAnswers: number;
  wrongFinalAnswers: number;
  successfulBluffVotes: number;
  answerChanges: number;
  changedWrongToCorrect: number;
  changedCorrectToWrong: number;
  hillUsed: boolean;
  hillSuccessful: boolean;
  hillScoreImpact: number;
}

export interface Player { id: string; name: string; score: number; isHost: boolean; hillUsed: boolean; connected: boolean; stats: PlayerStats; }
export interface Question { id: string; text: string; correctAnswer: string; category?: string; }
export interface PlayerSubmission { playerId: string; genuineAnswer: string | null; bluff: string | null; }
export interface AnswerOption { id: string; text: string; isCorrect: boolean; genuinePlayerIds: string[]; bluffPlayerIds: string[]; }
export interface PlayerVote { playerId: string; answerId: string; hill: boolean; }
export interface RoundResult { playerId: string; finalAnswerPoints: number; bluffPoints: number; hillImpact: number; roundPoints: number; totalScore: number; hill: boolean; correct: boolean; }
export interface LeaderboardEntry { playerId: string; rank: number; score: number; correctFinalAnswers: number; successfulBluffVotes: number; hillSuccessful: boolean; }

export type AwardKey = 'human-wikipedia' | 'master-bullshitter' | 'great-recovery' | 'talked-out-of-it' | 'most-persuadable' | 'worst-hill';
export interface GameAward { key: AwardKey; title: string; description: string; winnerIds: string[]; value: number; valueLabel: string; }

/** Server-only model: never send this object directly to a browser. */
export interface GameRoom {
  roomCode: string;
  phase: GamePhase;
  revealStep: RevealStep;
  round: number;
  totalRounds: number;
  roundSetting: RoundSetting;
  selectedQuestionIds: string[];
  hostPlayerId: string;
  players: Player[];
  question: Question | null;
  submissions: PlayerSubmission[];
  answerPool: AnswerOption[];
  votes: PlayerVote[];
  results: RoundResult[];
  roundResults: RoundResult[][];
  debateReadyPlayerIds: string[];
  phaseEndsAt: number | null;
}

export interface PublicPlayer extends Omit<Player, 'stats'> {}
export interface PublicAnswer { id: string; text: string; voterIds?: string[]; isCorrect?: boolean; genuinePlayerIds?: string[]; bluffPlayerIds?: string[]; }

/** Deliberate allowlist projection; contains no secrets or premature answer origins. */
export interface RoomView {
  roomCode: string;
  phase: GamePhase;
  revealStep: RevealStep;
  round: number;
  totalRounds: number;
  roundSetting: RoundSetting;
  hostPlayerId: string;
  players: PublicPlayer[];
  question: { id: string; text: string } | null;
  answerPool: PublicAnswer[];
  phaseEndsAt: number | null;
  serverNow: number;
  answeredCount: number;
  bluffCount: number;
  votedCount: number;
  hillPlayerIds: string[];
  debateReadyCount: number;
  debateRequiredCount: number;
  correctAnswer?: string;
  results: RoundResult[];
  leaderboard: LeaderboardEntry[];
  awards: GameAward[];
  me: { id: string; genuineAnswer: string | null; bluff: string | null; vote: PlayerVote | null; debateReady: boolean; };
}
export type DisplayView = Omit<RoomView, 'me'>;

export interface PlayerSession { roomCode: string; playerId: string; reconnectToken: string; }
export type Ack<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export type Reply<T = undefined> = (result: Ack<T>) => void;
export interface ClientEvents {
  'room:create': (payload: { name: string }, reply: Reply<PlayerSession>) => void;
  'room:join': (payload: { name: string; roomCode: string }, reply: Reply<PlayerSession>) => void;
  'room:reconnect': (payload: PlayerSession, reply: Reply<PlayerSession>) => void;
  'room:leave': (reply: Reply) => void;
  'display:join': (payload: { roomCode: string }, reply: Reply<DisplayView>) => void;
  'game:settings': (payload: { rounds: RoundSetting }, reply: Reply) => void;
  'game:start': (reply: Reply) => void;
  'game:advance': (reply: Reply) => void;
  'game:reset': (reply: Reply) => void;
  'answer:submit': (payload: { answer: string }, reply: Reply) => void;
  'bluff:submit': (payload: { answer: string }, reply: Reply) => void;
  'vote:submit': (payload: { answerId: string; hill: boolean }, reply: Reply) => void;
  'debate:set-ready': (payload: { ready: boolean }, reply: Reply) => void;
  'debate:end-host': (reply: Reply) => void;
  'reveal:continue': (reply: Reply) => void;
}
export interface ServerEvents { 'room:state': (state: RoomView) => void; 'display:state': (state: DisplayView) => void; 'display:closed': () => void; 'session:replaced': () => void; }
