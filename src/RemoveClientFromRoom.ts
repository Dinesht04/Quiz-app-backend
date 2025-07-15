import { rooms } from ".";
import { WebSocket } from "ws";



export function removeClientFromRooms(ws: WebSocket) {
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
