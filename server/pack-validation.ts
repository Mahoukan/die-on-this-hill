import type { CustomQuestionInput } from '../shared/types';

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_QUESTIONS = 500;
export const LIMITS = { name: 100, description: 500, text: 300, correctAnswer: 150, category: 80, acceptedAnswer: 150, explanation: 600 } as const;

export class PackValidationError extends Error {}

export function required(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new PackValidationError(`${label} is required.`);
  const result = value.trim();
  if (result.length > max) throw new PackValidationError(`${label} must be ${max} characters or fewer.`);
  return result;
}

export function optional(value: unknown, label: string, max: number): string | undefined {
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
