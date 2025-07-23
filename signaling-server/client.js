// Loading ws (websocket) module
const WebSocket = require('ws');

// Creating new websocket client instance
const ws = new WebSocket('ws://localhost:8080');

// Handling connection open event
ws.on('open', function open() {    // Registering event handler (fn runs when client connects)
    ws.send('Hello World');    // Sending message to server
});

// Handling incoming messages form server
ws.on('message', function incoming(data) {    // Setting event listener for message events (whenever server sends data)
    console.log('Received:', data.toString());    // Logging received data to console
});