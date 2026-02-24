export type GameState = 'LOBBY' | 'READING' | 'QUESTION' | 'REVEAL' | 'LEADERBOARD' | 'FINAL_RESULTS';

export interface Question {
  id: number;
  text: string;
  options: string[];
  correctAnswer: number;
}

export interface Player {
  id: string;
  name: string;
  avatar?: string;
  score: number;
  lastScoreChange: number;
  currentAnswer: number | null;
  hasChangedAnswer: boolean;
  answerTime: number | null;
  isHost: boolean;
}

export interface GameData {
  state: GameState;
  currentQuestionIndex: number;
  questions: Question[];
  players: Record<string, Player>;
  timer: number;
}

export interface ServerToClientEvents {
  gameUpdate: (data: GameData) => void;
  answerFeedback: (data: { correct: boolean; points: number; reason: string }) => void;
}

export interface ClientToServerEvents {
  join: (name: string, isHost?: boolean, avatar?: string) => void;
  submitAnswer: (answerIndex: number) => void;
  hostStartGame: () => void;
  hostNextQuestion: () => void;
  hostResetGame: () => void;
}
