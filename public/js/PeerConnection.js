let ws; 
let peerConnection;
let localStream;
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
    { urls: "stun:stun4.l.google.com:5349" },
    {
    url: 'turn:numb.viagenie.ca',
    credential: 'muazkh',
    username: 'webrtc@live.com'
},
{
    url: 'turn:192.158.29.39:3478?transport=udp',
    credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
    username: '28224511:1379330808'
},
{
    url: 'turn:192.158.29.39:3478?transport=tcp',
    credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
    username: '28224511:1379330808'
},
{
    url: 'turn:turn.bistri.com:80',
    credential: 'homeo',
    username: 'homeo'
 },
 {
    url: 'turn:turn.anyfirewall.com:443?transport=tcp',
    credential: 'webrtc',
    username: 'webrtc'
}    
];

//initialization and creation of websocket connection

const init = () => {
    //For local host replace wss://jamsesh-8wui.onrender.com with wss://localhost:8080
    ws = new WebSocket("wss://jamsesh-8wui.onrender.com");
    ws.onopen = () => {
        console.log("Websocket connected");
    };

    ws.onmessage = handleSignalingMessage;

    ws.onclose = () => {
        // Closing the connection
        console.log('WebSocket disconnected.');
        endCall();
    };

    ws.onerror = (err) => {
        // Error occured
        console.error('WebSocket error:', err);
        endCall();
    };

    startBtn.addEventListener('click', startCall);
    endBtn.addEventListener('click', () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'end-call' }));// end call mesg to sig. server
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
            // caller initializes offer and sends
            if (!peerConnection) {
                // for when it receives media
                await createPeerConnection();
            }

            //if (!peerConnection) return; 
            
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: 'answer', sdp: peerConnection.localDescription }));
            isCallInProgress = true;// tracks for ongoing call
            endBtn.disabled = false; 
            startBtn.disabled = true;
            break;

        case 'answer':
            //callee recieves offer and sends answers 
            if (!peerConnection) { 
                console.error("Answer received but peerConnection not initialized for caller.");
                return;
            }

            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
            isCallInProgress = true;
            endBtn.disabled = false;
            startBtn.disabled = true;
            break;

        case 'ice-candidate':
            if (peerConnection && data.candidate) {
                try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                    console.log('ICE candidate added:', data.candidate.candidate);
                } catch (e) {
                    console.warn('ICE candidate error:', e);
                }
            }
            break;

        case 'end-call':
            endCall();
            break;
    }
}

async function startCall() {
    if (isCallInProgress || peerConnection) {
        console.warn("Call is already in progress");
    }

    console.log("starting call");
    startBtn.disabled = true;
    await createPeerConnection();

    if (!peerConnection) {
        // on failure
        startBtn.disabled = false;
        return;
    }

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'offer', sdp: peerConnection.localDescription }));
    console.log('Created and sent Offer.');
}

async function createPeerConnection() {
    if (!localStream) {
        try {
            localStream = await navigator.mediaDevices.getDisplayMedia({video: true, audio: true});
            console.log("System audio is being transmitted");
            
        } catch (error) {
            console.error("accessing error:", error);
            localStream = null;
            return;
        }
    }

    peerConnection = new RTCPeerConnection({ iceServers });
    console.log('PeerConnection initialized.');

    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
        const audioSender = peerConnection.addTrack(audioTracks[0], localStream);
        console.log("Added audio track only");

        const audioParameters = audioSender.getParameters();
        if (!audioParameters.encodings) {
            audioParameters.encodings = [{}];
        }

        audioParameters.encodings[0].maxBitrate = 512000;
        audioParameters.encodings[0].priority = 'high';

        try {
            await audioSender.setParameters(audioParameters);
            console.log('Audio sender parameters set to high bitrate:', audioParameters.encodings[0].maxBitrate, 'bps');
        } catch (e) {
            console.warn('Failed audio sender :', e);
        }

        
        const audioTransceiver = peerConnection.getTransceivers().find(t => t.sender === audioSender);
        if (audioTransceiver) {
            try {
                const capabilities = RTCRtpSender.getCapabilities('audio');
                const opusCodec = capabilities.codecs.find(c => c.mimeType === 'audio/opus');
                if (opusCodec) {
                    audioTransceiver.setCodecPreferences([opusCodec]);
                    console.log('Opus codec prioritizing audio transceiver.');
                } else {
                    console.warn('Opus codec not found');
                }
            } catch (e) {
                console.error('Failed audio codec :', e);
            }
        }
    }

    peerConnection.ontrack = event => {
        // plays audio
        console.log('Remote track received. Stream:', event.streams[0]);
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.play().catch(e => console.error("Error playing remote audio:", e));
    };

    peerConnection.onconnectionstatechange = () => {
        console.log('Peer Connection State:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
            console.log('P2P connection established');
            localAudio.muted = false;
        } else if (['disconnected', 'failed', 'closed'].includes(peerConnection.connectionState)) {
            console.log('P2P Connection Disconnected/Failed/Closed.');
            if (isCallInProgress) {
                endCall();
            }
        }
    };

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: 'ice-candidate', candidate: event.candidate }));
        }
    };
}


function endCall() {
    if (!isCallInProgress && !peerConnection) {
        //fallback for multiple endcall executions
        return;
    }

    console.log("ending call");
    isCallInProgress = false;

    if (peerConnection) {
        // close peer connection
        peerConnection.close();
        peerConnection = null;
    }
    
    if (localStream) {
        // stops local media
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    remoteAudio.srcObject = null;
    localAudio.srcObject = null;
    remoteAudio.src = "";
    localAudio.src = "";
    remoteAudio.load();
    localAudio.load();
}

// button function
window.onload = init;