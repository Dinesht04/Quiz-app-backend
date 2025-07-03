import { WebSocketServer } from "ws"
import WebSocket from "ws"
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const PORT = 8080;

console.log(process.env.GEMINI_API_KEY)

const wss = new WebSocketServer({port:PORT})
console.log(`WebSocket server started on ws://localhost:${PORT}`);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper function to remove Markdown code block fencing
function stripMarkdownCodeBlock(text:string) {
    if (text.startsWith('```json') && text.endsWith('```')) {
        // Remove '```json\n' from the beginning and '\n```' from the end
        return text.substring('```json\n'.length, text.length - '\n```'.length).trim();
    }
    // If it's not a markdown code block, return as is (or throw an error if strict)
    return text.trim();
}

async function CallGemini(topic:string,difficulty:string|number) {
    const prompt = `Topic is ${topic}. Difficulty is ${difficulty}. Difficulty ranges from 1-5. 1 being easiest and 5 being Impossible. Generate a multiple-choice quiz about the mentioned topic. The quiz should consist of exactly 5 questions. Each question must have 4 distinct options, with only one correct answer. The output must be a JSON array of objects. Each object should represent a question and have the following keys:
        - "id": (string) A unique identifier for the question (e.g., "q1", "q2", "q3").
        - "prompt": (string) The text of the question.
        - "options": (array of strings) An array containing exactly 4 possible answers.
        - "correct": (string) The exact text of the correct answer, which must be one of the options.
        IMPORTANT: Respond with ONLY the JSON array, do NOT wrap it in markdown code blocks or any other text.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    if (!response.text) { 
        throw new Error("Gemini API error: No text content in response.");
    }

    // Strip the markdown fencing before parsing
    const jsonString = stripMarkdownCodeBlock(response.text);

    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("Failed to parse JSON from Gemini response:", e);
        console.error("Raw response text:", response.text);
        console.error("Stripped JSON string attempted to parse:", jsonString);
        throw new Error("Error parsing Gemini response: Invalid JSON format after stripping markdown.");
    }
  }

let userCount = 0;

type Question = {
    id: string;
    prompt: string;
    options: string[];
    correct: string; // this is kept server-side only
};

type username = string
type questionsAnswered = number;

type QuizRoom = {
    clients: Set<WebSocket>;
    host: {Websocket:WebSocket,username:string};
    questions: Question[]|null;
    scores: Map<WebSocket, {username:string,score:number}>|null;
    answered: Map<username, questionsAnswered>; // tracks which question IDs user has answered
    state: "waiting" | "in-progress" | "ended";
    clientInfo: Map<WebSocket, { name: string }>;
};


type message = {
    type:string
    payload:{
        message?:string,
        roomId:string | number,
        username:string,
        expires:Date,
        topic:string
        QuestionId?:string,
        Answer?:string
        time?:string
        difficulty:string|number
    }
}

const rooms : { [roomId:string]:QuizRoom} = {};



function removeClientFromRooms(ws: WebSocket) {
    for (const roomId in rooms) {
        const room = rooms[roomId];
        if (room.clients.has(ws)) {
            room.clients.delete(ws);
            room.clientInfo.delete(ws);
            console.log(`Removed client from room ${roomId}`);

            // Optionally notify others
            const clientList = Array.from(room.clientInfo.values()).map(client => client.name);
            room.clients.forEach(socket => {
                socket.send(JSON.stringify({
                    type: "client-list",
                    payload: clientList
                }));
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
    ws.on('message',async(message)=>{
        var msgStr:string = message.toString();
        var msg : message = JSON.parse(msgStr);
        
        var expires = msg.payload.expires; 
        var roomId = msg.payload.roomId;

        if (new Date(expires) > new Date()) {
            console.log("BRo is autheticated")
          }
  
        if (new Date(expires) < new Date()) {
            console.log("BRo is not autheticated")
            ws.close(); // or reject auth
            return;
          }

        if(msg.type === "join"){
            var username = msg.payload.username;

            if (!rooms[roomId]) {
                rooms[roomId] = {
                    clients: new Set<WebSocket>([ws]),
                    host: {username:username,Websocket:ws},
                    questions: null,
                    scores: new Map(),
                    answered: new Map([[username,0]]), // tracks which question IDs user has answered
                    state: "waiting",
                    clientInfo: new Map([[ws, { name: username }]])
                };
                console.log(`USer joined but didnt exist, so Created new room: ${roomId}`);
                ws.send(JSON.stringify({
                    type:"join",
                    status:"successful",
                    host:true
                }))
            }else{
                rooms[roomId].clients.add(ws); // Add socket to the room
                rooms[roomId].clientInfo.set(ws, { name: username });
                rooms[roomId].answered.set(username,0);
    
                console.log(username," Joined room",roomId)
                ws.send(JSON.stringify({
                    type:"join",
                    status:"successful",
                    host:false
                }))
            }

           

            const clientList = Array.from(rooms[roomId].clientInfo.values()).map(client => client.name);
                
    
                rooms[roomId].clients.forEach((socket)=>{
                    socket.send(JSON.stringify({
                    type: "client-list",
                    payload: clientList
                   }))
                })
        }


        if(msg.type === "message"){
            var username = msg.payload.username;

            const Messagepayload = {
                type:"message",
                payload:{
                    message: msg.payload.message,
                    username: username,
                    time:msg.payload.time
                }
                
            }
            rooms[roomId].clients.forEach((socket)=>{
                socket.readyState === WebSocket.OPEN ? socket.send(JSON.stringify(Messagepayload)): null;
            })
        }

        if(msg.type === "leave"){
            removeClientFromRooms(ws);
            ws.send(JSON.stringify({
                type:"leave",
                status:"successful"
            }))
        }

        //ROOM STARTING
        if(msg.type === "start"){
            try{
                if(rooms[roomId].host.Websocket !== ws){
                    const message = {
                        type:"unauthorised",
                        payload:{
                            message:"Only the host can start the quiz"
                        }
                    }

                    ws.send(JSON.stringify(message))
                } else {
                    const difficulty = msg.payload.difficulty;
                    const geminiResponse : Question[] = await CallGemini(msg.payload.topic,difficulty);
                console.log(geminiResponse)
                
                    
                rooms[roomId].questions = geminiResponse;
                rooms[roomId].state = "in-progress"

                const payload = {
                    type:"questions",
                    payload:geminiResponse
                }

                rooms[roomId].clients.forEach((socket)=>{
                    socket.readyState === WebSocket.OPEN ? socket.send(JSON.stringify(payload)): null;
                })
                console.log("ROom started")
                
                }
                
            } catch(err){
                console.log("Error in gemini response",err)
            }
        }
        //CHECKING QUIZ ANSWER
        if(msg.type === "answer"){
            const QuestionId = msg.payload.QuestionId
            const Answer = msg.payload.Answer
            const username = msg.payload.username
            
            const question = rooms[roomId].questions?.find(q => q.id === QuestionId)

            var currentScore = rooms[roomId].scores?.get(ws)?.score; 

            if(!currentScore){
                rooms[roomId].scores?.set(ws,{username:username,score:0})
                currentScore = 0;
            }
            if (question) {
                const isCorrect = question.correct === Answer;
                if(isCorrect){
                    const payload = {
                        type:"answer",
                        payload:{
                            QuestionId:QuestionId,
                            Correct:true
                        }
                    }
                    ws.send(JSON.stringify(payload))
                    
                    console.log("Correct ans:",Answer)
                    rooms[roomId].scores?.set(ws,{username:username,score:currentScore+1})

                }else{
                    const payload = {
                        type:"answer",
                        payload:{
                            QuestionId:QuestionId,
                            Correct:false
                        }
                    }
                    ws.send(JSON.stringify(payload))
                    console.log("InCorrect ans:",Answer)
                }

                var questionsAnswered = rooms[roomId].answered.get(username)

                if(!questionsAnswered){
                    questionsAnswered = 0;
                }

                rooms[roomId].answered.set(username, questionsAnswered+1)

                console.log(Array.from(rooms[roomId].answered.entries()))
                const liveScore = Array.from(rooms[roomId].answered.entries());
                rooms[roomId].clients.forEach((socket)=>{
                    socket.send(JSON.stringify({
                        type:"live-score",
                        payload:{
                            liveScore: liveScore
                        }
                    }))
                })

              } else {
                console.error("Question not found.");
              }
        }

        if(msg.type === "finish"){
            console.log("qUIZ FINISHED for user")

            if (rooms[roomId].scores) {
             var over = true;

           for(const score of rooms[roomId].answered){
            if(score[1]< 5){
                over = false;
                break;
            }
           }
           
           if(over){
            const finalScoreList: { username: string; score: number }[] = [];

            rooms[roomId].scores?.forEach((score)=>{
                finalScoreList.push({username:score.username,score:score.score})
            })

            rooms[roomId].clients.forEach((socket)=>{
                socket.send(JSON.stringify({
                    type:"final-score",
                    payload:{
                        finalScores: finalScoreList
                    }
                }))
            })

            rooms[roomId].state = "ended"
           }

            } else{
                ws.send(JSON.stringify({
                    type: "error",
                    payload: {
                        message:"No Scores available for this room"
                    }
               }))
            }

            

        }

       

    })

    // Event listener for when the connection with this specific client is closed.
    ws.on('close', () => {
        removeClientFromRooms(ws)
        console.log('Client disconnected.');
    });

    // Event listener for any errors that occur with this specific client connection.
    ws.on('error', (error: Error) => {
        removeClientFromRooms(ws)
        console.error(`WebSocket error for client: ${error.message}`);
    });
});

// Optional: Event listener for any errors on the server itself (e.g., port in use).
wss.on('error', (error: Error) => {
    console.error(`Server error: ${error.message}`);
});

console.log('Waiting for connections...');