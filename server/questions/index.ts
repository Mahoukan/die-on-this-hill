import { randomInt } from 'node:crypto';
import type { Question, QuestionPack, QuestionPackMeta } from '../../shared/types';
import { entertainmentPack } from './entertainment';
import { foodCulturePack } from './food-culture';
import { generalPack } from './general';
import { geographyPack } from './geography';
import { historyPack } from './history';
import { scienceTechnologyPack } from './science-technology';

export const QUESTION_PACKS: readonly QuestionPack[] = [generalPack, scienceTechnologyPack, geographyPack, historyPack, entertainmentPack, foodCulturePack];
export const QUESTION_PACK_METADATA: QuestionPackMeta[] = QUESTION_PACKS.map(({ id, name, description, questions }) => ({ id, name, description, questionCount: questions.length, custom: false }));
export const ALL_QUESTIONS: readonly Question[] = QUESTION_PACKS.flatMap((pack) => pack.questions);

export function eligibleQuestions(packIds: readonly string[]): Question[] {
  const selected = new Set(packIds);
  const unique = new Map<string, Question>();
  for (const question of ALL_QUESTIONS) if (selected.has(question.packId)) unique.set(question.id, question);
  return [...unique.values()];
}

export function selectQuestions(count: number, packIds: readonly string[]): Question[] {
  const shuffled = eligibleQuestions(packIds).map((question) => ({ ...question, acceptedAnswers: question.acceptedAnswers ? [...question.acceptedAnswers] : undefined }));
  if (count > shuffled.length) throw new Error('Not enough questions for the selected game setup.');
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled.slice(0, count);
}

export function questionById(id: string): Question {
  const question = ALL_QUESTIONS.find((item) => item.id === id);
  if (!question) throw new Error(`Unknown question: ${id}`);
  return { ...question, acceptedAnswers: question.acceptedAnswers ? [...question.acceptedAnswers] : undefined };
}

export function isValidPackId(id: string): boolean { return QUESTION_PACKS.some((pack) => pack.id === id); }
