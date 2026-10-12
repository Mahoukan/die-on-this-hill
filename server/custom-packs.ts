import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import type { CustomPackExport, CustomQuestionInput, Question, QuestionPack, QuestionPackMeta } from '../shared/types';
import { normalizeAnswer } from './answer-matching';
import { QUESTION_PACKS } from './questions';

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_QUESTIONS = 500;
const LIMITS = { name: 100, description: 500, text: 300, correctAnswer: 150, category: 80, acceptedAnswer: 150, explanation: 600 } as const;

export class PackValidationError extends Error {}

function required(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new PackValidationError(`${label} is required.`);
  const result = value.trim();
  if (result.length > max) throw new PackValidationError(`${label} must be ${max} characters or fewer.`);
  return result;
}

function optional(value: unknown, label: string, max: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new PackValidationError(`${label} must be text.`);
  const result = value.trim();
  if (result.length > max) throw new PackValidationError(`${label} must be ${max} characters or fewer.`);
  return result || undefined;
}

export function validateQuestion(value: unknown): CustomQuestionInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PackValidationError('Each question must be an object.');
  const item = value as Record<string, unknown>;
  if (item.acceptedAnswers !== undefined && (!Array.isArray(item.acceptedAnswers) || item.acceptedAnswers.length > 50)) throw new PackValidationError('Accepted answers must be a list of no more than 50 entries.');
  const acceptedAnswers = (item.acceptedAnswers as unknown[] | undefined)?.map((answer) => required(answer, 'Accepted answer', LIMITS.acceptedAnswer));
  return {
    text: required(item.text ?? item.question, 'Question', LIMITS.text),
    correctAnswer: required(item.correctAnswer, 'Correct answer', LIMITS.correctAnswer),
    category: required(item.category ?? 'Custom', 'Category', LIMITS.category),
    ...(acceptedAnswers?.length ? { acceptedAnswers: [...new Set(acceptedAnswers)] } : {}),
    ...(optional(item.explanation, 'Explanation', LIMITS.explanation) ? { explanation: optional(item.explanation, 'Explanation', LIMITS.explanation) } : {}),
  };
}

function normalizedQuestion(text: string): string { return normalizeAnswer(text); }
function assertNoDuplicate(questions: readonly Pick<Question, 'id' | 'text'>[], question: CustomQuestionInput, exceptId?: string): void {
  if (questions.some((item) => item.id !== exceptId && normalizedQuestion(item.text) === normalizedQuestion(question.text))) throw new PackValidationError('That question already exists in this pack.');
}
function safeSlug(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'pack';
}
function clonePack(pack: QuestionPack): QuestionPack { return { ...pack, questions: pack.questions.map((question) => ({ ...question, acceptedAnswers: question.acceptedAnswers ? [...question.acceptedAnswers] : undefined })) }; }

export class PackRegistry {
  private custom = new Map<string, QuestionPack>();
  readonly directory: string;

  constructor(directory = join(process.cwd(), 'data', 'custom-packs')) {
    this.directory = resolve(directory);
    mkdirSync(this.directory, { recursive: true });
    this.reload();
  }

  reload(): void {
    this.custom.clear();
    for (const filename of readdirSync(this.directory).filter((name) => name.endsWith('.json'))) {
      try {
        const raw = JSON.parse(readFileSync(join(this.directory, basename(filename)), 'utf8')) as unknown;
        const pack = this.validateStored(raw);
        if (this.isBuiltIn(pack.id) || this.custom.has(pack.id)) throw new PackValidationError(`Duplicate pack ID ${pack.id}.`);
        this.custom.set(pack.id, pack);
      } catch (error) { console.error(`Skipping invalid custom pack ${filename}:`, error instanceof Error ? error.message : error); }
    }
  }

