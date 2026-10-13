import { normalizeAnswer } from '../server/answer-matching';
import { ALL_QUESTIONS, QUESTION_PACKS } from '../server/questions';

const names = new Map<string, string>();
const ids = new Set<string>();
for (const pack of QUESTION_PACKS) {
  if (ids.has(pack.id)) throw new Error(`Duplicate built-in pack ID: ${pack.id}`);
  ids.add(pack.id);
  const name = pack.name.toLocaleLowerCase('en');
  const previous = names.get(name);
  if (previous) console.warn(`Built-in display name collision: ${previous} and ${pack.id} (${pack.name}). Both retained.`);
  names.set(name, pack.id);
}
const questions = new Map<string, string>();
const questionIds = new Set<string>();
for (const question of ALL_QUESTIONS) {
  if (questionIds.has(question.id)) throw new Error(`Duplicate built-in question ID: ${question.id}`);
  questionIds.add(question.id);
  const text = normalizeAnswer(question.text);
  const previous = questions.get(text);
  if (previous) console.warn(`Repeated question wording in ${previous} and ${question.packId}: ${question.text}`);
  questions.set(text, question.packId);
}
console.log(`Validated ${QUESTION_PACKS.length} built-in packs with ${ALL_QUESTIONS.length} questions.`);
