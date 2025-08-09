const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const path = require('path');
const dotenv = require('dotenv');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server }); 
const clients = new Map();

dotenv.config();

let masterClientId = null;

app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/ping', (req, res) => {
    console.log('ping message');
    res.send('pong');
});

app.get('/api/get-turn-credentials', async (req, res) => {
    try {
        const turnApiLink = process.env.TURN_API_LINK;
        if (!turnApiLink) {
            console.error("Server: TURN_API_LINK not found in .env file!");
            return res.status(500).json([]);
        }

        const response = await fetch(turnApiLink);

        if (!response.ok) {
            console.error(`Server: Failed to fetch TURN credentials from provider: ${response.status} ${response.statusText}`);
            return res.status(response.status).json([]);
        }

        const turnCredentials = await response.json();
        console.log("Server: Successfully fetched TURN credentials from provider");
        res.json(turnCredentials);
    } catch (error) {
        console.error("Server: Error fetching TURN credentials:", error);
        res.status(500).json([]);
    }
});

wss.on('connection', function connection(ws) {    // Registering event handler (fn runs when client connects)
    // new ID assigned for a new client
    const clientId = Math.random().toString(36).substring(2, 10);
    clients.set(clientId, ws);
    ws.clientId = clientId;

    console.log(`[Server] New client connected: ${clientId}`);


    //sending new client info to the other connected clients
    ws.send(JSON.stringify({
        type: 'init', 
        clientId: clientId,
        allClients: Array.from(clients.keys()).filter(id => id !== clientId),
    }));

    clients.forEach((clientWs, id) => {
        if (id !== clientId && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
                type: 'new-client', 
                clientId: clientId
            }));
        }
    });

    ws.on('message', function incoming(message) {   // Setting event listener for message events (whenever client sends data)
        const messageString = message.toString();
        const data = JSON.parse(messageString);

        if (data.to && clients.has(data.to)) {
            const targetClient = clients.get(data.to);
            if (targetClient && targetClient.readyState === WebSocket.OPEN) {
                // Add 'from' field so the receiver knows who sent it
                const relayedData = { ...data, from: ws.clientId };
                targetClient.send(JSON.stringify(relayedData));
                console.log(`[Server] Relayed ${data.type} from ${ws.clientId} to ${data.to}`);
            }
            else {
                console.warn(`[Server] Target client ${data.to} is not available.`);
            }
        } 
        else{
                        switch (data.type) {
                case 'set-master':
                    masterClientId = ws.clientId;
                    console.log(`[Server] Master set to ${masterClientId}`);
                    // Broadcast to all *other* clients who the master is
                    clients.forEach((clientWs, id) => {
                        if (id !== ws.clientId && clientWs.readyState === WebSocket.OPEN) {
                            clientWs.send(JSON.stringify({ type: 'set-master', masterId: masterClientId }));
                        }
                    });
                    break;
                case 'end-call':
                    console.log(`[Server] Master ${ws.clientId} ended the call. Broadcasting.`);
                    masterClientId = null; // Reset master
                    // Broadcast the end-call signal to everyone except the sender
                    clients.forEach((clientWs, id) => {
                        if (id !== ws.clientId && clientWs.readyState === WebSocket.OPEN) {
                           clientWs.send(JSON.stringify({ type: 'end-call', from: ws.clientId }));
                        }
                    });
                    break;
                default:
                    console.log(`[Server] Received unhandled message type: ${data.type}`);
            }
        }

    });
    
    ws.on('close', () => {
        console.log("[Server] Client disconnected.");
        clients.delete(ws.clientId);

        if (ws.clientId === masterClientId) {
            console.log(`[Server] Master has disconnected. Ending call for all.`);
            masterClientId = null;
        }

        
        clients.forEach((clientWs, id) => {
            if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                    type: 'client-left',
                    clientId: ws.clientId
                }));
            }
        });
    });

    ws.on('error', (error) => {
        console.error(`[Server] WebSocket error for client ${ws.clientId}:`, error);
    });
});


const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Access the app at http://localhost:${PORT}`);
});