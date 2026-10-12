import type { QuestionPack } from '../../shared/types';

export const foodCulturePack: QuestionPack = {
  id: 'food-culture', name: 'Food & Culture', description: 'Food, language, traditions and the arts', questions: [
    { id: 'culture-guacamole-base', text: 'What is the main ingredient in guacamole?', correctAnswer: 'Avocado', acceptedAnswers: ['Avocados'], packId: 'food-culture', category: 'Food' },
    { id: 'culture-sushi-country', text: 'Sushi originated in which country?', correctAnswer: 'Japan', packId: 'food-culture', category: 'Food' },
    { id: 'culture-hummus-base', text: 'What is the main ingredient in hummus?', correctAnswer: 'Chickpeas', acceptedAnswers: ['Chickpea', 'Garbanzo beans', 'Garbanzo bean'], packId: 'food-culture', category: 'Food', explanation: 'Traditional hummus blends chickpeas with tahini, lemon juice and garlic.' },
    { id: 'culture-paella-country', text: 'Paella originated in which country?', correctAnswer: 'Spain', packId: 'food-culture', category: 'Food', explanation: 'Paella originated in the Valencia region of Spain.' },
    { id: 'culture-feta-country', text: 'Feta cheese is traditionally associated with which country?', correctAnswer: 'Greece', packId: 'food-culture', category: 'Food' },
    { id: 'culture-kimchi-country', text: 'Kimchi is a traditional dish from which country?', correctAnswer: 'Korea', acceptedAnswers: ['South Korea'], packId: 'food-culture', category: 'Food', explanation: 'Kimchi is made by fermenting seasoned vegetables, most commonly cabbage.' },
    { id: 'culture-tango-country', text: 'The tango originated along the border of Argentina and which other country?', correctAnswer: 'Uruguay', packId: 'food-culture', category: 'Dance', explanation: 'Tango developed around the Río de la Plata, particularly in Buenos Aires and Montevideo.' },
    { id: 'culture-egypt-language', text: 'What is the official language of Egypt?', correctAnswer: 'Arabic', acceptedAnswers: ['Modern Standard Arabic'], packId: 'food-culture', category: 'Language' },
    { id: 'culture-tea-ceremony', text: 'The traditional tea ceremony known as chanoyu comes from which country?', correctAnswer: 'Japan', packId: 'food-culture', category: 'Traditions' },
    { id: 'culture-pesto-herb', text: 'Which herb is the main ingredient in traditional pesto?', correctAnswer: 'Basil', packId: 'food-culture', category: 'Food' },
    { id: 'culture-naan-region', text: 'Naan is a flatbread strongly associated with the cuisine of which country?', correctAnswer: 'India', acceptedAnswers: ['Indian cuisine'], packId: 'food-culture', category: 'Food' },
    { id: 'culture-day-of-dead', text: 'The Day of the Dead celebration is most strongly associated with which country?', correctAnswer: 'Mexico', packId: 'food-culture', category: 'Traditions', explanation: 'Día de los Muertos honours deceased loved ones with altars, food and celebrations.' },
  ],
};
