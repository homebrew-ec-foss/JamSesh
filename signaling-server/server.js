// Loading ws (websocket) module
const WebSocket = require('ws');

// Creating new websocket server instance
const wss = new WebSocket.Server({port: 8080});

// Handling incoming client connections
wss.on('connection', function connection(ws) {    // Registering event handler (fn runs when client connects)
    ws.on('message', function incoming(message) {    // Setting event listener for message events (whenever client sends data)
        // Broadcasting data to all connected clients
        wss.clients.forEach(function each(client) {    // Looping over all connected clients
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);    // Sending data to all connected clients
            }
        });
    });
});

// Printing confirmation message to terminal when server goes live
console.log("WebSocket server running on ws://localhost:8080");