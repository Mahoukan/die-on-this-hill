import type { QuestionPack } from '../../shared/types';

export const historyPack: QuestionPack = {
  id: 'history', name: 'History', description: 'Events, people, dates and civilisations', questions: [
    { id: 'history-moon-landing-year', text: 'In what year did humans first land on the Moon?', correctAnswer: '1969', packId: 'history', category: 'Modern History', explanation: 'Apollo 11 landed on the Moon on 20 July 1969.' },
    { id: 'history-titanic-year', text: 'In what year did the Titanic sink?', correctAnswer: '1912', packId: 'history', category: 'Modern History' },
    { id: 'history-magna-carta-country', text: 'In which country was the Magna Carta sealed?', correctAnswer: 'England', acceptedAnswers: ['United Kingdom', 'UK'], packId: 'history', category: 'Medieval History', explanation: 'King John sealed the Magna Carta at Runnymede in 1215.' },
    { id: 'history-printing-press', text: 'Who is credited with introducing the movable-type printing press to Europe?', correctAnswer: 'Johannes Gutenberg', acceptedAnswers: ['Gutenberg'], packId: 'history', category: 'Inventions' },
    { id: 'history-first-us-president', text: 'Who was the first president of the United States?', correctAnswer: 'George Washington', acceptedAnswers: ['Washington'], packId: 'history', category: 'Political History' },
    { id: 'history-berlin-wall-fell', text: 'In what year did the Berlin Wall fall?', correctAnswer: '1989', packId: 'history', category: 'Modern History', explanation: 'Border crossings opened on 9 November 1989.' },
    { id: 'history-pyramids-civilisation', text: 'Which ancient civilisation built the pyramids at Giza?', correctAnswer: 'Ancient Egyptians', acceptedAnswers: ['Egyptians', 'Ancient Egypt'], packId: 'history', category: 'Ancient History' },
    { id: 'history-world-war-two-end', text: 'In what year did the Second World War end?', correctAnswer: '1945', acceptedAnswers: ['Nineteen forty-five'], packId: 'history', category: 'Modern History' },
    { id: 'history-joan-of-arc', text: 'Joan of Arc fought for which country?', correctAnswer: 'France', packId: 'history', category: 'Medieval History' },
    { id: 'history-renaissance-origin', text: 'In which country did the Renaissance begin?', correctAnswer: 'Italy', packId: 'history', category: 'Cultural History', explanation: 'The Renaissance began in Italian city-states before spreading across Europe.' },
    { id: 'history-aztec-capital', text: 'What was the capital city of the Aztec Empire?', correctAnswer: 'Tenochtitlan', packId: 'history', category: 'Ancient History' },
    { id: 'history-pompeii-volcano', text: 'Which volcano destroyed Pompeii in AD 79?', correctAnswer: 'Mount Vesuvius', acceptedAnswers: ['Vesuvius', 'Mt Vesuvius', 'Mt. Vesuvius'], packId: 'history', category: 'Ancient History', explanation: 'The eruption buried Pompeii under volcanic ash and pumice.' },
  ],
};
