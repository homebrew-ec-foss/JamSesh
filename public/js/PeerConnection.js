const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startBtn = document.getElementById('startBtn');
const endBtn = document.getElementById('endBtn');

let ws;
let localStream;
let peerConnection;
let isCallInProgress = false;

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

window.onload = () => {
    ws = new WebSocket("ws://localhost:8080"); 
    ws.onmessage = handleSignalingMessage;
    ws.onclose = () => {
        console.log("websocket disconected");
        endCall();
    };

    startBtn.addEventListener('click', startCall);
    endBtn.addEventListener('click', () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'end-call' })); // end call mesg to sig. server
        }
        endCall();
    });
};

async function handleSignalingMessage(event) {
    const data = JSON.parse(event.data);

    if ((data.type === 'offer' || data.type === 'answer') && isCallInProgress) {
        return; // ignores any new offer/answer if a call is already in progress
    }

    console.log("received signal:", data.type);

    switch (data.type) {
        case 'offer':
            if (!peerConnection) {
                await createPeerConnection();
            }
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: 'answer', sdp: peerConnection.localDescription }));
            isCallInProgress = true; // tracks for ongoing call
            break;

        case 'answer':
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
            isCallInProgress = true;
            break;

        case 'ice-candidate':
            if (peerConnection && data.candidate) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
            break;

        case 'end-call':
            endCall();
            break;
    }
}

async function startCall() {
    if (isCallInProgress || peerConnection) return;
    
    console.log("starting call");
    await createPeerConnection();
    
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'offer', sdp: peerConnection.localDescription }));
}

async function createPeerConnection() {
    if (!localStream) {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localVideo.srcObject = localStream;
        } catch (error) {
            console.error("accessing error", error);
            return;
        }
    }
    peerConnection = new RTCPeerConnection({ iceServers });
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: 'ice-candidate', candidate: event.candidate }));
        }
    };
    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
}

function endCall() {
    if (!isCallInProgress && !peerConnection) {
        return;
    }

    console.log("ending call");
    isCallInProgress = false; 

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    remoteVideo.srcObject = null;
    localVideo.srcObject = null;
    remoteVideo.src = "";
    localVideo.src = "";
    remoteVideo.load();
    localVideo.load();
}