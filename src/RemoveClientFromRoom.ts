import { rooms } from '.';
import { WebSocket } from 'ws';

export function removeClientFromRooms(ws: WebSocket) {
  for (const roomId in rooms) {
    const room = rooms[roomId];
    if (room.clients.has(ws)) {

      if (room.host?.Websocket === ws) {
    
        const currentHostWs = room.host.Websocket;
    

        const remainingClients = Array.from(room.clients).filter(
            clientWs => clientWs !== currentHostWs 
        );
    
        if (remainingClients.length > 0) {
            // Pick the first client in the remaining list as the new host
            const newHostWs = remainingClients[0];
    
            // Retrieve the username for the new host
            const newHostInfo = room.clientInfo.get(newHostWs);
    
            if (newHostInfo) {
                room.host = { Websocket: newHostWs, username: newHostInfo.name };

                console.log(`New host assigned: ${newHostInfo.name}`);

                newHostWs.send(
                  JSON.stringify({
                    type: 'set-host',
                    payload :{
                      setHost: true
                    }
                  }),
                );
                ws.send(
                  JSON.stringify({
                    type: 'set-host',
                    payload :{
                      setHost: false
                    }
                  }),
                );

    
                // You might want to send a message to the old host and the new host
                // indicating the change of host status.
                // Example (assuming you have a function to send messages):
                // sendSystemMessage(currentHostWs, "You are no longer the host.");
                // sendSystemMessage(newHostWs, "You are now the host!");
    
            } 
        } else {
            room.host = null;
            console.log("No more clients in the room. Host removed.");
        }
    }

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

export function resetRoom(roomId:string){
  rooms[roomId].answered.clear()
            rooms[roomId].clients.clear();
            rooms[roomId].clientInfo.clear();
            rooms[roomId].host = null;
            rooms[roomId].questions = [];
            if(rooms[roomId].scores){
              rooms[roomId].scores.clear();
            }
            rooms[roomId].state = 'waiting'
}
