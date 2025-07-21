const { RTCPeerConnection } = require('wrtc');

function getPublicIP() {
  // Create a new RTCPeerConnection with a STUN server
  var pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun2.l.google.com:19302' }]
  });
  
  // Create a data channel to trigger the ICE gathering process
  pc.createDataChannel('');
  // Create an offer to start the ICE candidate gathering
  pc.createOffer().then(offer => pc.setLocalDescription(offer));

  // Listen for ICE candidates
  pc.onicecandidate = function(event) {
    if (event.candidate && event.candidate.candidate) {
      var ipMatch = event.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
      if (ipMatch) {
        console.log('Public IP:', ipMatch[0]);
        pc.close();
      }
    }
  };
}

getPublicIP();
