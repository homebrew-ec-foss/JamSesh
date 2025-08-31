# Steps to Run 
### Pre-requisites: 
- Git must be setup
- Have `node.js` and `npm`(Node Package Manager) already installed
- Install dependencies 
```bash 
npm install ws express dotenv node-fetch uuid
```

### For running locally with local server
- Clone the repo 
```bash
git clone https://github.com/homebrew-ec-foss/JamSesh.git
```
- In [navigation.js](../public/js/navigation.js) in line 21,  [host.js](../public/js/host.js) in line 21, [join.js](../public/js/join.js) in line 22, replace hosted server with local server. 
```bash 
ws://localhost:8080
```
- Create API end-point for STUN/TURN server using [OpenRelay](https://www.metered.ca/tools/openrelay/) or any other 3rd party website of your choice.
    - After creation, make a new file `.env` inside `signaling-server` folder
    - In the file `.env`, paste your API link as
```bash
TURN_API_LINK=https://your-turn-provider.com/api/v1/credentials?apikey=YOUR_API_KEY
``` 
- Go to the signaling-server repo 
```bash
cd signaling-server
```
- Run the server 
```bash
node server.js
```
- Run `index.html` on your port

**⚠️ IMPORTANT NOTE:** 
- If in console it throws an error `Error fetching TURN credentials`
    - Verify that TURN_API_LINK is valid by adding the line `console.log(process.env)` in [server.js](../signaling-server/server.js) line 15. If TURN_API_LINK shows your api link, it is valid and move onto the next step
    - The default port used might be different than the port the TURN credentials are available on.  In [host.js](../public/js/host.js) in line 259, [join.js](../public/js/join.js) in line 142, replace `const response = await fetch("/api/get-turn-credentials");` with 
    ```bash 
    const response = await fetch("http://127.0.0.1:8080/api/get-turn-credentials");
    ```
    this should fix the error for the wrong API end-point