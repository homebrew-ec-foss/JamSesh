const ws = new WebSocket('wss://jamsesh-8wui.onrender.com')

let clientId = null;
let roomCode = null;

document.addEventListener('DOMContentLoaded', () => {

    const hostBtn = document.getElementById('hostBtn');
    if (hostBtn) {
        hostBtn.addEventListener('click', () => {
            window.location.href = 'host.html';
        });
    }

    const joinBtn = document.getElementById('joinBtn');
    if (joinBtn) {
        joinBtn.addEventListener('click', () => {
            window.location.href = 'join.html';
        });
    }

    const generateCodeBtn = document.getElementById('generateCodeBtn');
    if(generateCodeBtn) {
        generateCodeBtn.addEventListener('click', () => {
            roomCode = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
            document.getElementById('jamCodeDisplay').textContent = `Your Jam Code: ${roomCode}`;
            document.getElementById('enterRoomHostBtn').style.display = 'inline-block';
            console.log(roomCode);
        });
    }

    const enterRoomHostBtn = document.getElementById('enterRoomHostBtn');
    if(enterRoomHostBtn) {
        enterRoomHostBtn.addEventListener('click', () => {
            if (roomCode !== null) {
                window.location.href = `page2.html?role=host&code=${roomCode}`;
            }
            else {
                alert("Please generate a jam code first.")
            }
        });
    }

    const jamCodeInput = document.getElementById('jamCode');
    const enterRoomJoinBtn = document.getElementById('enterRoomJoinBtn');
    if (jamCodeInput) {
        jamCodeInput.addEventListener('input', () => {
            const jamCode = jamCodeInput.value;
            ws = new WebSocket("wss://jamsesh-8wui.onrender.com");
            ws.onopen = () => {
                console.log("Websocket connected");
            };
            ws.onmessage = () => {
                if (data.type === 'init') {
                    clientId = data.clientId;
                    console.log(`I am ${clientId}. Existing clients:`, allClientIds);
                    ws.send(JSON.stringify({
                        type: 'validation',
                        code: jamCode,
                        from: clientId
                    }));
                    return;
                }
                if (data.type === 'validation') {
                    if (data.status === 'valid') {
                        enterRoomJoinBtn.style.display = 'inline-block';
                    }
                }
                else {
                    alert("Please enter a valid jam code.");
                    enterRoomJoinBtn.style.display = 'none';
                }
            }
        });
    }

    if (enterRoomJoinBtn) {
        enterRoomJoinBtn.addEventListener('click', () => {
            if (jamCode !== null) {
                window.location.href = `page2.html?role=join&code=${jamCode}`;
            }
            else {
                alert("Please enter a valid jam code.")
            }
        });
    }

});