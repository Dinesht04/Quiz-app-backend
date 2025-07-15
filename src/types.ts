import { WebSocket } from 'ws';

export type Question = {
  id: string;
  prompt: string;
  options: string[];
  correct: string; // this is kept server-side only
};

export type username = string;
export type questionsAnswered = number;

export type QuizRoom = {
  clients: Set<WebSocket>;
  host: { Websocket: WebSocket; username: string };
  questions: Question[] | null;
  scores: Map<WebSocket, { username: string; score: number }> | null;
  answered: Map<username, questionsAnswered>; // tracks which question IDs user has answered
  state: 'waiting' | 'in-progress' | 'ended';
  clientInfo: Map<WebSocket, { name: string }>;
};

export type message = {
  type: string;
  payload: {
    message?: string;
    roomId: string | number;
    username: string;
    expires: Date;
    topic: string;
    QuestionId?: string;
    Answer?: string;
    time?: string;
    difficulty: string | number;
  };
};