  all(): QuestionPack[] { return [...QUESTION_PACKS.map(clonePack), ...[...this.custom.values()].map(clonePack)]; }
  metadata(): QuestionPackMeta[] { return this.all().map(({ id, name, description, questions, custom }) => ({ id, name, description, questionCount: questions.length, custom: custom === true })); }
  customPacks(): QuestionPack[] { return [...this.custom.values()].map(clonePack); }
  has(id: string): boolean { return this.isBuiltIn(id) || this.custom.has(id); }
  get(id: string): QuestionPack | undefined { const pack = QUESTION_PACKS.find((item) => item.id === id) ?? this.custom.get(id); return pack ? clonePack(pack) : undefined; }
  eligible(packIds: readonly string[]): Question[] { const selected = new Set(packIds); const unique = new Map<string, Question>(); for (const pack of this.all()) if (selected.has(pack.id)) for (const question of pack.questions) unique.set(question.id, question); return [...unique.values()]; }
  question(id: string): Question | undefined { for (const pack of this.all()) { const question = pack.questions.find((item) => item.id === id); if (question) return { ...question, acceptedAnswers: question.acceptedAnswers ? [...question.acceptedAnswers] : undefined }; } }

  create(nameValue: unknown, descriptionValue: unknown): QuestionPack {
    const name = required(nameValue, 'Pack name', LIMITS.name); const description = optional(descriptionValue, 'Description', LIMITS.description) ?? '';
    const base = `custom-${safeSlug(name)}`; let id = base; let suffix = 2; while (this.has(id)) id = `${base}-${suffix++}`;
    const pack: QuestionPack = { id, name, description, custom: true, questions: [] };
    this.save(pack); return clonePack(pack);
  }
  update(packId: unknown, nameValue: unknown, descriptionValue: unknown): QuestionPack {
    const pack = this.mutable(packId); pack.name = required(nameValue, 'Pack name', LIMITS.name); pack.description = optional(descriptionValue, 'Description', LIMITS.description) ?? ''; this.save(pack); return clonePack(pack);
  }
  delete(packId: unknown): void { const pack = this.mutable(packId); rmSync(this.pathFor(pack.id)); this.custom.delete(pack.id); }
  addQuestion(packId: unknown, input: unknown): QuestionPack {
    const pack = this.mutable(packId); if (pack.questions.length >= MAX_QUESTIONS) throw new PackValidationError(`A pack can contain at most ${MAX_QUESTIONS} questions.`);
    const value = validateQuestion(input); assertNoDuplicate(pack.questions, value); const question: Question = { id: `${pack.id}-q-${randomUUID()}`, packId: pack.id, ...value }; pack.questions.push(question); this.save(pack); return clonePack(pack);
  }
  updateQuestion(packId: unknown, questionId: unknown, input: unknown): QuestionPack {
    const pack = this.mutable(packId); if (typeof questionId !== 'string') throw new PackValidationError('Invalid question ID.'); const index = pack.questions.findIndex((item) => item.id === questionId); if (index < 0) throw new PackValidationError('Question not found.');
    const value = validateQuestion(input); assertNoDuplicate(pack.questions, value, questionId); pack.questions[index] = { id: questionId, packId: pack.id, ...value }; this.save(pack); return clonePack(pack);
  }
  deleteQuestion(packId: unknown, questionId: unknown): QuestionPack { const pack = this.mutable(packId); if (typeof questionId !== 'string' || !pack.questions.some((item) => item.id === questionId)) throw new PackValidationError('Question not found.'); pack.questions = pack.questions.filter((item) => item.id !== questionId); this.save(pack); return clonePack(pack); }

