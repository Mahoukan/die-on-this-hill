import type { QuestionPack } from '../../shared/types';

export const geographyPack: QuestionPack = {
  id: 'geography', name: 'Geography', description: 'Countries, cities, landmarks and the natural world', questions: [
    { id: 'geo-most-islands', text: 'Which country has the most islands in the world?', correctAnswer: 'Sweden', packId: 'geography', category: 'Geography', explanation: 'Sweden has more than 260,000 islands, more than any other country.' },
    { id: 'geo-capital-canada', text: 'What is the capital city of Canada?', correctAnswer: 'Ottawa', packId: 'geography', category: 'Capital Cities' },
    { id: 'geo-largest-ocean', text: 'What is the largest ocean on Earth?', correctAnswer: 'Pacific Ocean', acceptedAnswers: ['The Pacific', 'Pacific'], packId: 'geography', category: 'Physical Geography' },
    { id: 'geo-mount-fuji', text: 'Mount Fuji is in which country?', correctAnswer: 'Japan', packId: 'geography', category: 'Landmarks' },
    { id: 'geo-tallest-mountain', text: 'What is the tallest mountain above sea level?', correctAnswer: 'Mount Everest', acceptedAnswers: ['Everest', 'Mt Everest', 'Mt. Everest'], packId: 'geography', category: 'Physical Geography', explanation: 'Mount Everest rises 8,848.86 metres above sea level.' },
    { id: 'geo-largest-country', text: 'What is the largest country in the world by area?', correctAnswer: 'Russia', acceptedAnswers: ['Russian Federation'], packId: 'geography', category: 'Countries' },
    { id: 'geo-capital-new-zealand', text: 'What is the capital city of New Zealand?', correctAnswer: 'Wellington', packId: 'geography', category: 'Capital Cities' },
    { id: 'geo-sahara-continent', text: 'On which continent is the Sahara Desert?', correctAnswer: 'Africa', packId: 'geography', category: 'Physical Geography' },
    { id: 'geo-paris-river', text: 'Which river flows through Paris?', correctAnswer: 'Seine', acceptedAnswers: ['The Seine', 'Seine River'], packId: 'geography', category: 'Cities', explanation: 'The Seine runs through central Paris before reaching the English Channel.' },
    { id: 'geo-smallest-country', text: 'What is the smallest country in the world?', correctAnswer: 'Vatican City', acceptedAnswers: ['The Vatican', 'Vatican'], packId: 'geography', category: 'Countries', explanation: 'Vatican City covers less than half a square kilometre.' },
    { id: 'geo-great-barrier-reef', text: 'The Great Barrier Reef lies off the coast of which country?', correctAnswer: 'Australia', packId: 'geography', category: 'Landmarks' },
    { id: 'geo-andes-continent', text: 'On which continent are the Andes Mountains?', correctAnswer: 'South America', packId: 'geography', category: 'Physical Geography' },
  ],
};
