export const GENRES = [
  { key: 'literary',   label: 'Literary Fiction',    emoji: '📖' },
  { key: 'mystery',    label: 'Mystery & Thriller',  emoji: '🔍' },
  { key: 'scifi',      label: 'Sci-Fi & Fantasy',    emoji: '🚀' },
  { key: 'historical', label: 'Historical Fiction',  emoji: '🏰' },
  { key: 'biography',  label: 'Biography & Memoir',  emoji: '👤' },
  { key: 'science',    label: 'Science & Nature',    emoji: '🌿' },
  { key: 'essays',     label: 'Essays',              emoji: '✍️' },
  { key: 'poetry',     label: 'Poetry',              emoji: '🪶' },
  { key: 'selfhelp',   label: 'Self-Help',           emoji: '💚' },
  { key: 'history',    label: 'History',             emoji: '⏳' },
  { key: 'philosophy', label: 'Philosophy',          emoji: '💭' },
  { key: 'humor',      label: 'Humor',               emoji: '😄' },
]

export interface CuratedBook {
  id: string
  title: string
  author: string
  isbn: string
  genres: string[]
}

export const CURATED_BOOKS: CuratedBook[] = [
  // Literary Fiction
  { id: 'isbn:9780571334650', title: 'Normal People',                  author: 'Sally Rooney',          isbn: '9780571334650', genres: ['literary'] },
  { id: 'isbn:9780679731726', title: 'The Remains of the Day',         author: 'Kazuo Ishiguro',        isbn: '9780679731726', genres: ['literary'] },
  { id: 'isbn:9780804172707', title: 'A Little Life',                  author: 'Hanya Yanagihara',      isbn: '9780804172707', genres: ['literary'] },
  { id: 'isbn:9781455563920', title: 'Pachinko',                       author: 'Min Jin Lee',           isbn: '9781455563920', genres: ['literary', 'historical'] },
  { id: 'isbn:9780525522133', title: 'My Year of Rest and Relaxation', author: 'Ottessa Moshfegh',      isbn: '9780525522133', genres: ['literary'] },
  { id: 'isbn:9781400031702', title: 'The Secret History',             author: 'Donna Tartt',           isbn: '9781400031702', genres: ['literary', 'mystery'] },

  // Mystery & Thriller
  { id: 'isbn:9780307588371', title: 'Gone Girl',                      author: 'Gillian Flynn',         isbn: '9780307588371', genres: ['mystery'] },
  { id: 'isbn:9780307454546', title: 'The Girl with the Dragon Tattoo',author: 'Stieg Larsson',         isbn: '9780307454546', genres: ['mystery'] },
  { id: 'isbn:9780143113492', title: 'In the Woods',                   author: 'Tana French',           isbn: '9780143113492', genres: ['mystery'] },
  { id: 'isbn:9780399167065', title: 'Big Little Lies',                author: 'Liane Moriarty',        isbn: '9780399167065', genres: ['mystery'] },
  { id: 'isbn:9780062073488', title: 'And Then There Were None',       author: 'Agatha Christie',       isbn: '9780062073488', genres: ['mystery'] },

  // Sci-Fi & Fantasy
  { id: 'isbn:9780765382030', title: 'The Three-Body Problem',         author: 'Liu Cixin',             isbn: '9780765382030', genres: ['scifi'] },
  { id: 'isbn:9780593135204', title: 'Project Hail Mary',              author: 'Andy Weir',             isbn: '9780593135204', genres: ['scifi'] },
  { id: 'isbn:9781635575644', title: 'Piranesi',                       author: 'Susanna Clarke',        isbn: '9781635575644', genres: ['scifi', 'literary'] },
  { id: 'isbn:9781524759780', title: 'Recursion',                      author: 'Blake Crouch',          isbn: '9781524759780', genres: ['scifi'] },
  { id: 'isbn:9780441478125', title: 'The Left Hand of Darkness',      author: 'Ursula K. Le Guin',    isbn: '9780441478125', genres: ['scifi'] },
  { id: 'isbn:9780345391803', title: "The Hitchhiker's Guide",         author: 'Douglas Adams',         isbn: '9780345391803', genres: ['scifi', 'humor'] },

  // Historical Fiction
  { id: 'isbn:9780312429980', title: 'Wolf Hall',                      author: 'Hilary Mantel',         isbn: '9780312429980', genres: ['historical'] },
  { id: 'isbn:9780156001311', title: 'The Name of the Rose',           author: 'Umberto Eco',           isbn: '9780156001311', genres: ['historical', 'mystery'] },
  { id: 'isbn:9781476746586', title: 'All the Light We Cannot See',    author: 'Anthony Doerr',         isbn: '9781476746586', genres: ['historical'] },
  { id: 'isbn:9781250080400', title: 'The Nightingale',                author: 'Kristin Hannah',        isbn: '9781250080400', genres: ['historical'] },
  { id: 'isbn:9780812985405', title: 'Lincoln in the Bardo',           author: 'George Saunders',       isbn: '9780812985405', genres: ['historical', 'literary'] },

  // Biography & Memoir
  { id: 'isbn:9780399590504', title: 'Educated',                       author: 'Tara Westover',         isbn: '9780399590504', genres: ['biography'] },
  { id: 'isbn:9780743247542', title: 'The Glass Castle',               author: 'Jeannette Walls',       isbn: '9780743247542', genres: ['biography'] },
  { id: 'isbn:9780812993547', title: 'Between the World and Me',       author: 'Ta-Nehisi Coates',      isbn: '9780812993547', genres: ['biography', 'essays'] },
  { id: 'isbn:9780812988406', title: 'When Breath Becomes Air',        author: 'Paul Kalanithi',        isbn: '9780812988406', genres: ['biography'] },
  { id: 'isbn:9780735223530', title: 'Know My Name',                   author: 'Chanel Miller',         isbn: '9780735223530', genres: ['biography'] },

  // Science & Nature
  { id: 'isbn:9780062316097', title: 'Sapiens',                        author: 'Yuval Noah Harari',     isbn: '9780062316097', genres: ['science', 'history'] },
  { id: 'isbn:9780198788607', title: 'The Selfish Gene',               author: 'Richard Dawkins',       isbn: '9780198788607', genres: ['science'] },
  { id: 'isbn:9781571313560', title: 'Braiding Sweetgrass',            author: 'Robin Wall Kimmerer',   isbn: '9781571313560', genres: ['science'] },
  { id: 'isbn:9780767908184', title: 'A Short History of Nearly Everything', author: 'Bill Bryson',    isbn: '9780767908184', genres: ['science'] },
  { id: 'isbn:9781324001805', title: 'Why We Sleep',                   author: 'Matthew Walker',        isbn: '9781324001805', genres: ['science', 'selfhelp'] },

  // Essays
  { id: 'isbn:9780316156110', title: 'Consider the Lobster',           author: 'David Foster Wallace',  isbn: '9780316156110', genres: ['essays'] },
  { id: 'isbn:9780807006238', title: 'Notes of a Native Son',          author: 'James Baldwin',         isbn: '9780807006238', genres: ['essays'] },
  { id: 'isbn:9780062282712', title: 'Bad Feminist',                   author: 'Roxane Gay',            isbn: '9780062282712', genres: ['essays'] },
  { id: 'isbn:9780374522865', title: 'The White Album',                author: 'Joan Didion',           isbn: '9780374522865', genres: ['essays'] },

  // Poetry
  { id: 'isbn:9781449486792', title: 'The Sun and Her Flowers',        author: 'Rupi Kaur',             isbn: '9781449486792', genres: ['poetry'] },
  { id: 'isbn:9781449474256', title: 'Milk and Honey',                 author: 'Rupi Kaur',             isbn: '9781449474256', genres: ['poetry'] },
  { id: 'isbn:9781555976903', title: 'Citizen: An American Lyric',     author: 'Claudia Rankine',       isbn: '9781555976903', genres: ['poetry'] },
  { id: 'isbn:9780374533557', title: 'Leaves of Grass',                author: 'Walt Whitman',          isbn: '9780374533557', genres: ['poetry'] },

  // Self-Help
  { id: 'isbn:9780735211292', title: 'Atomic Habits',                  author: 'James Clear',           isbn: '9780735211292', genres: ['selfhelp'] },
  { id: 'isbn:9780143127741', title: 'The Body Keeps the Score',       author: 'Bessel van der Kolk',   isbn: '9780143127741', genres: ['selfhelp'] },
  { id: 'isbn:9780807014295', title: "Man's Search for Meaning",       author: 'Viktor Frankl',         isbn: '9780807014295', genres: ['selfhelp', 'philosophy'] },
  { id: 'isbn:9781501156700', title: 'Thinking, Fast and Slow',        author: 'Daniel Kahneman',       isbn: '9781501156700', genres: ['selfhelp', 'science'] },

  // History
  { id: 'isbn:9781631492228', title: 'SPQR',                           author: 'Mary Beard',            isbn: '9781631492228', genres: ['history'] },
  { id: 'isbn:9780345476098', title: 'The Guns of August',             author: 'Barbara Tuchman',       isbn: '9780345476098', genres: ['history'] },
  { id: 'isbn:9780375725609', title: 'The Devil in the White City',    author: 'Erik Larson',           isbn: '9780375725609', genres: ['history', 'mystery'] },
  { id: 'isbn:9781400032051', title: '1491',                           author: 'Charles Mann',          isbn: '9781400032051', genres: ['history'] },

  // Philosophy
  { id: 'isbn:9780812968255', title: 'Meditations',                    author: 'Marcus Aurelius',       isbn: '9780812968255', genres: ['philosophy'] },
  { id: 'isbn:9780679720201', title: 'The Stranger',                   author: 'Albert Camus',          isbn: '9780679720201', genres: ['philosophy', 'literary'] },
  { id: 'isbn:9780374530716', title: "Sophie's World",                 author: 'Jostein Gaarder',       isbn: '9780374530716', genres: ['philosophy'] },
  { id: 'isbn:9780060589469', title: 'Zen and the Art of Motorcycle Maintenance', author: 'Robert Pirsig', isbn: '9780060589469', genres: ['philosophy'] },

  // Humor
  { id: 'isbn:9780060853983', title: 'Good Omens',                     author: 'Pratchett & Gaiman',    isbn: '9780060853983', genres: ['humor', 'scifi'] },
  { id: 'isbn:9780316056878', title: 'Bossypants',                     author: 'Tina Fey',              isbn: '9780316056878', genres: ['humor', 'biography'] },
  { id: 'isbn:9780307886279', title: 'Is Everyone Hanging Out Without Me?', author: 'Mindy Kaling',    isbn: '9780307886279', genres: ['humor', 'biography'] },
  { id: 'isbn:9780062268341', title: 'Yes Please',                     author: 'Amy Poehler',           isbn: '9780062268341', genres: ['humor', 'biography'] },
]
