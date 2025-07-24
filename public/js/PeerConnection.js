let ws; 
let peerConnection;
const offerBtn = document.getElementById('offerBtn');
const answerBtn = document.getElementById('answerBtn');
const rcvSdp = document.getElementById('rcvSdp');

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
    ws = new WebSocket("wss://jamsesh.onrender.com");
    ws.onopen = () => {
        console.log("Websocket connected");
        offerBtn.disabled = false;
    };

    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log(`Received WS message: Type=${data.type || 'N/A'}`, data);
        if (data.type === 'offer') {
            // If offer is recieved, we are the callee
            rcvSdp.textContent = JSON.stringify(data.sdp, null, 2);
            answerBtn.disabled = false;
            console.log('Offer received');
        }
        else if (data.type === 'answer') {
            // If answer is recieved, we are the caller
            rcvSdp.textContent = JSON.stringify(data.sdp, null, 2);
            console.log('Answer received. SDP exchange complete');
        }
        else if (data.type === 'candidate') {
            // for testing
            console.log('ICE candidated received');
        }
        else {
            // unrecognized message
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


// WebRTC SDP functions

// 1. caller creates offer and sends it over
const sendOffer = async () => {
    
    //initialized the peer connection
    peerConnection = new RTCPeerConnection(iceServers);
    console.log('PeerConnection initialized for offer');
    // simulating sending of media stream
    peerConnection.addTransceiver('audio', { direction: 'recvonly' });
    peerConnection.addTransceiver('video', { direction: 'recvonly' });

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            // only testing for ice candidates
            console.log('Ice candidates', event.candidate.candidate);
            ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
        }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);


    console.log('Created and sent Offer:', peerConnection.localDescription);
    ws.send(JSON.stringify({ type: 'offer', sdp: peerConnection.localDescription }));
    offerBtn.disabled = true;
};

// 2. callee processes offer and sends answer
const rcvOffer = async () => {

    if (!peerConnection) {
        // initialized the peer connection
        peerConnection = new RTCPeerConnection(iceServers);
        console.log('PeerConnection initialized for answer.');
        // simulating sending of media stream
        peerConnection.addTransceiver('audio', { direction: 'recvonly' });
        peerConnection.addTransceiver('video', { direction: 'recvonly' });

        peerConnection.onicecandidate = (event) => {
            // only testing for ice candidates
            if (event.candidate) {
                console.log('Ice candidates', event.candidate.candidate);
                ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
            }
        };
    }

    // recieved the SDP
    const rcvSdpText = rcvSdp.textContent;
    if (!rcvSdpText) {
        console.error('No offer received');
        return;
    }
    const rcvOfferSdp = JSON.parse(rcvSdpText);

    // set remote Offer
    await peerConnection.setRemoteDescription(new RTCSessionDescription(rcvOfferSdp));
    console.log('Remote offer');

    // create and set local Answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    console.log('created and set local answer:', peerConnection.localDescription);
    ws.send(JSON.stringify({ type: 'answer', sdp: peerConnection.localDescription }));
    answerBtn.disabled = true;
};

// button function
offerBtn.addEventListener('click', sendOffer);
answerBtn.addEventListener('click', rcvOffer);
window.onload = init;