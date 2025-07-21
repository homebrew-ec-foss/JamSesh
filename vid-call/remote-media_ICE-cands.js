const remoteVideo=document.getElementById('remoteVideo'); // gets the other person's video

const iceServers=
{
    iceServers:[
        {urls:'stun:stun.l.google.com:19302'},
        { urls:'stun:stun1.l.google.com:19302'}]
};

const peerConnection=new RTCPeerConnection(iceServers); //made a new peer connection

peerConnection.ontrack=(event)=> //runs when audio&video is received
    {                               //event.streams[0] contains audio+video
        if(remoteVideo.srcObject!==event.streams[0]) // safety check to avoid setting the same stream again    
        {
            remoteVideo.srcObject=event.streams[0]; //takes the remote stream and plays on screen
        }
    };

peerConnection.onicecandidate=(event)=>  //runs when new ice candidate is found
    {
        if(event.candidate)
        {
            signalingServer.send(JSON.stringify(        //if valid ICE candidate, send as JSON string to 
            {                                           //the other peer using the signaling server
                type:'ice-candidate',
                candidate:event.candidate
            }
            ));
        }
    };
//todo: remote ice cands, offer,answer