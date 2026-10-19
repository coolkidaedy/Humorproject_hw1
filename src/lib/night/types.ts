export type Clue = { kind: 'message' | 'receipt' | 'note' | 'dispatch'; time: string; label: string; text: string };
export type GuessAttempt = { place: string; clueCount: number; correct: boolean };
export type NightState = {
  day: string; title: string; brief: string; number: number; mode: 'live' | 'practice';
  clues: Clue[]; guesses: GuessAttempt[]; revealed: number; wrong: number; finished: boolean; solved: boolean; score: number;
  answer?: string; explanation?: string; source?: string;
};
export type Story = { id: string; alias: string; title: string; body: string; votes: number; mine: boolean; voted: boolean; day: string; playable?: boolean };
export type Leader = { alias: string; points: number; nights: number; votes: number; mine: boolean };
export type Community = { stories: Story[]; leaders: Leader[]; dailyLeaders?: Leader[]; available: boolean; error?: string };
export type GameResult = { state?: NightState; error?: string; message?: string };
export type StoryCaseState = {
  storyId: string; storyTitle: string; author: string; title: string; brief: string;
  clues: Clue[]; guesses: GuessAttempt[]; revealed: number; wrong: number;
  finished: boolean; solved: boolean; score: number; answer?: string; explanation?: string;
};
export type StoryCaseResult = { state?: StoryCaseState; error?: string; message?: string };
