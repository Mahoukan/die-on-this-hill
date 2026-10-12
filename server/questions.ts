import { randomInt } from 'node:crypto';
import type { Question } from '../shared/types';

export const QUESTIONS: readonly Question[] = [
  { id: 'most-islands', text: 'Which country has the most islands in the world?', correctAnswer: 'Sweden', category: 'geography' },
  { id: 'capital-canada', text: 'What is the capital city of Canada?', correctAnswer: 'Ottawa', category: 'geography' },
  { id: 'largest-ocean', text: 'What is the largest ocean on Earth?', correctAnswer: 'Pacific Ocean', category: 'geography' },
  { id: 'mount-fuji', text: 'Mount Fuji is in which country?', correctAnswer: 'Japan', category: 'geography' },
  { id: 'red-planet', text: 'Which planet is known as the Red Planet?', correctAnswer: 'Mars', category: 'science' },
  { id: 'gold-symbol', text: 'What is the chemical symbol for gold?', correctAnswer: 'Au', category: 'science' },
  { id: 'human-bones', text: 'How many bones are in the average adult human body?', correctAnswer: '206', category: 'science' },
  { id: 'largest-organ', text: 'What is the largest organ of the human body?', correctAnswer: 'Skin', category: 'science' },
  { id: 'moon-landing', text: 'In what year did humans first land on the Moon?', correctAnswer: '1969', category: 'history' },
  { id: 'magna-carta', text: 'In which country was the Magna Carta signed?', correctAnswer: 'England', category: 'history' },
  { id: 'titanic-year', text: 'In what year did the Titanic sink?', correctAnswer: '1912', category: 'history' },
  { id: 'printing-press', text: 'Who is credited with inventing the movable-type printing press in Europe?', correctAnswer: 'Johannes Gutenberg', category: 'history' },
  { id: 'toy-story-studio', text: 'Which studio made the film Toy Story?', correctAnswer: 'Pixar', category: 'entertainment' },
  { id: 'hogwarts-sport', text: 'What sport is played on broomsticks in Harry Potter?', correctAnswer: 'Quidditch', category: 'entertainment' },
  { id: 'friends-coffee', text: 'What is the name of the coffee shop in Friends?', correctAnswer: 'Central Perk', category: 'entertainment' },
  { id: 'mario-brother', text: 'What is the name of Mario’s brother?', correctAnswer: 'Luigi', category: 'entertainment' },
  { id: 'guacamole-base', text: 'What is the main ingredient in guacamole?', correctAnswer: 'Avocado', category: 'food' },
  { id: 'sushi-country', text: 'Sushi originated in which country?', correctAnswer: 'Japan', category: 'food' },
  { id: 'hummus-base', text: 'What is the main ingredient in hummus?', correctAnswer: 'Chickpeas', category: 'food' },
  { id: 'paella-country', text: 'Paella originated in which country?', correctAnswer: 'Spain', category: 'food' },
  { id: 'world-wide-web', text: 'Who invented the World Wide Web?', correctAnswer: 'Tim Berners-Lee', category: 'technology' },
  { id: 'binary-digits', text: 'Which two digits are used in binary code?', correctAnswer: '0 and 1', category: 'technology' },
  { id: 'first-iphone', text: 'In what year was the first iPhone released?', correctAnswer: '2007', category: 'technology' },
  { id: 'chess-pieces', text: 'How many pieces does each player start with in chess?', correctAnswer: '16', category: 'general knowledge' },
];

export function selectQuestions(count: number, questions: readonly Question[] = QUESTIONS): Question[] {
  if (count > questions.length) throw new Error('Not enough questions for the selected game length.');
  const shuffled = questions.map((question) => ({ ...question }));
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled.slice(0, count);
}

export function questionById(id: string): Question {
  const question = QUESTIONS.find((item) => item.id === id);
  if (!question) throw new Error(`Unknown question: ${id}`);
  return { ...question };
}
