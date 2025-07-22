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

//runs when message is received from signaling server
signalingServer.onmessage=async(message)=> 
{
	//message.data=JSON message sent by signaling server, contains offer, answer, ice cands.
	const data=JSON.parse(message.data);
	
	//if you're the receiver (data parsed is your remote offer)
	if(data.type=='offer')
	{
		await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
		const answer=await pc.createAnswer();
		await pc.setLocalDescription(answer);
		signalingServer.send(JSON.stringify(
		{
			type:'answer', answer
		}
		));
	}
	
	// if you're the caller (data parsed is remote answer)
	if(data.type=='answer')
	{
		await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
	}
	
	// remote ICE candidate.... second condition prevents code working with null if your signaling server sends it
	if(data.type=='ice-candidate'&& data.candidate!=null)
	{
		await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); 		//adds ice cand
	}
}