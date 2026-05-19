export type Quote = {
  text: string;
  author: string;
};

export const QUOTES: Quote[] = [
  {
    text: "The best way to predict the future is to create it.",
    author: "Peter Drucker",
  },
  {
    text: "Price is what you pay. Value is what you get.",
    author: "Warren Buffett",
  },
  {
    text: "Innovation distinguishes between a leader and a follower.",
    author: "Steve Jobs",
  },
  {
    text: "Business opportunities are like buses, there's always another one coming.",
    author: "Richard Branson",
  },
  {
    text: "If you don't build your dream, someone else will hire you to help them build theirs.",
    author: "Tony Gaskins",
  },
];

export function getRandomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}
