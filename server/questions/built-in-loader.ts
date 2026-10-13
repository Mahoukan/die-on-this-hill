import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CustomQuestionInput, QuestionPack } from '../../shared/types';
import { LIMITS, MAX_QUESTIONS, optional, required, validateQuestion } from '../pack-validation';

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const SOURCE_DIRECTORY = fileURLToPath(new URL('../../packs/', import.meta.url));

function slug(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function displayName(value: unknown, filename: string, difficulty: string): string {
  const fallback = basename(filename, '.json').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const name = value === undefined ? fallback : required(value, 'Pack name', LIMITS.name);
  // The folder is authoritative, including when the authored label differs.
  const base = name.replace(/^(?:(?:easy|medium|hard)\s*-\s*)+/i, '')
    .replace(/(?:\s*-\s*(?:easy|medium|hard)|\s*\((?:easy|medium|hard)\))+$/i, '')
    .replace(/:\s*/g, ' ').trim();
  if (!base) throw new Error('Pack name must include a base name.');
  return `${base} - ${difficulty[0].toUpperCase()}${difficulty.slice(1)}`;
}

function authoredQuestion(value: unknown): CustomQuestionInput {
  const validated = validateQuestion(value);
  const raw = value as Record<string, unknown>;
  // Reuse the import schema checks without trimming or rewriting authored answers.
  return {
    text: (raw.text ?? raw.question) as string,
    correctAnswer: raw.correctAnswer as string,
    category: (raw.category ?? validated.category) as string,
    ...(Array.isArray(raw.acceptedAnswers) ? { acceptedAnswers: [...raw.acceptedAnswers] as string[] } : {}),
    ...(typeof raw.explanation === 'string' ? { explanation: raw.explanation } : {}),
  };
}

export function loadBuiltInPacks(directory = SOURCE_DIRECTORY): QuestionPack[] {
  const packs: QuestionPack[] = [];
  const ids = new Set<string>();
  for (const difficulty of DIFFICULTIES) {
    const folder = join(directory, difficulty);
    let filenames: string[];
    try {
      filenames = readdirSync(folder, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => entry.name).sort();
      if (!filenames.length) throw new Error('Expected at least one JSON pack.');
    } catch (error) {
      throw new Error(`Cannot load built-in packs from ${folder}: ${error instanceof Error ? error.message : error}`);
    }
    for (const filename of filenames) {
      const path = join(folder, filename);
      try {
        const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('The pack must be a JSON object.');
        const value = raw as Record<string, unknown>;
        if (value.format !== undefined && value.format !== 'die-on-this-hill-pack') throw new Error('This is not a Die on This Hill pack.');
        if (value.version !== undefined && value.version !== 1) throw new Error('This pack version is not supported.');
        if (!Array.isArray(value.questions) || !value.questions.length || value.questions.length > MAX_QUESTIONS) {
          throw new Error(`The pack must include between 1 and ${MAX_QUESTIONS} questions.`);
        }
        const stem = slug(basename(filename, '.json'));
        if (!stem) throw new Error('Filename must contain letters or numbers for a safe pack ID.');
        const id = `builtin-${difficulty}-${stem}`;
        if (ids.has(id)) throw new Error(`Duplicate built-in pack ID ${id}; rename the colliding source file.`);
        ids.add(id);
        const questionIds = new Set<string>();
        const questions = value.questions.map((item, index) => {
          try {
            const question = authoredQuestion(item);
            // Content IDs survive reordering and insertions. Distinct authored variants remain distinct.
            const questionId = `${id}-q-${createHash('sha256').update(JSON.stringify(question)).digest('hex')}`;
            if (questionIds.has(questionId)) throw new Error('Identical question already exists in this pack.');
            questionIds.add(questionId);
            return { id: questionId, packId: id, ...question };
          } catch (error) {
            throw new Error(`Question ${index + 1}: ${error instanceof Error ? error.message : error}`);
          }
        });
        packs.push({ id, name: displayName(value.name, filename, difficulty),
          description: optional(value.description, 'Description', LIMITS.description) ?? '', custom: false, questions });
      } catch (error) {
        throw new Error(`Invalid built-in pack ${path}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
  return packs;
}
