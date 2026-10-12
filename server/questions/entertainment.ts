import type { QuestionPack } from '../../shared/types';

export const entertainmentPack: QuestionPack = {
  id: 'entertainment', name: 'Movies & TV', description: 'Film, television, animation and famous franchises', questions: [
    { id: 'entertainment-toy-story-studio', text: 'Which studio made the film Toy Story?', correctAnswer: 'Pixar', acceptedAnswers: ['Pixar Animation Studios'], packId: 'entertainment', category: 'Movies', explanation: 'Toy Story was Pixar’s first feature film and the first fully computer-animated feature.' },
    { id: 'entertainment-hogwarts-sport', text: 'What sport is played on broomsticks in Harry Potter?', correctAnswer: 'Quidditch', packId: 'entertainment', category: 'Movies & Books' },
    { id: 'entertainment-friends-coffee', text: 'What is the name of the coffee shop in Friends?', correctAnswer: 'Central Perk', packId: 'entertainment', category: 'Television' },
    { id: 'entertainment-mario-brother', text: 'What is the name of Mario’s brother?', correctAnswer: 'Luigi', packId: 'entertainment', category: 'Games & Animation' },
    { id: 'entertainment-jaws-director', text: 'Who directed Jaws?', correctAnswer: 'Steven Spielberg', acceptedAnswers: ['Spielberg'], packId: 'entertainment', category: 'Movies', explanation: 'Steven Spielberg directed Jaws, released in 1975.' },
    { id: 'entertainment-wakanda-hero', text: 'Which superhero is the king of Wakanda?', correctAnswer: 'Black Panther', acceptedAnswers: ['T’Challa', "T'Challa", 'T Challa'], packId: 'entertainment', category: 'Movies' },
    { id: 'entertainment-lion-king-cub', text: 'What is the name of the lion cub in The Lion King?', correctAnswer: 'Simba', packId: 'entertainment', category: 'Animation' },
    { id: 'entertainment-dunder-mifflin', text: 'Which television comedy is set at the company Dunder Mifflin?', correctAnswer: 'The Office', acceptedAnswers: ['Office'], packId: 'entertainment', category: 'Television' },
    { id: 'entertainment-frozen-snow-queen', text: 'What is the name of the snow queen in Frozen?', correctAnswer: 'Elsa', packId: 'entertainment', category: 'Animation' },
    { id: 'entertainment-bond-code', text: 'What is James Bond’s agent number?', correctAnswer: '007', acceptedAnswers: ['Double O Seven', 'Double-O Seven'], packId: 'entertainment', category: 'Movies', explanation: 'The 00 prefix identifies Bond as an agent licensed to kill.' },
    { id: 'entertainment-stranger-things-town', text: 'What fictional Indiana town is Stranger Things set in?', correctAnswer: 'Hawkins', acceptedAnswers: ['Hawkins, Indiana', 'Hawkins Indiana'], packId: 'entertainment', category: 'Television' },
    { id: 'entertainment-nemo-fish', text: 'What type of fish is Nemo in Finding Nemo?', correctAnswer: 'Clownfish', acceptedAnswers: ['Clown fish', 'A clownfish'], packId: 'entertainment', category: 'Animation', explanation: 'Nemo and his father Marlin are ocellaris clownfish.' },
  ],
};
