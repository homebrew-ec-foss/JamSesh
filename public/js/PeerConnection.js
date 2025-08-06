let ws; 
let clientId = null;
let isMaster = false;
const peerConnections = {};
let localStream;
let isCallInProgress = false; 
let allClientIds = [];

const iceServers = [];

//html references
const localAudio = document.getElementById('localAudio');
const remoteAudio = document.getElementById('remoteAudio');

//initialization and creation of websocket connection

const init = () => {
    ws = new WebSocket("ws://localhost:8080");
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

    startBtn.addEventListener('click', async () => {
        // Only allow the button to be clicked once
        if (isCallInProgress) {
            console.log("Call is already in progress.");
            return;
        }

        // Set the first client as the master
        isMaster = true;
        console.log("This is the master");
        // Disable the start button and enable the end button
        startBtn.disabled = true;
        endBtn.disabled = false;
        isCallInProgress = true;

        // Acquire media for the master
        try {
            localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            // stopping the video track
            localStream.getVideoTracks().forEach(track => track.stop());
            console.log("Master has acquired local audio stream.");
            localAudio.srcObject = localStream;

            localStream.getTracks().forEach(track => {
                track.onended = () => {
                    console.log("Master's audio share ended");
                    if (isCallInProgress) {
                        endCall();
                    }
                };
            });

            // for the server to know who the master is
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'set-master' }));
            } 

            // creates offer for all existing clients
            console.log("Creating offers for existing clients:", allClientIds);
            for (const otherClientId of allClientIds) {
                if (otherClientId !== clientId) {
                    await createAndSendOffer(otherClientId);
                }
            }


        } catch (error) {
            console.error("Master failed to acquire media:", error);
            endCall();
            return;
        }

    });

    endBtn.addEventListener('click', () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'end-call' }));// end call mesg to signalling server
        }
        endCall();
    });
};


async function createAndSendOffer(targetClientId) { 
    if (peerConnections[targetClientId]) {
        console.warn(`Connection to ${targetClientId} already exists.`);
        return;
    }
    console.log(`Initiating connection to ${targetClientId}`);
    const pc = await createPeerConnection(targetClientId);
    peerConnections[targetClientId] = pc;

    if (localStream) { 
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            const audioSender = pc.addTrack(audioTracks[0], localStream);
            console.log("Added audio track for high-quality streaming.");

            //Optimizing for audio to be sent at higher bitrate
            const audioParameters = audioSender.getParameters();
            if (!audioParameters.encodings) {
                audioParameters.encodings = [{}];
            }
            audioParameters.encodings[0].maxBitrate = 256000;
            audioParameters.encodings[0].priority = 'high';
            try {
                await audioSender.setParameters(audioParameters);
                console.log('Audio sender parameters set to high bitrate.');
            } catch (e) {
                console.warn('Failed to set audio sender parameters:', e);
            }

            // Audio formating for higher audio quality
            const audioTransceiver = pc.getTransceivers().find(t => t.sender === audioSender);
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

        } else {
        console.error("Master's local stream is not available to send offer.");
        return;
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    ws.send(JSON.stringify({
        type: 'offer',
        to: targetClientId,
        sdp: pc.localDescription,
        from: clientId
    }));
    console.log(`Offer sent to ${targetClientId}`);
}

async function handleSignalingMessage(event) {

    const data = JSON.parse(event.data);

    if (data.type === 'init') {
        clientId = data.clientId;
        allClientIds = data.allClients; 
        console.log(`I am ${clientId}. Existing clients:`, allClientIds);
        return;

    }

    console.log("received signal:", data.type);

    switch (data.type) {
        case 'set-master': {
            // The server sends this to everyone except the master
            if (data.masterId !== clientId) {
                console.log(`Master has been set to: ${data.masterId}. I am a LISTENER.`);
            }
            return;
        }

        case 'new-client': {
                console.log('RAW DATA RECEIVED FOR NEW CLIENT:', data);

    const newClientId = data.clientId;
    
    if (!newClientId) {
        console.error("BUG FOUND: Server did not send a clientId for the new client.");
        return; }

            console.log(`New client ${newClientId} joined.`);
            // Add new client to our list
            allClientIds.push(newClientId); 
            
            // If we are the master and a stream is active, send the new client an offer.
            if (isMaster && localStream) {
                 await createAndSendOffer(newClientId);
            }
            break;
        }

        case 'client-left': {
            const leftClientId = data.clientId;
            console.log(`Client ${leftClientId} left.`);
            // Remove from  list
            allClientIds = allClientIds.filter(id => id !== leftClientId); 
            // Close the peer connection if it exists
            if (peerConnections[leftClientId]) {
                peerConnections[leftClientId].close();
                delete peerConnections[leftClientId];
                console.log(`Closed connection to ${leftClientId}`);
            }
            break;
        }

        
        case 'offer': {
            if (!isMaster) {
                const offererId = data.from;
                let pc = peerConnections[data.from];

                //if connection doesnt exist
                if (!pc) {
                    pc = await createPeerConnection(false, data.from);
                    peerConnections[data.from] = pc;
                }
                
                await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                ws.send(JSON.stringify({ type: 'answer', sdp: pc.localDescription, to: data.from, from: clientId}));
                
                isCallInProgress = true;
                endBtn.disabled = false; 
                startBtn.disabled = true;
                console.log("Received and answered an offer from the master.");
            } else {
                console.warn("Master received an unexpected offer. Ignoring.");
            }
            break;
        }

        case 'answer': {
            if (isMaster) {
                const answererId = data.from;
                const pc = peerConnections[answererId];
                if (!pc) {
                    console.error("Answer received but peerConnection not initialized for:", answererId);
                    return;
                }
                await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                console.log(`Received answer from ${answererId}. Call established.`);
            } else {
                console.warn("Listener received an unexpected answer. Ignoring.");
            }
            break;
        }


        case 'ice-candidate': {
            const peerId = data.from;
            const pc = peerConnections[data.from];
            if (pc && data.candidate) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                    console.log('ICE candidate added:', data.candidate.candidate);
                } catch (e) {
                    console.warn('ICE candidate error:', e);
                }
            } else {
                console.warn(`ICE candidate received for unknown peer ${peerId} or no candidate data.`);
            }
            break;
        }

        case 'client-left': {
        const leftClientId = data.clientId;
        console.log(`Client ${leftClientId} has left the session.`);
        
        // Remove the client from the local list
        allClientIds = allClientIds.filter(id => id !== leftClientId);
        
        // Close and delete the peer connection if it exists
        if (peerConnections[leftClientId]) {
            peerConnections[leftClientId].close();
            delete peerConnections[leftClientId];
            console.log(`Cleaned up connection for ${leftClientId}`);
        }
        break;
    }

        case 'end-call':
            endCall();
            break;
    }
}


