import type { Question } from '../shared/types';

export function normalizeAnswer(value: string): string {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase('en')
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function isAcceptedAnswer(question: Question, value: string): boolean {
  const normalized = normalizeAnswer(value);
  return [question.correctAnswer, ...(question.acceptedAnswers || [])].some((answer) => normalizeAnswer(answer) === normalized);
}
