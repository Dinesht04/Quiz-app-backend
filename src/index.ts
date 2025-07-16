import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { message, Question, QuizRoom } from './types';
import { CallGemini } from './gemini';
import { removeClientFromRooms } from './RemoveClientFromRoom';

dotenv.config();

var express = require('express')

const app = express();
var expressWs = require('express-ws')(app);

export const rooms: { [roomId: string]: QuizRoom } = {};

let userCount = 0;


// @ts
const PORT: number = parseInt(<string>process.env.PORT, 10) || 3000

app.get('/', function(req: any, res: Response) {
  console.log('--- Request Details ---');

  // General Request Information
  console.log(`Received a ${req.method} request for ${req.originalUrl}`);
  console.log(`Protocol: ${req.protocol}`);
  console.log(`Hostname: ${req.hostname}`);

  // Client's IP Address
  // If behind a proxy, ensure 'trust proxy' is set for accurate IP
  console.log(`Client IP: ${req.ip}`);

  // Request Headers
  console.log('\n--- Headers ---');
  console.log(`User-Agent: ${req.headers['user-agent']}`);
  console.log(`Referer: ${req.headers['referer'] || 'Direct access or Referer header not present'}`);

  // For applications behind a proxy
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    console.log(`X-Forwarded-For: ${forwardedFor}`);
  }

  console.log('---------------------\n');
});


app.ws('/', function(ws :WebSocket, req:any) {

  console.log('--- Request Details ---');

  // General Request Information
  console.log(`Received a ${req.method} request for ${req.originalUrl}`);
  console.log(`Protocol: ${req.protocol}`);
  console.log(`Hostname: ${req.hostname}`);

  // Client's IP Address
  // If behind a proxy, ensure 'trust proxy' is set for accurate IP
  console.log(`Client IP: ${req.ip}`);

  // Request Headers
  console.log('\n--- Headers ---');
  console.log(`User-Agent: ${req.headers['user-agent']}`);
  console.log(`Referer: ${req.headers['referer'] || 'Direct access or Referer header not present'}`);

  // For applications behind a proxy
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    console.log(`X-Forwarded-For: ${forwardedFor}`);
  }

  console.log('---------------------\n');

  ws.on('open',(ws: WebSocket)=>{
    console.log('Client connected!');
    userCount++;
  })

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
      const username = msg.payload.username;

      if (!rooms[roomId]) {
        rooms[roomId] = {
          clients: new Set<WebSocket>([ws]),
          host: { username: username, Websocket: ws },
          questions: null,
          scores: new Map(),
          answered: new Map([[username, 0]]), // tracks which question IDs user has answered
          state: 'waiting',
          clientInfo: new Map([[ws, { name: username }]]),
        };
        console.log(
          `USer joined but didnt exist, so Created new room: ${roomId}`,
        );
        ws.send(
          JSON.stringify({
            type: 'join',
            status: 'successful',
            host: true,
          }),
        );
      } else {
        rooms[roomId].clients.add(ws); // Add socket to the room
        rooms[roomId].clientInfo.set(ws, { name: username });
        rooms[roomId].answered.set(username, 0);

        console.log(username, ' Joined room', roomId);
        ws.send(
          JSON.stringify({
            type: 'join',
            status: 'successful',
            host: false,
          }),
        );
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
      const username = msg.payload.username;

      const Messagepayload = {
        type: 'message',
        payload: {
          message: msg.payload.message,
          username: username,
          time: msg.payload.time,
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
        if (rooms[roomId].host.Websocket !== ws) {
          const message = {
            type: 'unauthorised',
            payload: {
              message: 'Only the host can start the quiz',
            },
          };

          ws.send(JSON.stringify(message));
        } else {
          const difficulty = msg.payload.difficulty;
          const geminiResponse: Question[] = await CallGemini(
            msg.payload.topic,
            difficulty,
          );
          console.log(geminiResponse);

          rooms[roomId].questions = geminiResponse;
          rooms[roomId].state = 'in-progress';

          const payload = {
            type: 'questions',
            payload: geminiResponse,
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

      let currentScore = rooms[roomId].scores?.get(ws)?.score;

      if (!currentScore) {
        rooms[roomId].scores?.set(ws, { username: username, score: 0 });
        currentScore = 0;
      }
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
          rooms[roomId].scores?.set(ws, {
            username: username,
            score: currentScore + 1,
          });
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

        let questionsAnswered = rooms[roomId].answered.get(username);

        if (!questionsAnswered) {
          questionsAnswered = 0;
        }

        rooms[roomId].answered.set(username, questionsAnswered + 1);

        console.log(Array.from(rooms[roomId].answered.entries()));
        const liveScore = Array.from(rooms[roomId].answered.entries());
        rooms[roomId].clients.forEach((socket) => {
          socket.send(
            JSON.stringify({
              type: 'live-score',
              payload: {
                liveScore: liveScore,
              },
            }),
          );
        });
      } else {
        console.error('Question not found.');
      }
    }

    if (msg.type === 'finish') {
      console.log('qUIZ FINISHED for user');

      if (rooms[roomId].scores) {
        let over = true;

        for (const score of rooms[roomId].answered) {
          if (score[1] < 5) {
            over = false;
            break;
          }
        }

        if (over) {
          const finalScoreList: { username: string; score: number }[] = [];

          rooms[roomId].scores?.forEach((score) => {
            finalScoreList.push({
              username: score.username,
              score: score.score,
            });
          });

          rooms[roomId].clients.forEach((socket) => {
            socket.send(
              JSON.stringify({
                type: 'final-score',
                payload: {
                  finalScores: finalScoreList,
                },
              }),
            );
          });

          rooms[roomId].state = 'ended';
        }
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
  })

  
});

app.listen(PORT,()=>{
  console.log('Listening on PORT:',PORT)
});



