
const localVideoEl = document.querySelector('#local-video');
const remoteVideoEl = document.querySelector('#remote-video');

let localStream;  // local vid stream
let remoteStream;  // remote vid stream
let peerConnection;  // peer connection

let PeerConfiguration = {
    iceServers: [
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302'
            ]
        }
    ]
}

// when client initiates call
const call = async e => {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio:true,
    });
    localVideoEl.srcObject = stream;
    localStream = stream;

    await createPeerConnection();

    // create offer
    try {
        console.log("creating offer...")
        const offer = await peerConnection.createOffer();
        console.log(offer);
    } catch(err) {
        console.log('error')
    }
}


const createPeerConnection = () => {
    return new Promise(async(resolve, reject) =>{
        peerConnection = await new RTCPeerConnection(PeerConfiguration)  // config object contains stun servers, which will fetch ice candidates
        peerConnection.addEventListener('icecandidate', e => {
            console.log('...ice candidate found...')
            console.log(e)
        })
        resolve();
    })
}

document.querySelector('#call').addEventListener('click', call)
