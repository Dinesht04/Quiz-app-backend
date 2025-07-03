import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const PORT = 8080;

const wss = new WebSocketServer({ port: PORT });
console.log(`WebSocket server started on ws://localhost:${PORT}`);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper function to remove Markdown code block fencing
function stripMarkdownCodeBlock(text: string) {
  if (text.startsWith('```json') && text.endsWith('```')) {
    // Remove '```json\n' from the beginning and '\n```' from the end
    return text
      .substring('```json\n'.length, text.length - '\n```'.length)
      .trim();
  }
  // If it's not a markdown code block, return as is (or throw an error if strict)
  return text.trim();
}

async function CallGemini(topic: string) {
  const prompt = `Topic is ${topic}. Generate a multiple-choice quiz about the mentioned topic. The quiz should consist of exactly 5 questions. Each question must have 4 distinct options, with only one correct answer. The output must be a JSON array of objects. Each object should represent a question and have the following keys:
        - "id": (string) A unique identifier for the question (e.g., "q1", "q2", "q3").
        - "prompt": (string) The text of the question.
        - "options": (array of strings) An array containing exactly 4 possible answers.
        - "correct": (string) The exact text of the correct answer, which must be one of the options.
        IMPORTANT: Respond with ONLY the JSON array, do NOT wrap it in markdown code blocks or any other text.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  });

  if (!response.text) {
    throw new Error('Gemini API error: No text content in response.');
  }

  // Strip the markdown fencing before parsing
  const jsonString = stripMarkdownCodeBlock(response.text);

  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('Failed to parse JSON from Gemini response:', e);
    console.error('Raw response text:', response.text);
    console.error('Stripped JSON string attempted to parse:', jsonString);
    throw new Error(
      'Error parsing Gemini response: Invalid JSON format after stripping markdown.',
    );
  }
}

let userCount = 0;

type Question = {
  id: string;
  prompt: string;
  options: string[];
  correct: string; // this is kept server-side only
};

type QuizRoom = {
  clients: Set<WebSocket>;
  host: WebSocket;
  questions: Question[] | null;
  scores: Map<WebSocket, { username: string; score: number }> | null;
  answered: Map<WebSocket, Set<string>> | null; // tracks which question IDs user has answered
  state: 'waiting' | 'in-progress' | 'ended';
  clientInfo: Map<WebSocket, { name: string }>;
};

type message = {
  type: string;
  payload: {
    message?: string;
    roomId: string | number;
    username: string;
    expires: Date;
    topic: string;
    QuestionId?: string;
    Answer?: string;
  };
};

const rooms: { [roomId: string]: QuizRoom } = {};

function removeClientFromRooms(ws: WebSocket) {
  for (const roomId in rooms) {
    const room = rooms[roomId];
    if (room.clients.has(ws)) {
      room.clients.delete(ws);
      room.clientInfo.delete(ws);
      console.log(`Removed client from room ${roomId}`);

      // Optionally notify others
      const clientList = Array.from(room.clientInfo.values()).map(
        (client) => client.name,
      );
      room.clients.forEach((socket) => {
        socket.send(
          JSON.stringify({
            type: 'client-list',
            payload: clientList,
          }),
        );
      });

      // Delete the room if empty
      if (room.clients.size === 0) {
        delete rooms[roomId];
        console.log(`Deleted empty room ${roomId}`);
      }

      break; // A client can only be in one room
    }
  }
}

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected!');
  userCount++;
  ws.on('message', async (message) => {
    const msgStr: string = message.toString();
    const msg: message = JSON.parse(msgStr);

    const expires = msg.payload.expires;
    const roomId = msg.payload.roomId;

    if (new Date(expires) > new Date()) {
      console.log('BRo is autheticated');
    }

    if (new Date(expires) < new Date()) {
      console.log('BRo is not autheticated');
      ws.close(); // or reject auth
      return;
    }

    if (msg.type === 'join') {
      var username = msg.payload.username;

      if (!rooms[roomId]) {
        rooms[roomId] = {
          clients: new Set<WebSocket>([ws]),
          host: ws,
          questions: null,
          scores: new Map(),
          answered: null, // tracks which question IDs user has answered
          state: 'waiting',
          clientInfo: new Map([[ws, { name: username }]]),
        };
        console.log(
          `USer joined but didnt exist, so Created new room: ${roomId}`,
        );
      } else {
        rooms[roomId].clients.add(ws); // Add socket to the room
        rooms[roomId].clientInfo.set(ws, { name: username });
        console.log(username, ' Joined room', roomId);
      }
      const clientList = Array.from(rooms[roomId].clientInfo.values()).map(
        (client) => client.name,
      );

      rooms[roomId].clients.forEach((socket) => {
        socket.send(
          JSON.stringify({
            type: 'client-list',
            payload: clientList,
          }),
        );
      });
    }

    if (msg.type === 'message') {
      var username = msg.payload.username;

      const Messagepayload = {
        type: 'message',
        payload: {
          message: msg.payload.message,
          username: msg.payload.username,
        },
      };
      rooms[roomId].clients.forEach((socket) => {
        socket.readyState === WebSocket.OPEN
          ? socket.send(JSON.stringify(Messagepayload))
          : null;
      });
    }

    if (msg.type === 'leave') {
      removeClientFromRooms(ws);
      ws.send(
        JSON.stringify({
          type: 'leave',
          status: 'successful',
        }),
      );
    }

    //ROOM STARTING
    if (msg.type === 'start') {
      try {
        if (rooms[roomId].host !== ws) {
          const message = {
            type: 'unauthorised',
            payload: {
              message: 'Only the host can start the quiz',
            },
          };

          ws.send(JSON.stringify(message));
        } else {
          // const geminiResponse : Question[] = await CallGemini(msg.payload.topic);
          // console.log(geminiResponse)
          const dummyResponse = [
            {
              id: 'q1',
              prompt: 'Which HTML tag is used to define an unordered list?',
              options: ['<ul>', '<ol>', '<li>', '<list>'],
              correct: '<ul>',
            },
            {
              id: 'q2',
              prompt: 'What does CSS stand for?',
              options: [
                'Computer Style Sheets',
                'Cascading Style Sheets',
                'Creative Styling System',
                'Colorful Style Syntax',
              ],
              correct: 'Cascading Style Sheets',
            },
            {
              id: 'q3',
              prompt:
                'Which HTTP method is typically used to retrieve data from a server?',
              options: ['GET', 'POST', 'PUT', 'DELETE'],
              correct: 'GET',
            },
            {
              id: 'q4',
              prompt:
                'Which JavaScript function is used to write content to the web page?',
              options: [
                'console.log()',
                'document.write()',
                'window.alert()',
                'print()',
              ],
              correct: 'document.write()',
            },
            {
              id: 'q5',
              prompt: 'What is the default port for HTTP?',
              options: ['80', '443', '21', '3306'],
              correct: '80',
            },
          ];

          rooms[roomId].questions = dummyResponse;
          rooms[roomId].state = 'in-progress';

          const payload = {
            type: 'questions',
            payload: dummyResponse,
          };

          rooms[roomId].clients.forEach((socket) => {
            socket.readyState === WebSocket.OPEN
              ? socket.send(JSON.stringify(payload))
              : null;
          });
          console.log('ROom started');
        }
      } catch (err) {
        console.log('Error in gemini response', err);
      }
    }
    //CHECKING QUIZ ANSWER
    if (msg.type === 'answer') {
      const QuestionId = msg.payload.QuestionId;
      const Answer = msg.payload.Answer;
      const username = msg.payload.username;

      const question = rooms[roomId].questions?.find(
        (q) => q.id === QuestionId,
      );
      if (question) {
        const isCorrect = question.correct === Answer;
        if (isCorrect) {
          const payload = {
            type: 'answer',
            payload: {
              QuestionId: QuestionId,
              Correct: true,
            },
          };
          ws.send(JSON.stringify(payload));

          console.log('Correct ans:', Answer);
          const currentScore = rooms[roomId].scores?.get(ws)?.score;
          if (!currentScore) {
            rooms[roomId].scores?.set(ws, { username: username, score: 1 });
          } else {
            rooms[roomId].scores?.set(ws, {
              username: username,
              score: currentScore + 1,
            });
          }
        } else {
          const payload = {
            type: 'answer',
            payload: {
              QuestionId: QuestionId,
              Correct: false,
            },
          };
          ws.send(JSON.stringify(payload));
          console.log('InCorrect ans:', Answer);
        }
      } else {
        console.error('Question not found.');
      }
    }

    if (msg.type === 'finish') {
      console.log('qUIZ FINISHED for user');

      if (rooms[roomId].scores) {
        const scoreList: { username: string; score: number }[] = [];

        rooms[roomId].scores?.forEach((score) => {
          scoreList.push({ username: score.username, score: score.score });
        });
        console.log(scoreList);
        ws.send(
          JSON.stringify({
            type: 'score',
            payload: scoreList,
          }),
        );
      } else {
        ws.send(
          JSON.stringify({
            type: 'error',
            payload: {
              message: 'No Scores available for this room',
            },
          }),
        );
      }
    }
  });

  // Event listener for when the connection with this specific client is closed.
  ws.on('close', () => {
    removeClientFromRooms(ws);
    console.log('Client disconnected.');
  });

  // Event listener for any errors that occur with this specific client connection.
  ws.on('error', (error: Error) => {
    removeClientFromRooms(ws);
    console.error(`WebSocket error for client: ${error.message}`);
  });
});

// Optional: Event listener for any errors on the server itself (e.g., port in use).
wss.on('error', (error: Error) => {
  console.error(`Server error: ${error.message}`);
});

console.log('Waiting for connections...');