  import(json: unknown): QuestionPack {
    if (typeof json !== 'string') throw new PackValidationError('Choose a JSON pack file.');
    if (Buffer.byteLength(json, 'utf8') > MAX_IMPORT_BYTES) throw new PackValidationError('Pack files must be 2 MB or smaller.');
    let raw: unknown; try { raw = JSON.parse(json); } catch { throw new PackValidationError('The selected file is not valid JSON.'); }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new PackValidationError('The pack must be a JSON object.');
    const value = raw as Record<string, unknown>;
    if (value.format !== undefined && value.format !== 'die-on-this-hill-pack') throw new PackValidationError('This is not a Die on This Hill pack.');
    if (value.version !== undefined && value.version !== 1) throw new PackValidationError('This pack version is not supported.');
    if (!Array.isArray(value.questions)) throw new PackValidationError('The pack must include a questions array.');
    if (value.questions.length > MAX_QUESTIONS) throw new PackValidationError(`Imported packs can contain at most ${MAX_QUESTIONS} questions.`);
    const originalName = required(value.name, 'Pack name', LIMITS.name); let name = originalName; let suffix = 2; const names = new Set(this.customPacks().map((pack) => pack.name.toLocaleLowerCase('en'))); while (names.has(name.toLocaleLowerCase('en'))) name = `${originalName} (${suffix++})`;
    const description = optional(value.description, 'Description', LIMITS.description) ?? '';
    const validated: CustomQuestionInput[] = []; for (const item of value.questions) { const question = validateQuestion(item); if (validated.some((existing) => normalizedQuestion(existing.text) === normalizedQuestion(question.text))) throw new PackValidationError('That question already exists in this pack.'); validated.push(question); }
    const base = `custom-${safeSlug(name)}`; let id = base; let idSuffix = 2; while (this.has(id)) id = `${base}-${idSuffix++}`;
    const pack: QuestionPack = { id, name, description, custom: true, questions: validated.map((question) => ({ id: `${id}-q-${randomUUID()}`, packId: id, ...question })) };
    this.save(pack); return clonePack(pack);
  }
  export(packId: unknown): { filename: string; pack: CustomPackExport } {
    const source = this.mutable(packId); return { filename: `${safeSlug(source.name)}.doth-pack.json`, pack: { format: 'die-on-this-hill-pack', version: 1, name: source.name, description: source.description, questions: source.questions.map(({ text, correctAnswer, category, acceptedAnswers, explanation }) => ({ text, correctAnswer, category, ...(acceptedAnswers?.length ? { acceptedAnswers: [...acceptedAnswers] } : {}), ...(explanation ? { explanation } : {}) })) } };
  }

  private isBuiltIn(id: string): boolean { return QUESTION_PACKS.some((pack) => pack.id === id); }
  private mutable(packId: unknown): QuestionPack { if (typeof packId === 'string' && this.isBuiltIn(packId)) throw new PackValidationError('Built-in packs are read-only.'); if (typeof packId !== 'string' || !/^custom-[a-z0-9-]+$/.test(packId)) throw new PackValidationError('Invalid custom pack ID.'); const pack = this.custom.get(packId); if (!pack) throw new PackValidationError('Custom pack not found.'); return pack; }
  private pathFor(id: string): string { if (!/^custom-[a-z0-9-]+$/.test(id)) throw new PackValidationError('Invalid custom pack ID.'); const path = resolve(this.directory, `${id}.json`); if (!path.startsWith(`${this.directory}${process.platform === 'win32' ? '\\' : '/'}`)) throw new PackValidationError('Invalid custom pack path.'); return path; }
  private save(pack: QuestionPack): void { const target = this.pathFor(pack.id); const temporary = `${target}.${randomUUID()}.tmp`; try { writeFileSync(temporary, `${JSON.stringify(pack, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' }); renameSync(temporary, target); this.custom.set(pack.id, pack); } catch (error) { if (existsSync(temporary)) rmSync(temporary); throw error; } }
  private validateStored(value: unknown): QuestionPack {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PackValidationError('Stored pack must be an object.'); const raw = value as Record<string, unknown>; const id = required(raw.id, 'Pack ID', 100); if (!/^custom-[a-z0-9-]+$/.test(id)) throw new PackValidationError('Stored pack ID is unsafe.'); if (raw.custom !== true || !Array.isArray(raw.questions) || raw.questions.length > MAX_QUESTIONS) throw new PackValidationError('Stored pack schema is invalid.');
    const questions: Question[] = []; for (const item of raw.questions) { if (!item || typeof item !== 'object') throw new PackValidationError('Stored question is invalid.'); const record = item as Record<string, unknown>; const question = validateQuestion(record); const questionId = required(record.id, 'Question ID', 160); if (!questionId.startsWith(`${id}-q-`) || record.packId !== id) throw new PackValidationError('Stored question IDs are invalid.'); assertNoDuplicate(questions, question); questions.push({ id: questionId, packId: id, ...question }); }
    return { id, name: required(raw.name, 'Pack name', LIMITS.name), description: optional(raw.description, 'Description', LIMITS.description) ?? '', custom: true, questions };
  }
}
