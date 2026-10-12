export type GamePhase = 'lobby' | 'answer' | 'bluff' | 'debate' | 'vote' | 'reveal' | 'results';
export type RevealStep = 'ready' | 'votes' | 'correct' | 'bluffs';

export interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  hillUsed: boolean;
  connected: boolean;
}

export interface Question {
  id: string;
  text: string;
  correctAnswer: string;
}

export interface PlayerSubmission {
  playerId: string;
  genuineAnswer: string | null;
  bluff: string | null;
}

export interface AnswerOption {
  id: string;
  text: string;
  isCorrect: boolean;
  genuinePlayerIds: string[];
  bluffPlayerIds: string[];
}

export interface PlayerVote {
  playerId: string;
  answerId: string;
  hill: boolean;
}

export interface RoundResult {
  playerId: string;
  finalAnswerPoints: number;
  bluffPoints: number;
  roundPoints: number;
  totalScore: number;
  hill: boolean;
  correct: boolean;
}

/** Server-only model: never send this object directly to a browser. */
export interface GameRoom {
  roomCode: string;
  phase: GamePhase;
  revealStep: RevealStep;
  round: number;
  totalRounds: number;
  hostPlayerId: string;
  players: Player[];
  question: Question | null;
  submissions: PlayerSubmission[];
  answerPool: AnswerOption[];
  votes: PlayerVote[];
  results: RoundResult[];
  phaseEndsAt: number | null;
}

export interface PublicAnswer {
  id: string;
  text: string;
  // These fields are omitted until their synchronized reveal step.
  voterIds?: string[];
  isCorrect?: boolean;
  genuinePlayerIds?: string[];
  bluffPlayerIds?: string[];
}

/** Deliberate allowlist projection; contains no secrets or premature answer origins. */
export interface RoomView {
  roomCode: string;
  phase: GamePhase;
  revealStep: RevealStep;
  round: number;
  totalRounds: number;
  hostPlayerId: string;
  players: Player[];
  question: { id: string; text: string } | null;
  answerPool: PublicAnswer[];
  phaseEndsAt: number | null;
  serverNow: number;
  answeredCount: number;
  bluffCount: number;
  votedCount: number;
  hillPlayerIds: string[];
  correctAnswer?: string;
  results: RoundResult[];
  me: {
    id: string;
    genuineAnswer: string | null;
    bluff: string | null;
    vote: PlayerVote | null;
  };
}

export interface PlayerSession {
  roomCode: string;
  playerId: string;
  reconnectToken: string;
}

export type Ack<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export type Reply<T = undefined> = (result: Ack<T>) => void;
export interface ClientEvents {
  'room:create': (payload: { name: string }, reply: Reply<PlayerSession>) => void;
  'room:join': (payload: { name: string; roomCode: string }, reply: Reply<PlayerSession>) => void;
  'room:reconnect': (payload: PlayerSession, reply: Reply<PlayerSession>) => void;
  'room:leave': (reply: Reply) => void;
  'game:start': (reply: Reply) => void;
  'game:reset': (reply: Reply) => void;
  'answer:submit': (payload: { answer: string }, reply: Reply) => void;
  'bluff:submit': (payload: { answer: string }, reply: Reply) => void;
  'vote:submit': (payload: { answerId: string; hill: boolean }, reply: Reply) => void;
  'reveal:continue': (reply: Reply) => void;
}

export interface ServerEvents {
  'room:state': (state: RoomView) => void;
  'session:replaced': () => void;
}
