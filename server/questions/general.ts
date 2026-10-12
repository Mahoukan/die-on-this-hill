import type { QuestionPack } from '../../shared/types';

export const generalPack: QuestionPack = {
  id: 'general', name: 'General Knowledge', description: 'A bit of everything', questions: [
    { id: 'general-octopus-hearts', text: 'How many hearts does an octopus have?', correctAnswer: 'Three', acceptedAnswers: ['3'], packId: 'general', category: 'General Knowledge', explanation: 'Two hearts pump blood to the gills, while the third pumps it around the body.' },
    { id: 'general-chess-pieces', text: 'How many pieces does each player start with in chess?', correctAnswer: '16', acceptedAnswers: ['Sixteen'], packId: 'general', category: 'General Knowledge' },
    { id: 'general-largest-mammal', text: 'What is the largest mammal on Earth?', correctAnswer: 'Blue whale', acceptedAnswers: ['The blue whale'], packId: 'general', category: 'General Knowledge', explanation: 'Blue whales can grow to around 30 metres long.' },
    { id: 'general-japan-currency', text: 'What is the currency of Japan?', correctAnswer: 'Yen', acceptedAnswers: ['Japanese yen'], packId: 'general', category: 'General Knowledge' },
    { id: 'general-1984-author', text: 'Who wrote the novel 1984?', correctAnswer: 'George Orwell', acceptedAnswers: ['Orwell'], packId: 'general', category: 'General Knowledge', explanation: 'George Orwell published the dystopian novel in 1949.' },
    { id: 'general-piano-keys', text: 'How many keys are on a standard modern piano?', correctAnswer: '88', acceptedAnswers: ['Eighty-eight'], packId: 'general', category: 'General Knowledge' },
    { id: 'general-continents', text: 'How many continents are commonly recognised?', correctAnswer: 'Seven', acceptedAnswers: ['7'], packId: 'general', category: 'General Knowledge' },
    { id: 'general-smallest-prime', text: 'What is the smallest prime number?', correctAnswer: '2', acceptedAnswers: ['Two'], packId: 'general', category: 'General Knowledge', explanation: 'Two is also the only even prime number.' },
    { id: 'general-roman-fifty', text: 'Which Roman numeral represents 50?', correctAnswer: 'L', packId: 'general', category: 'General Knowledge' },
    { id: 'general-brazil-language', text: 'What is the official language of Brazil?', correctAnswer: 'Portuguese', packId: 'general', category: 'General Knowledge', explanation: 'Brazil is the largest Portuguese-speaking country in the world.' },
    { id: 'general-olympic-rings', text: 'How many rings are on the Olympic flag?', correctAnswer: 'Five', acceptedAnswers: ['5'], packId: 'general', category: 'General Knowledge' },
    { id: 'general-honey-maker', text: 'Which insect produces honey?', correctAnswer: 'Honey bee', acceptedAnswers: ['Bee', 'Bees', 'Honeybee'], packId: 'general', category: 'General Knowledge', explanation: 'Honey bees make honey from flower nectar and store it in the hive.' },
  ],
};
