import { TAROT_DATA, type TarotResult } from './analysis';

/** Returns n randomly shuffled cards from the Major Arcana. */
export function shuffleCards(n: number): TarotResult[] {
  const arr = [...TAROT_DATA];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}
