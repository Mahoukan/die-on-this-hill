import { randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import type { AnswerOption, CustomPackExport, CustomQuestionInput, DisplayView, GamePhase, GameRoom, Player, PlayerSession, PlayerStats, Question, QuestionMode, QuestionPack, RoomView, RoundSetting } from '../shared/types';
import { buildLeaderboard, calculateAwards } from './awards';
import { isAcceptedAnswer, normalizeAnswer } from './answer-matching';
import { PackRegistry, PackValidationError } from './custom-packs';
import { scoreRound } from './scoring';
import { DEFAULT_PACK_ID } from './questions';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DURATIONS = { answer: 30_000, bluff: 30_000, debate: 60_000, 'debate-transition': 3_000, vote: 15_000 };
const ROOM_IDLE_MS = 10 * 60_000;
const ROUND_SETTINGS: readonly RoundSetting[] = ['recommended', 5, 8, 10, 12];
export const recommendedRounds = (players: number) => players >= 8 ? 5 : players >= 6 ? 6 : players >= 4 ? 8 : 10;
export const emptyStats = (): PlayerStats => ({ correctInitialAnswers: 0, correctFinalAnswers: 0, wrongFinalAnswers: 0, successfulBluffVotes: 0, answerChanges: 0, changedWrongToCorrect: 0, changedCorrectToWrong: 0, hillUsed: false, hillSuccessful: false, hillScoreImpact: 0 });

interface Identity { token: string; socketId: string | null }
interface RoomRecord { room: GameRoom; identities: Map<string, Identity>; timer?: ReturnType<typeof setTimeout>; cleanup?: ReturnType<typeof setTimeout>; hostTransfer?: ReturnType<typeof setTimeout>; }

export class GameError extends Error {}
function requireRule(condition: unknown, message: string): asserts condition { if (!condition) throw new GameError(message); }

export class RoomStore {
  private rooms = new Map<string, RoomRecord>();
  private durations: Partial<Record<GamePhase, number>>;
  constructor(private changed: (roomCode: string) => void, durations: Partial<Record<GamePhase, number>> = {}, private removed: (roomCode: string) => void = () => {}, readonly packs = new PackRegistry()) { this.durations = { ...DURATIONS, ...durations }; }

  private record(code: string): RoomRecord {
    const record = this.rooms.get(code);
    if (!record) throw new GameError('Room does not exist. Check the code or create a new game.');
    return record;
  }
  getRoom(code: string): GameRoom { return this.record(code).room; }
  private name(value: unknown): string { requireRule(typeof value === 'string' && value.trim().length > 0, 'Enter your display name.'); requireRule(value.trim().length <= 24, 'Use a name of 24 characters or fewer.'); return value.trim(); }
  private text(value: unknown): string { requireRule(typeof value === 'string' && value.trim().length > 0, 'Enter an answer before locking it in.'); requireRule(value.trim().length <= 80, 'Keep your answer to 80 characters or fewer.'); return value.trim(); }
  private code(value: unknown): string { requireRule(typeof value === 'string' && /^[A-Z]{4}$/.test(value.trim().toUpperCase()), 'Room codes use four letters.'); return value.trim().toUpperCase(); }
  private refreshRecommended(room: GameRoom): void { if (room.roundSetting === 'recommended') room.totalRounds = recommendedRounds(room.players.filter((player) => player.connected).length); }

  create(name: unknown, socketId: string): PlayerSession {
    const displayName = this.name(name);
    requireRule(this.rooms.size < 500, 'The server is full. Try again later.');
    let code: string;
    do { code = Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(''); } while (this.rooms.has(code));
    const room: GameRoom = { roomCode: code, phase: 'lobby', revealStep: 'ready', round: 0, totalRounds: 10, roundSetting: 'recommended', questionMode: 'single', selectedPackIds: [DEFAULT_PACK_ID], selectedQuestionIds: [], selectedQuestions: [], hostPlayerId: '', players: [], question: null, submissions: [], answerPool: [], votes: [], results: [], roundResults: [], debateReadyPlayerIds: [], phaseEndsAt: null };
    this.rooms.set(code, { room, identities: new Map() });
    const session = this.addPlayer(code, displayName, socketId);
    room.hostPlayerId = session.playerId;
    room.players[0].isHost = true;
    return session;
  }
  join(code: unknown, name: unknown, socketId: string): PlayerSession {
    const record = this.record(this.code(code));
    requireRule(record.room.phase === 'lobby', 'This game has already started.');
    requireRule(record.room.players.length < 12, 'This room is full (12 players maximum).');
    return this.addPlayer(record.room.roomCode, this.name(name), socketId);
  }
  private addPlayer(code: string, name: string, socketId: string): PlayerSession {
    const record = this.record(code);
    requireRule(!record.room.players.some((player) => player.name.toLocaleLowerCase('en') === name.toLocaleLowerCase('en')), 'That name is already taken in this room.');
    const id = randomUUID();
    const token = randomUUID();
    record.room.players.push({ id, name, score: 0, isHost: false, hillUsed: false, connected: true, stats: emptyStats() });
    if (!record.room.players.some((player) => player.id === record.room.hostPlayerId)) { record.room.hostPlayerId = id; record.room.players.find((player) => player.id === id)!.isHost = true; }
    record.identities.set(id, { token, socketId });
    clearTimeout(record.cleanup);
    this.refreshRecommended(record.room);
    return { roomCode: code, playerId: id, reconnectToken: token };
  }
  reconnect(session: PlayerSession, socketId: string): string | null {
    requireRule(session && typeof session === 'object', 'Your session is missing. Join the room again.');
    const record = this.record(this.code(session.roomCode));
    const identity = record.identities.get(session.playerId);
    requireRule(identity && typeof session.reconnectToken === 'string', 'Your session was not found. Join the room again.');
    const supplied = Buffer.from(session.reconnectToken); const expected = Buffer.from(identity.token);
    requireRule(supplied.length === expected.length && timingSafeEqual(supplied, expected), 'Your session could not be restored. Join the room again.');
    const oldSocket = identity.socketId;
    identity.socketId = socketId;
    record.room.players.find((player) => player.id === session.playerId)!.connected = true;
    if (record.room.phase === 'lobby') this.refreshRecommended(record.room);
    if (record.room.hostPlayerId === session.playerId) clearTimeout(record.hostTransfer);
    clearTimeout(record.cleanup);
    this.expireIfNeeded(record);
    return oldSocket;
  }
  activeSocket(code: string, playerId: string): string | null { return this.record(code).identities.get(playerId)?.socketId ?? null; }
  private member(record: RoomRecord, playerId: string, socketId: string): Player { const player = record.room.players.find((item) => item.id === playerId); requireRule(player && record.identities.get(playerId)?.socketId === socketId, 'Reconnect to your room before taking an action.'); return player; }
  private authorized(code: string, id: string, socketId: string, phase: GamePhase): { record: RoomRecord; player: Player } { const record = this.record(code); const player = this.member(record, id, socketId); this.expireIfNeeded(record); requireRule(record.room.phase === phase, 'That phase has ended. Your screen will update automatically.'); return { record, player }; }
  private host(record: RoomRecord, playerId: string): void { requireRule(record.room.hostPlayerId === playerId, 'Only the host can do that.'); }

  settings(code: string, id: string, socketId: string, rounds: unknown): void {
    const { record } = this.authorized(code, id, socketId, 'lobby');
    this.host(record, id);
    requireRule(ROUND_SETTINGS.includes(rounds as RoundSetting), 'Choose a valid game length.');
    record.room.roundSetting = rounds as RoundSetting;
    record.room.totalRounds = rounds === 'recommended' ? recommendedRounds(record.room.players.filter((player) => player.connected).length) : rounds as number;
    this.changed(code);
  }
  questionSettings(code: string, id: string, socketId: string, mode: unknown, packIds: unknown): void {
    const { record } = this.authorized(code, id, socketId, 'lobby');
    this.host(record, id);
    requireRule(mode === 'single' || mode === 'mixed', 'Choose Single Pack or Mixed Game.');
    requireRule(Array.isArray(packIds) && packIds.every((packId) => typeof packId === 'string'), 'Choose valid question packs.');
    const selectedPackIds = [...new Set(packIds as string[])];
    requireRule(selectedPackIds.every((packId) => this.packs.has(packId)), 'One or more selected question packs do not exist.');
    requireRule(mode !== 'single' || selectedPackIds.length === 1, 'Choose one question pack.');
    record.room.questionMode = mode as QuestionMode;
    record.room.selectedPackIds = selectedPackIds;
    this.changed(code);
  }
  start(code: string, id: string, socketId: string): void {
    const { record } = this.authorized(code, id, socketId, 'lobby');
    this.host(record, id);
    requireRule(record.room.players.filter((player) => player.connected).length >= 2, 'You need at least two connected players to start.');
    requireRule(record.room.questionMode !== 'mixed' || record.room.selectedPackIds.length >= 2, 'Choose at least two packs for a Mixed Game.');
    record.room.players = record.room.players.filter((player) => player.connected);
    for (const playerId of record.identities.keys()) if (!record.room.players.some((player) => player.id === playerId)) record.identities.delete(playerId);
    this.refreshRecommended(record.room);
    const available = this.packs.eligible(record.room.selectedPackIds).length;
    requireRule(available >= record.room.totalRounds, `Not enough questions for ${record.room.totalRounds} rounds. Choose more question packs or reduce the number of rounds.`);
    const questions = this.shuffle(this.packs.eligible(record.room.selectedPackIds)).slice(0, record.room.totalRounds);
    record.room.selectedQuestionIds = questions.map((question) => question.id);
    record.room.selectedQuestions = questions.map((question) => this.cloneQuestion(question));
    record.room.roundResults = [];
    record.room.players.forEach((player) => { player.score = 0; player.hillUsed = false; player.stats = emptyStats(); });
    record.room.round = 1;
    this.prepareRound(record);
  }
  advanceGame(code: string, id: string, socketId: string): void {
    const { record } = this.authorized(code, id, socketId, 'results');
    this.host(record, id);
    if (record.room.round >= record.room.totalRounds) this.setPhase(record, 'final-results');
    else { record.room.round += 1; this.prepareRound(record); }
  }
  private prepareRound(record: RoomRecord): void {
    const room = record.room;
    room.question = this.cloneQuestion(room.selectedQuestions[room.round - 1]);
    room.submissions = room.players.map((player) => ({ playerId: player.id, genuineAnswer: null, bluff: null }));
    room.answerPool = []; room.votes = []; room.results = []; room.debateReadyPlayerIds = []; room.revealStep = 'ready';
    this.setPhase(record, 'answer');
  }
  reset(code: string, id: string, socketId: string): void {
    const { record } = this.authorized(code, id, socketId, 'final-results');
    this.host(record, id);
    Object.assign(record.room, { round: 0, question: null, selectedQuestionIds: [], selectedQuestions: [], submissions: [], answerPool: [], votes: [], results: [], roundResults: [], debateReadyPlayerIds: [], revealStep: 'ready' });
    record.room.players.forEach((player) => { player.score = 0; player.hillUsed = false; player.stats = emptyStats(); });
    this.refreshRecommended(record.room);
    this.sanitizeSelection(record.room);
    this.setPhase(record, 'lobby');
  }
  submit(code: string, id: string, socketId: string, phase: 'answer' | 'bluff', value: unknown): void {
    const { record } = this.authorized(code, id, socketId, phase); const answer = this.text(value); const submission = record.room.submissions.find((item) => item.playerId === id)!; const field = phase === 'answer' ? 'genuineAnswer' : 'bluff';
    if (submission[field] !== null) { requireRule(submission[field] === answer, 'Your answer is already locked.'); return; }
    submission[field] = answer;
    if (record.room.submissions.every((item) => item[field] !== null)) this.advance(record); else this.changed(code);
  }
  vote(code: string, id: string, socketId: string, answerId: unknown, hill: unknown): void {
    const { record, player } = this.authorized(code, id, socketId, 'vote');
    requireRule(typeof answerId === 'string' && record.room.answerPool.some((option) => option.id === answerId), 'Choose an answer from the available cards.'); requireRule(typeof hill === 'boolean', 'Invalid Hill selection.');
    const previous = record.room.votes.find((item) => item.playerId === id);
    if (previous) { requireRule(previous.answerId === answerId && previous.hill === hill, 'Your vote is already locked.'); return; }
    requireRule(!hill || !player.hillUsed, 'You have already used your Hill this game.');
    record.room.votes.push({ playerId: id, answerId, hill });
    if (hill) { player.hillUsed = true; player.stats.hillUsed = true; }
    if (record.room.votes.length === record.room.players.length) this.advance(record); else this.changed(code);
  }
  setDebateReady(code: string, id: string, socketId: string, ready: unknown): void {
    const { record, player } = this.authorized(code, id, socketId, 'debate');
    requireRule(player.connected, 'Reconnect before marking yourself ready.');
    requireRule(typeof ready === 'boolean', 'Invalid debate readiness.');
    const ids = record.room.debateReadyPlayerIds;
    const alreadyReady = ids.includes(id);
    if (ready !== alreadyReady) {
      if (ready) ids.push(id);
      else record.room.debateReadyPlayerIds = ids.filter((playerId) => playerId !== id);
    }
    if (this.debateReadyCount(record.room) >= this.debateRequiredCount(record.room)) this.beginDebateTransition(record);
    else this.changed(code);
  }
  endDebate(code: string, id: string, socketId: string): void {
    const { record } = this.authorized(code, id, socketId, 'debate');
    this.host(record, id);
    this.beginDebateTransition(record);
  }
  private debateReadyCount(room: GameRoom): number {
    return room.players.filter((player) => player.connected && room.debateReadyPlayerIds.includes(player.id)).length;
  }
  private debateRequiredCount(room: GameRoom): number {
    return Math.floor(room.players.filter((player) => player.connected).length / 2) + 1;
  }
  private beginDebateTransition(record: RoomRecord): void {
    if (record.room.phase !== 'debate') return;
    this.setPhase(record, 'debate-transition');
  }
  reveal(code: string, id: string, socketId: string): void {
    const { record } = this.authorized(code, id, socketId, 'reveal'); this.host(record, id);
    const next = { ready: 'votes', votes: 'correct', correct: 'bluffs', bluffs: 'results' } as const; const step = next[record.room.revealStep];
    if (step === 'results') this.setPhase(record, 'results'); else { record.room.revealStep = step; this.changed(code); }
  }
  disconnect(code: string, id: string, socketId: string, leave = false): void {
    const record = this.rooms.get(code); if (!record || record.identities.get(id)?.socketId !== socketId) return;
    record.identities.get(id)!.socketId = null; const player = record.room.players.find((item) => item.id === id)!; player.connected = false;
    if (leave && record.room.phase === 'lobby') { record.room.players = record.room.players.filter((item) => item.id !== id); record.identities.delete(id); }
    if (record.room.phase === 'lobby') this.refreshRecommended(record.room);
    if (record.room.hostPlayerId === id) {
      clearTimeout(record.hostTransfer);
      const transfer = () => { if (record.room.hostPlayerId !== id || record.room.players.find((item) => item.id === id)?.connected) return; const successor = record.room.players.find((item) => item.connected); if (successor) { record.room.hostPlayerId = successor.id; record.room.players.forEach((item) => { item.isHost = item.id === successor.id; }); this.changed(code); } };
      if (leave) transfer(); else { record.hostTransfer = setTimeout(transfer, 10_000); record.hostTransfer.unref(); }
    }
    if (record.room.phase === 'debate' && this.debateReadyCount(record.room) >= this.debateRequiredCount(record.room)) this.beginDebateTransition(record);
    else this.changed(code);
    if (!record.room.players.some((item) => item.connected)) { clearTimeout(record.cleanup); record.cleanup = setTimeout(() => { clearTimeout(record.timer); clearTimeout(record.hostTransfer); this.rooms.delete(code); this.removed(code); }, ROOM_IDLE_MS); record.cleanup.unref(); }
  }
  private setPhase(record: RoomRecord, phase: GamePhase): void {
    clearTimeout(record.timer);
    record.room.phase = phase;
    if (phase === 'debate') record.room.debateReadyPlayerIds = [];
    if (!['debate', 'debate-transition'].includes(phase)) record.room.debateReadyPlayerIds = [];
    const duration = this.durations[phase] ?? null;
    const deadline = duration === null ? null : Date.now() + duration;
    record.room.phaseEndsAt = deadline;
    if (duration !== null) {
      record.timer = setTimeout(() => {
        if (record.room.phase === phase && record.room.phaseEndsAt === deadline) this.advance(record);
      }, duration);
      record.timer.unref();
    }
    this.changed(record.room.roomCode);
  }
  private expireIfNeeded(record: RoomRecord): void { if (record.room.phaseEndsAt !== null && Date.now() >= record.room.phaseEndsAt) this.advance(record); }
  private advance(record: RoomRecord): void {
    const phase = record.room.phase;
    if (phase === 'answer') this.setPhase(record, 'bluff');
    else if (phase === 'bluff') { this.buildPool(record.room); this.setPhase(record, 'debate'); }
    else if (phase === 'debate' || phase === 'debate-transition') this.setPhase(record, 'vote');
    else if (phase === 'vote') {
      const room = record.room; room.results = scoreRound(room);
      for (const result of room.results) {
        const player = room.players.find((item) => item.id === result.playerId)!; const vote = room.votes.find((item) => item.playerId === result.playerId); const submission = room.submissions.find((item) => item.playerId === result.playerId)!;
        player.score = result.totalScore; player.stats.successfulBluffVotes += result.bluffPoints / 100;
        const initialCorrect = submission.genuineAnswer !== null && isAcceptedAnswer(room.question!, submission.genuineAnswer);
        if (initialCorrect) player.stats.correctInitialAnswers += 1;
        if (vote) {
          if (result.correct) player.stats.correctFinalAnswers += 1; else player.stats.wrongFinalAnswers += 1;
          const finalOption = room.answerPool.find((item) => item.id === vote.answerId)!; const finalText = finalOption.text; const changed = submission.genuineAnswer !== null && !(finalOption.isCorrect && isAcceptedAnswer(room.question!, submission.genuineAnswer)) && normalizeAnswer(submission.genuineAnswer) !== normalizeAnswer(finalText);
          if (changed) { player.stats.answerChanges += 1; if (!initialCorrect && result.correct) player.stats.changedWrongToCorrect += 1; if (initialCorrect && !result.correct) player.stats.changedCorrectToWrong += 1; }
          if (vote.hill) { player.stats.hillSuccessful = result.correct; player.stats.hillScoreImpact += result.hillImpact; }
        }
      }
      room.roundResults.push(room.results.map((result) => ({ ...result }))); room.revealStep = 'ready'; this.setPhase(record, 'reveal');
    }
  }
  private buildPool(room: GameRoom): void {
    const options = new Map<string, AnswerOption>();
    const add = (text: string, kind: 'correct' | 'genuine' | 'bluff', id?: string) => { const displayText = kind !== 'correct' && isAcceptedAnswer(room.question!, text) ? room.question!.correctAnswer : text.trim(); const key = normalizeAnswer(displayText); let option = options.get(key); if (!option) { option = { id: randomUUID(), text: displayText, isCorrect: false, genuinePlayerIds: [], bluffPlayerIds: [] }; options.set(key, option); } if (kind === 'correct') option.isCorrect = true; else if (id) option[kind === 'genuine' ? 'genuinePlayerIds' : 'bluffPlayerIds'].push(id); };
    add(room.question!.correctAnswer, 'correct'); for (const submission of room.submissions) { if (submission.genuineAnswer) add(submission.genuineAnswer, 'genuine', submission.playerId); if (submission.bluff) add(submission.bluff, 'bluff', submission.playerId); }
    room.answerPool = [...options.values()]; for (let index = room.answerPool.length - 1; index > 0; index--) { const other = randomInt(index + 1); [room.answerPool[index], room.answerPool[other]] = [room.answerPool[other], room.answerPool[index]]; }
  }
  private publicView(room: GameRoom): DisplayView {
    const final = room.phase === 'final-results'; const revealVotes = final || room.phase === 'results' || (room.phase === 'reveal' && room.revealStep !== 'ready'); const revealCorrect = final || room.phase === 'results' || (room.phase === 'reveal' && ['correct', 'bluffs'].includes(room.revealStep)); const revealBluffs = final || room.phase === 'results' || (room.phase === 'reveal' && room.revealStep === 'bluffs');
    return {
      roomCode: room.roomCode, phase: room.phase, revealStep: room.revealStep, round: room.round, totalRounds: room.totalRounds, roundSetting: room.roundSetting, questionMode: room.questionMode, selectedPackIds: [...room.selectedPackIds], questionPacks: this.packs.metadata(), availableQuestionCount: this.packs.eligible(room.selectedPackIds).length, hostPlayerId: room.hostPlayerId,
      players: room.players.map(({ stats: _stats, ...player }) => ({ ...player, score: revealCorrect ? player.score : player.score - (room.results.find((result) => result.playerId === player.id)?.roundPoints ?? 0) })),
      question: room.question ? { id: room.question.id, text: room.question.text, category: room.question.category, packId: room.question.packId } : null,
      answerPool: room.answerPool.map((option) => ({ id: option.id, text: option.text, ...(revealVotes ? { voterIds: room.votes.filter((item) => item.answerId === option.id).map((item) => item.playerId) } : {}), ...(revealCorrect ? { isCorrect: option.isCorrect } : {}), ...(revealBluffs ? { genuinePlayerIds: [...option.genuinePlayerIds], bluffPlayerIds: [...option.bluffPlayerIds] } : {}) })),
      phaseEndsAt: room.phaseEndsAt, serverNow: Date.now(), answeredCount: room.submissions.filter((item) => item.genuineAnswer !== null).length, bluffCount: room.submissions.filter((item) => item.bluff !== null).length, votedCount: room.votes.length, hillPlayerIds: room.votes.filter((item) => item.hill).map((item) => item.playerId),
      debateReadyCount: this.debateReadyCount(room), debateRequiredCount: this.debateRequiredCount(room),
      ...(revealCorrect && room.question ? { correctAnswer: room.question.correctAnswer, ...(room.question.explanation ? { explanation: room.question.explanation } : {}) } : {}), results: revealBluffs ? room.results.map((result) => ({ ...result })) : [], leaderboard: final ? buildLeaderboard(room.players) : [], awards: final ? calculateAwards(room.players) : [],
    };
  }
  displayView(code: unknown): DisplayView {
    const record = this.record(this.code(code));
    this.expireIfNeeded(record);
    return this.publicView(record.room);
  }
  view(code: string, playerId: string): RoomView {
    const room = this.record(code).room; const submission = room.submissions.find((item) => item.playerId === playerId); const vote = room.votes.find((item) => item.playerId === playerId);
    return { ...this.publicView(room), me: { id: playerId, genuineAnswer: submission?.genuineAnswer ?? null, bluff: submission?.bluff ?? null, vote: vote ? { ...vote } : null, debateReady: room.debateReadyPlayerIds.includes(playerId) } };
  }
  listCustomPacks(): QuestionPack[] { return this.packs.customPacks(); }
  createPack(name: unknown, description: unknown): QuestionPack { return this.packAction(() => this.packs.create(name, description)); }
  updatePack(packId: unknown, name: unknown, description: unknown): QuestionPack { return this.packAction(() => this.packs.update(packId, name, description)); }
  deletePack(packId: unknown): void { this.packAction(() => this.packs.delete(packId)); }
  addPackQuestion(packId: unknown, question: CustomQuestionInput): QuestionPack { return this.packAction(() => this.packs.addQuestion(packId, question)); }
  updatePackQuestion(packId: unknown, questionId: unknown, question: CustomQuestionInput): QuestionPack { return this.packAction(() => this.packs.updateQuestion(packId, questionId, question)); }
  deletePackQuestion(packId: unknown, questionId: unknown): QuestionPack { return this.packAction(() => this.packs.deleteQuestion(packId, questionId)); }
  importPack(json: unknown): QuestionPack { return this.packAction(() => this.packs.import(json)); }
  exportPack(packId: unknown): { filename: string; pack: CustomPackExport } { try { return this.packs.export(packId); } catch (error) { throw new GameError(error instanceof Error ? error.message : 'Could not export that pack.'); } }
  private packAction<T>(action: () => T): T { try { const result = action(); this.packRegistryChanged(); return result; } catch (error) { if (error instanceof PackValidationError) throw new GameError(error.message); throw error; } }
  private packRegistryChanged(): void { for (const [code, record] of this.rooms) { if (record.room.phase === 'lobby') this.sanitizeSelection(record.room); this.changed(code); } }
  private sanitizeSelection(room: GameRoom): void { const valid = room.selectedPackIds.filter((id) => this.packs.has(id)); if (room.questionMode === 'mixed') { room.selectedPackIds = [...new Set(valid)]; return; } room.selectedPackIds = [valid[0] ?? DEFAULT_PACK_ID]; }
  private cloneQuestion(question: Question): Question { return { ...question, acceptedAnswers: question.acceptedAnswers ? [...question.acceptedAnswers] : undefined }; }
  private shuffle(questions: Question[]): Question[] { const result = questions.map((question) => this.cloneQuestion(question)); for (let index = result.length - 1; index > 0; index--) { const other = randomInt(index + 1); [result[index], result[other]] = [result[other], result[index]]; } return result; }
  close(): void { for (const record of this.rooms.values()) { clearTimeout(record.timer); clearTimeout(record.cleanup); clearTimeout(record.hostTransfer); } this.rooms.clear(); }
}
