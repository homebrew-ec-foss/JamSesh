require('dotenv').config();

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server }); 
const clients = new Map();
const activeRooms = new Map();

app.use(cors()); 

app.use(express.static(path.join(__dirname, '../public')));

const timesyncServer = require('timesync/server');
app.use('/timesync', timesyncServer.requestHandler);

app.get('/api/ping', (req, res) => {
    res.send('pong');
});

app.get('/api/get-turn-credentials', async (req, res) => {
    try {
        const turnApiLink = process.env.TURN_API_LINK;
        if (!turnApiLink) {
            throw new Error("TURN_API_LINK not found in .env file!");
        }
        const response = await fetch(turnApiLink);
        if (!response.ok) {
            throw new Error(`Failed to fetch from provider: ${response.statusText}`);
        }
        const credentials = await response.json();
        res.json(credentials);
    } catch (error) {
        console.error("Server: Error fetching TURN credentials:", error.message);
        res.status(500).json({ error: "Failed to get TURN credentials." });
    }
});

wss.on('connection', (ws) => {
    // new client assigned id
    const clientId = uuidv4();
    ws.clientId = clientId;
    clients.set(clientId, ws);
    console.log(`Client ${clientId} connected. Total clients: ${clients.size}`);

    ws.send(JSON.stringify({ type: 'init', clientId: clientId }));

    ws.on('message', (message) => handleClientMessage(ws, message));
    ws.on('close', () => handleClientDisconnect(ws));
});

function handleClientMessage(ws, message) {
    const data = JSON.parse(message.toString());
    const clientId = ws.clientId;
    const roomCode = ws.roomCode; 

    switch (data.type) {
        case 'create_room':
            const newCode = generateUniqueCode();
            activeRooms.set(newCode, { clients: [] });
            ws.send(JSON.stringify({ type: 'room_created', code: newCode }));
            console.log(`Room ${newCode} created.`);
            break;

        case 'validation':
            ws.send(JSON.stringify({
                type: 'validation',
                status: activeRooms.has(data.code) ? 'valid' : 'invalid'
            }));
            break;

        case 'joinroom':
            const codeToJoin = data.code;
            if (activeRooms.has(codeToJoin)) {
                const room = activeRooms.get(codeToJoin);
                
                // new client has joined
                const newParticipant = { id: clientId, username: data.username };

                // Notify existing participants
                room.clients.forEach(p => {
                    const clientWs = clients.get(p.id);
                    if (clientWs) clientWs.send(JSON.stringify({ type: 'user-joined', newParticipant }));
                });

                // Add the new participant object to the room
                room.clients.push(newParticipant);
                ws.roomCode = codeToJoin;

                // Send success message with the full list of participant objects
                ws.send(JSON.stringify({ type: 'join_success', code: codeToJoin, participants: room.clients }));
            }
            break;

        case 'start-call':
        case 'end-call':
            if (roomCode && activeRooms.has(roomCode)) {
                const room = activeRooms.get(roomCode);
                room.clients.forEach(id => {
                    if (id !== clientId) { 
                        const clientWs = clients.get(id);
                        if (clientWs) clientWs.send(JSON.stringify({ type: data.type }));
                    }
                });
            }
            break;

            case 'offer':
        case 'answer':
        case 'ice-candidate':
            const targetClient = clients.get(data.to);
            // Security check: ensure target exists and is in the same room.
            if (targetClient && ws.roomCode === targetClient.roomCode) {
                targetClient.send(JSON.stringify({ ...data, from: clientId }));
            }
            break;
            
        default:
            console.log(`[Server] Received unhandled message type: ${data.type}`);
    }
}

function handleClientDisconnect(ws) {
    const clientId = ws.clientId;
    const roomCode = ws.roomCode;
    console.log(`Client ${clientId} disconnected.`);

    if (roomCode && activeRooms.has(roomCode)) {
        const room = activeRooms.get(roomCode);
        const leavingParticipant = room.clients.find(p => p.id === clientId);
        room.clients = room.clients.filter(p => p.id !== clientId);

        room.clients.forEach(p => {
            const clientWs = clients.get(p.id);
            if (clientWs) clientWs.send(JSON.stringify({ type: 'client-left', participant: leavingParticipant }));
        });

        if (room.clients.length === 0) {
            activeRooms.delete(roomCode);
            console.log(`Room ${roomCode} is now empty and has been deleted.`);
        }
    }
    clients.delete(clientId); // remove from all list
}

function generateUniqueCode() {
    let newCode;
    do {
        newCode = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    } while (activeRooms.has(newCode));
    return newCode;
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});