let ws; 
let clientId = null;
let isMaster = false;
const peerConnections = {};
let localStream;
let isCallInProgress = false; 
let allClientIds = [];

const iceServers = [];

const BITRATE_LEVELS = {
    HIGH: 192000,   // 192 kbps 
    MEDIUM: 96000, 
    LOW: 48000,     
};
const ADAPTATION_INTERVAL_MS = 5000; // check network every 5 seconds

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
    
    peerConnections[targetClientId] = {
        pc: pc,
        audioSender: null,
        currentBitrate: 'HIGH', // start at the highest quality
        monitorInterval: null
    };

    if (localStream) { 
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            const audioSender = pc.addTrack(audioTracks[0], localStream);
            // store the audio sender for later adjustments
            peerConnections[targetClientId].audioSender = audioSender;
            console.log("Added audio track for high-quality streaming.");

            //Optimizing for audio to be sent at higher bitrate
            const audioParameters = audioSender.getParameters();
            if (!audioParameters.encodings) {
                audioParameters.encodings = [{}];
            }
            // set initial bitrate from our levels
            audioParameters.encodings[0].maxBitrate = BITRATE_LEVELS.HIGH;
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
            const newClientId = data.clientId;
            if (!newClientId) {
                console.error("BUG FOUND: Server did not send a clientId for the new client.");
                return; 
            }
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
                if (peerConnections[leftClientId].monitorInterval) {
                    clearInterval(peerConnections[leftClientId].monitorInterval);
                }
                peerConnections[leftClientId].pc.close();
                delete peerConnections[leftClientId];
                console.log(`Closed connection to ${leftClientId}`);
            }
            break;
        }

        case 'offer': {
            if (!isMaster) {
                const offererId = data.from;
                // get the pc instance from our stored object
                let pc = peerConnections[offererId]?.pc;

                if (!pc) {
                    pc = await createPeerConnection(offererId);
                    peerConnections[offererId] = { pc: pc };
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
                const peer = peerConnections[answererId]; // get the whole peer object
                if (!peer || !peer.pc) {
                    console.error("Answer received but peerConnection not initialized for:", answererId);
                    return;
                }
                await peer.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                console.log(`Received answer from ${answererId}. Call established.`);

                // check network conection quality for this peer
                if (peer && !peer.monitorInterval) {
                    peer.monitorInterval = setInterval(() => {
                        monitorAndAdaptBitrate(answererId);
                    }, ADAPTATION_INTERVAL_MS);
                    console.log(`network quality monitoring for ${answererId}.`);
                }

            } else {
                console.warn("Listener received an unexpected answer. Ignoring.");
            }
            break;
        }

        case 'ice-candidate': {
            const peerId = data.from;
            const pc = peerConnections[peerId]?.pc; 
            if (pc && data.candidate) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (e) {
                    console.warn('ICE candidate error:', e);
                }
            } else {
                console.warn(`ICE candidate received for unknown peer ${peerId} or no candidate data.`);
            }
            break;
        }

        case 'end-call':
            endCall();
            break;
    }
}

async function createPeerConnection(peerId) {

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

    pc.ontrack = event => {
        // plays audio
        console.log('Remote track received', event.streams[0]);
        if (remoteAudio) { 
            remoteAudio.srcObject = event.streams[0];
            remoteAudio.play()
                .catch(e => {
                    console.warn("Autoplay was blocked. User must interact with the page first.", e.name);
                });
        }else {
            console.warn("Remote audio element not found");
        }
    };

    pc.onconnectionstatechange = () => {
        console.log(`Peer Connection State for ${peerId}:`, pc.connectionState);
    }; // simplified

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

// set a new bitrate for a specific peer
async function setBitrateForPeer(peerId, newLevel) {
    const peer = peerConnections[peerId];
    if (!peer || !peer.audioSender || peer.currentBitrate === newLevel) {
        return; // no change needed/sender not ready
    }

    console.log(`adapting bitrate for ${peerId} from ${peer.currentBitrate} to ${newLevel}`);
    const params = peer.audioSender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
    }
    params.encodings[0].maxBitrate = BITRATE_LEVELS[newLevel];

    try {
        await peer.audioSender.setParameters(params);
        peer.currentBitrate = newLevel; 
        console.log(`successfully set bitrate for ${peerId} to ${newLevel} (${BITRATE_LEVELS[newLevel]} bps)`);
    } catch (e) {
        console.error(`failed to set bitrate for ${peerId}:`, e);
    }
}

// monitoring and adapting the bitrate
async function monitorAndAdaptBitrate(peerId) {
    const peer = peerConnections[peerId];
    if (!peer || !peer.pc || !peer.audioSender) {
        return;
    }

    const stats = await peer.pc.getStats();
    let packetLoss = 0;
    let rtt = 0;

    stats.forEach(report => {
        if (report.type === 'remote-inbound-rtp' && report.kind === 'audio') {
            // fractionLost: value b/w 0 and 1 representing packet loss 
            packetLoss = report.fractionLost;
            rtt = report.roundTripTime;
            console.log(`[stats for ${peerId}] Packet Loss: ${(packetLoss * 100).toFixed(2)}%, RTT: ${(rtt * 1000).toFixed(0)}ms`);
        }
    });

    if (packetLoss > 0.15 || rtt > 0.4) { // 15% packet loss or 400ms RTT, vansh change it if u want to
        if (peer.currentBitrate === 'HIGH') {
            setBitrateForPeer(peerId, 'MEDIUM');
        } else if (peer.currentBitrate === 'MEDIUM') {
            setBitrateForPeer(peerId, 'LOW');
        }
        return; 
    }

    // if network is excellent, try to go up a level
    if (packetLoss < 0.1 && rtt < 0.25) { 
        if (peer.currentBitrate === 'LOW') {
            setBitrateForPeer(peerId, 'MEDIUM');
        } else if (peer.currentBitrate === 'MEDIUM') {
            setBitrateForPeer(peerId, 'HIGH');
        }
    }
}

function endCall() {
    if (!isCallInProgress) {
        return;
    }

    console.log("ending call");
    isCallInProgress = false;
    isMaster = false; // Also reset master status

    // loop and clear intervals before closing connections
    for (const id in peerConnections) {
        const peer = peerConnections[id];
        if (peer.monitorInterval) {
            clearInterval(peer.monitorInterval);
        }
        if (peer.pc) {
            peer.pc.close();
        }
        delete peerConnections[id];
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (remoteAudio) remoteAudio.srcObject = null;
    if (localAudio) localAudio.srcObject = null;
    
    startBtn.disabled = false;
    endBtn.disabled = true;
    allClientIds = []; // Also reset the client list
    console.log("Call ended and resources cleaned up.");
}

window.onload = init;