const { RTCPeerConnection } = require('wrtc');

function getPublicIP() {
  var pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun2.l.google.com:19302' }]
  });
  
  pc.createDataChannel('');
  pc.createOffer().then(offer => pc.setLocalDescription(offer));

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
