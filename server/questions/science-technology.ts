import type { QuestionPack } from '../../shared/types';

export const scienceTechnologyPack: QuestionPack = {
  id: 'science-technology', name: 'Science & Technology', description: 'Science, computers, space and inventions', questions: [
    { id: 'science-red-planet', text: 'Which planet is known as the Red Planet?', correctAnswer: 'Mars', packId: 'science-technology', category: 'Space', explanation: 'Iron minerals in Martian soil oxidise, giving the surface its reddish colour.' },
    { id: 'science-gold-symbol', text: 'What is the chemical symbol for gold?', correctAnswer: 'Au', packId: 'science-technology', category: 'Chemistry' },
    { id: 'science-human-bones', text: 'How many bones are in the average adult human body?', correctAnswer: '206', acceptedAnswers: ['Two hundred and six'], packId: 'science-technology', category: 'Biology' },
    { id: 'science-world-wide-web', text: 'Who invented the World Wide Web?', correctAnswer: 'Tim Berners-Lee', acceptedAnswers: ['Tim Berners Lee', 'Berners-Lee', 'Berners Lee'], packId: 'science-technology', category: 'Technology', explanation: 'Tim Berners-Lee proposed the Web at CERN in 1989.' },
    { id: 'science-binary-digits', text: 'Which two digits are used in binary code?', correctAnswer: '0 and 1', acceptedAnswers: ['Zero and one', '1 and 0', 'One and zero'], packId: 'science-technology', category: 'Computing' },
    { id: 'science-largest-planet', text: 'What is the largest planet in our solar system?', correctAnswer: 'Jupiter', packId: 'science-technology', category: 'Space', explanation: 'Jupiter is more than twice as massive as all the other planets combined.' },
    { id: 'science-water-formula', text: 'What is the chemical formula for water?', correctAnswer: 'H2O', acceptedAnswers: ['H₂O'], packId: 'science-technology', category: 'Chemistry' },
    { id: 'science-speed-light', text: 'Approximately how fast does light travel in a vacuum, in kilometres per second?', correctAnswer: '300,000 km/s', acceptedAnswers: ['300000 km/s', '300,000 kilometres per second', '300000 kilometres per second'], packId: 'science-technology', category: 'Physics', explanation: 'The exact speed is 299,792,458 metres per second.' },
    { id: 'science-telephone-inventor', text: 'Who is commonly credited with inventing the telephone?', correctAnswer: 'Alexander Graham Bell', acceptedAnswers: ['Graham Bell', 'Bell'], packId: 'science-technology', category: 'Inventions' },
    { id: 'science-dna-shape', text: 'What shape is the structure of DNA commonly called?', correctAnswer: 'Double helix', acceptedAnswers: ['A double helix'], packId: 'science-technology', category: 'Biology', explanation: 'DNA consists of two strands twisted around each other in a double helix.' },
    { id: 'science-first-iphone', text: 'In what year was the first iPhone released?', correctAnswer: '2007', packId: 'science-technology', category: 'Technology' },
    { id: 'science-photosynthesis-pigment', text: 'Which green pigment allows plants to absorb light for photosynthesis?', correctAnswer: 'Chlorophyll', packId: 'science-technology', category: 'Biology', explanation: 'Chlorophyll absorbs light most strongly in the blue and red parts of the spectrum.' },
  ],
};
