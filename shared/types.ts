export type GamePhase = 'lobby' | 'answer' | 'bluff' | 'debate' | 'debate-transition' | 'vote' | 'reveal' | 'results' | 'final-results';
export type RevealStep = 'ready' | 'votes' | 'correct' | 'bluffs';
export type RoundSetting = 'recommended' | 5 | 8 | 10 | 12;
export type QuestionMode = 'single' | 'mixed';
export type PackDifficulty = 'easy' | 'medium' | 'hard';

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
export interface Question { id: string; text: string; correctAnswer: string; packId: string; category: string; acceptedAnswers?: string[]; explanation?: string; }
export interface QuestionPack { id: string; name: string; description: string; questions: Question[]; custom?: boolean; difficulty?: PackDifficulty; }
export interface QuestionPackMeta { id: string; name: string; description: string; questionCount: number; custom: boolean; difficulty?: PackDifficulty; }
export interface CustomQuestionInput { text: string; correctAnswer: string; category: string; acceptedAnswers?: string[]; explanation?: string; }
export interface CustomPackExport { format: 'die-on-this-hill-pack'; version: 1; name: string; description: string; questions: CustomQuestionInput[]; }
export interface CustomPackStorage { usedBytes: number; maxBytes: number; }
export interface CustomPackList { packs: QuestionPack[]; storage: CustomPackStorage; }
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
  questionMode: QuestionMode;
  selectedPackIds: string[];
  selectedQuestionIds: string[];
  /** Immutable per-game snapshots so later custom-pack edits cannot change an active game. */
  selectedQuestions: Question[];
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
  questionMode: QuestionMode;
  selectedPackIds: string[];
  questionPacks: QuestionPackMeta[];
  availableQuestionCount: number;
  hostPlayerId: string;
  players: PublicPlayer[];
  question: { id: string; text: string; category: string; packId: string } | null;
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
  explanation?: string;
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
  'packs:list': (reply: Reply<CustomPackList>) => void;
  'packs:create': (payload: { name: string; description: string }, reply: Reply<QuestionPack>) => void;
  'packs:update': (payload: { packId: string; name: string; description: string }, reply: Reply<QuestionPack>) => void;
  'packs:delete': (payload: { packId: string }, reply: Reply) => void;
  'packs:question-add': (payload: { packId: string; question: CustomQuestionInput }, reply: Reply<QuestionPack>) => void;
  'packs:question-update': (payload: { packId: string; questionId: string; question: CustomQuestionInput }, reply: Reply<QuestionPack>) => void;
  'packs:question-delete': (payload: { packId: string; questionId: string }, reply: Reply<QuestionPack>) => void;
  'packs:import': (payload: { json: string }, reply: Reply<QuestionPack>) => void;
  'packs:export': (payload: { packId: string }, reply: Reply<{ filename: string; pack: CustomPackExport }>) => void;
  'game:settings': (payload: { rounds: RoundSetting }, reply: Reply) => void;
  'game:questions': (payload: { mode: QuestionMode; selectedPackIds: string[] }, reply: Reply) => void;
  'game:start': (reply: Reply) => void;
  'game:advance': (reply: Reply) => void;
  'game:skip': (reply: Reply) => void;
  'game:reset': (reply: Reply) => void;
  'answer:submit': (payload: { answer: string }, reply: Reply) => void;
  'bluff:submit': (payload: { answer: string }, reply: Reply) => void;
  'vote:submit': (payload: { answerId: string; hill: boolean }, reply: Reply) => void;
  'debate:set-ready': (payload: { ready: boolean }, reply: Reply) => void;
  'debate:end-host': (reply: Reply) => void;
  'reveal:continue': (reply: Reply) => void;
}
export interface ServerEvents { 'room:state': (state: RoomView) => void; 'display:state': (state: DisplayView) => void; 'display:closed': () => void; 'session:replaced': () => void; 'packs:changed': () => void; }
