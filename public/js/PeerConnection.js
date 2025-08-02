let ws; 
const peerConnections = {}; // changed from single peerConnection to support multiple peers
let localStream;
let isCallInProgress = false; 
let myClientId = null;


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

    if (data.type === 'init') {
        myClientId = data.clientId;
        console.log("I am", myClientId);
        return;
    }

    console.log("received signal:", data.type);

    switch (data.type) {
        case 'new-client': {
            const clientId = data.clientId;
            const pc = await createPeerConnection(true, clientId);
            peerConnections[clientId] = pc;

            localStream.getAudioTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    ws.send(JSON.stringify({
        type: 'offer',
        to: clientId,
        sdp: pc.localDescription,
        from: myClientId
    }));
    break;
}

        //caller initializes offer and sends
        case 'offer': {
            let pc = peerConnections[data.from];
            if (!pc) {
                pc = await createPeerConnection(false, data.from);
                peerConnections[data.from] = pc;
            }

            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: 'answer', sdp: pc.localDescription, to: data.from, from: myClientId}));
            isCallInProgress = true;// tracks for ongoing call
            endBtn.disabled = false; 
            startBtn.disabled = true;
            break;
        }

        case 'answer': {
            //callee receives offer and sends answers
            const pc = peerConnections[data.from];
            if (!pc) {
                console.error("Answer received but peerConnection not initialized for caller:", data.from);
                return;
            }
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            break;
        }


        case 'ice-candidate': {
            const pc = peerConnections[data.from];
            if (pc && data.candidate) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                    console.log('ICE candidate added:', data.candidate.candidate);
                } catch (e) {
                    console.warn('ICE candidate error:', e);
                }
            }
            break;
        }

        case 'end-call':
            endCall();
            break;
    }
}

async function startCall(peerId) {
    if (!peerId) {
        console.error("startCall() called without a peerId!");
        return;
    }

    if (isCallInProgress || peerConnections[peerId]) {
        console.warn("Call is already in progress or already calling", peerId);
        return;
    }

    console.log("starting call with", peerId);
    startBtn.disabled = true;

    const pc = await createPeerConnection(true, peerId);
    peerConnections[peerId] = pc;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    ws.send(JSON.stringify({
        type: 'offer',
        sdp: pc.localDescription,
        to: peerId,
        from: myClientId
    }));

    console.log('Created and sent offer to', peerId);
}


async function createPeerConnection(acquireLocalMedia, peerId) {
    if (acquireLocalMedia && !localStream) {
        try {
                localStream = await navigator.mediaDevices.getDisplayMedia({video: true, audio: true});
                localStream.getVideoTracks().forEach(track => {
                track.stop();
                console.log("Stopped unwanted video track from getDisplayMedia.");
            });

            console.log("Audio sent by caller).");
            
            localStream.getTracks().forEach(track => {
                track.onended = () => {
                    console.log("Audio share ended");
                    if (isCallInProgress) { 
                        endCall(); 
                    } else {
                            if (localStream) { 
                            localStream.getTracks().forEach(t => t.stop());
                            localStream = null;
                            localAudio.srcObject = null; 
                        }
                        startBtn.disabled = false;
                    }
                };
            });

        } catch (error) {
            console.error("Accessing media error:", error);
            localStream = null;
            return;
        }
    }

    const peerConnection = new RTCPeerConnection({ iceServers });
    console.log('PeerConnection initialized.');


    //Optimizing for audio to be sent at higher bitrate
    if(acquireLocalMedia && localStream)
    {
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

        // Audio formating for higher audio quality
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

    }

    peerConnection.ontrack = event => {
        // plays audio
        console.log('Remote track received', event.streams[0]);
        if (remoteAudio) { 
            remoteAudio.srcObject = event.streams[0];
            remoteAudio.play()
                .then(() => {
                console.log("Remote audio playing automatically");
                })
                .catch(e => {
                    if (e.name === "NotAllowedError" && e.message.includes("play() failed because the user didn't interact")) {
                        console.warn("Autoplay blocked");

                        const attemptPlay = () => {
                            if (remoteAudio.paused) { 
                                remoteAudio.play()
                                .then(() => {
                                    console.log("Remote audio playing after user click");
                                    document.body.removeEventListener('click', attemptPlay);
                                    document.body.removeEventListener('keypress', attemptPlay);
                                })
                                .catch(err => {
                                    console.error("Failed to play remote audio even with click:", err);
                                });
                            }
                        };
                        document.body.addEventListener('click', attemptPlay, { once: true }); 
                        document.body.addEventListener('keypress', attemptPlay, { once: true }); 

                    } else {
                    console.error("Error playing remote audio", e);                
                    }
                });
        } else {
            console.warn("Remote audio element not found");
        }
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
            ws.send(JSON.stringify({
                type: 'ice-candidate',
                to: peerId,
                from: myClientId,
                candidate: event.candidate
}));

        }
    };

    return peerConnection;
}

function endCall() {
    if (!isCallInProgress && Object.keys(peerConnections).length === 0) {
        //fallback for multiple calling executions
        return;
    }

    console.log("ending call");
    isCallInProgress = false;

    for (const id in peerConnections) {
        peerConnections[id].close();
        delete peerConnections[id];
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
