// Loading ws (websocket) module
const WebSocket = require('ws');

// Defining port as dynamic render port
const PORT = process.env.PORT || 8080;

// Creating new websocket server instance
const wss = new WebSocket.Server({port: PORT});

// Handling incoming client connections
wss.on('connection', function connection(ws) {    // Registering event handler (fn runs when client connects)
    ws.on('message', function incoming(message) {    // Setting event listener for message events (whenever client sends data)
        const messageString = message.toString();
        console.log(`Received and broadcasting: ${messageString}`); 
        // Broadcasting data to all connected clients
        wss.clients.forEach(function each(client) {    // Looping over all connected clients
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(messageString);    // Sending data to all connected clients
            }
        });
    });
        ws.on('close', () => {
        console.log("[Server] Client disconnected.");
    });

    ws.on('error', (error) => {
        console.error("[Server] WebSocket error:", error);
    });
});

// Printing confirmation message to terminal when server goes live
console.log("WebSocket server running on ws://localhost:8080");