async function createPeerConnection(acquireLocalMedia, peerId) {

    const sessionIceServers = [...iceServers];
    try {
        const response = await fetch("/api/get-turn-credentials");
        if (response.ok) {
            const turnServers = await response.json();
            if (Array.isArray(turnServers) && turnServers.length > 0) {
                sessionIceServers.push(...turnServers); // Add fetched TURN to the session array
                console.log("Fetched TURN credentials and added to iceServers.");
            } else {
                console.warn("No TURN credentials fetched, proceeding with just STUN servers.");
            }
        } else {
            console.warn(`Failed to fetch TURN credentials: ${response.status} ${response.statusText}`);
        }
    } catch (e) {
        console.error("Error fetching TURN credentials:", e);
    }

    const pc = new RTCPeerConnection({ iceServers: iceServers });
    console.log('PeerConnection initialized.');


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

    pc.ontrack = event => {
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
                    console.error("Error playing remote audio", e);                }
                });
        }else {
        console.warn("Remote audio element not found");
        }
    };

    pc.onconnectionstatechange = () => {
    console.log(`Peer Connection State for ${peerId}:`, pc.connectionState);
    if (pc.connectionState === 'connected') {
        console.log('P2P connection established');
        if (isMaster) {
            localAudio.muted = false;
        }
    } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        console.log('P2P Connection Disconnected/Failed/Closed.');
        // FIX: Check the length of the main peerConnections object, not pc.
        if (isCallInProgress && Object.keys(peerConnections).length === 1) {
            endCall();
        } else if (!isMaster && pc.connectionState === 'closed') {
            endCall();
        }
    }
};

    pc.onicecandidate = event => {
        if (event.candidate) {
            ws.send(JSON.stringify({
                type: 'ice-candidate',
                to: peerId,
                from: clientId,
                candidate: event.candidate
}));

        }
    };

    return pc;
}

function endCall() {
    // FIX: Check against peerConnections, as pc doesn't exist here.
    if (!isCallInProgress && Object.keys(peerConnections).length === 0) {
        // Fallback for multiple endCall executions
        return;
    }

    console.log("ending call");
    isCallInProgress = false;
    isMaster = false; // Also reset master status

    // FIX: Loop through the main peerConnections object to close each one.
    for (const id in peerConnections) {
        if (peerConnections[id]) {
            peerConnections[id].close();
        }
        delete peerConnections[id];
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    if (remoteAudio) {
        remoteAudio.srcObject = null;
        remoteAudio.src = "";
        remoteAudio.load();
    }
    if (localAudio) {
        localAudio.srcObject = null;
        localAudio.src = "";
        localAudio.load();
    }
    
    startBtn.disabled = false;
    endBtn.disabled = true;
    allClientIds = []; // Also reset the client list
    console.log("Call ended and resources cleaned up.");
}

window.onload = init;