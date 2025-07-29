# 🎶 JamSesh: Multi-device audio playback with WebRTC 

**JamSesh** is a real-time, multi-device audio streaming app built with WebRTC. One device acts as the master and streams audio, while other devices as clients can join at any time and hear the same audio in perfect sync whether in the same room (to create a speaker-like effect) or across the internet. The core focus is on achieving minimal latency for a seamless, synchronized listening experience.

# Steps to Run 
### Pre-requisites: 
- Git must be setup
- Have `node.js` and `npm`(Node Package Manager) already installed
- Install websocket 
```bash 
npm install ws
```

### For running locally with local server
- Clone the repo 
```bash
git clone https://github.com/homebrew-ec-foss/JamSesh.git
```
- Go to the signaling-server repo 
```bash
cd signaling-server
```
- Run the server 
```bash
node server.js
```
- In `public/js/PeerConnection.js` in line 48 replace hosted server with local server.
- Run `index.html` on your port


### For hosted website 
- Open [website link]


# Mentees:
 - Arjun Gowda ([@Gowda-Arjun](https://github.com/Gowda-Arjun/))
 - Maaya Mohan ([@maayamohan](https://github.com/maayamohan/))
 - Srivani Karanth ([@SriK-1](https://github.com/SriK-1/))
 - Tisya Agarwal ([@SolarPhoenix13](https://github.com/SolarPhoenix13/))
 - Vanshitha Soma ([@vanshsoma](https://github.com/vanshsoma/))

# Mentors:
 - Andey Hemanth ([@andy34g7](https://github.com/andy34g7/))
 - Mebin Thattil ([@mebinthattil](https://github.com/mebinthattil/))
 - Vinaayak G Dasika ([@Delta18-Git](https://github.com/Delta18-Git/))
