let ws; 
let peerConnection;
const offerBtn = document.getElementById('offerBtn');
const answerBtn = document.getElementById('answerBtn');
const receivedSdp = document.getElementById('receivedSdp');

const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.l.google.com:5349" },
    { urls: "stun:stun1.l.google.com:3478" },
    { urls: "stun:stun1.l.google.com:5349" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:5349" },
    { urls: "stun:stun3.l.google.com:3478" },
    { urls: "stun:stun3.l.google.com:5349" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:5349" }
];

//initialization and creation of websocket connection

const init = () => {
    ws = new WebSocket("ws://localhost:8080");
    ws.onopen = () => {
        console.log("Websocket connected");
        offerBtn.diasabled = false;
    };

    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log(`Received WS message: Type=${data.type || 'N/A'}`, data);
        if (data.type === 'offer') {
            // If offer is recieved, we are the callee
            receivedSdp.textContent = JSON.stringify(data.sdp, null, 2);
            answerBtn.disabled = false;
            console.log('Offer received');
        }
        else if (data.type === 'answer') {
            // If answer is recieved, we are the caller
            receivedSdp.textContent = JSON.stringify(data.sdp, null, 2);
            console.log('Answer received. SDP exchange complete');
        }
        else {
            // Could be either Ice candidate or any other unrecognized message
            console.log('Not recognized');
        }
    };

    ws.onclose = () => {
        // Closing the connection
        console.log('WebSocket disconnected.');
    };

    ws.onerror = (err) => {
        // Error occured
        console.error('WebSocket error:', err);
    };
};
