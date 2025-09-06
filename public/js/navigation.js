document.addEventListener('DOMContentLoaded', () => {
    let roomCode = null;
    let validity = false;
    const ws = new WebSocket("wss://jamsesh-8wui.onrender.com");

    ws.onopen = () => console.log("Navigation WebSocket connected");

    ws.onmessage = (message) => {
        const data = JSON.parse(message.data);
        if (data.type === 'room_created') {
            roomCode = data.code;
            document.getElementById('jamCodeDisplay').textContent = `Your Jam Code: ${roomCode}`;
            document.getElementById('enterRoomHostBtn').style.display = 'inline-block';
        }
        if (data.type === 'validation') {
            validity = (data.status === 'valid');
            if (validity) {
                document.getElementById('enterRoomJoinBtn').style.display = 'inline-block';
            } else {
                alert("That room code is not valid.");
            }
        }
    };

    // For host.html
    const generateCodeBtn = document.getElementById('generateCodeBtn');
    if (generateCodeBtn) {
        generateCodeBtn.addEventListener('click', () => {
            ws.send(JSON.stringify({ type: 'create_room' }));
        });
    }

    const enterRoomHostBtn = document.getElementById('enterRoomHostBtn');
    if (enterRoomHostBtn) {
        enterRoomHostBtn.addEventListener('click', () => {
            const urlParams = new URLSearchParams(window.location.search);
            const username = urlParams.get('username');
            if (roomCode) {
                window.location.href = `jamming.html?role=host&code=${roomCode}&username=${username}`;
            }
        });
    }

    // For join.html
    const jamCodeInput = document.getElementById('jamCode');
    if (jamCodeInput) {
        jamCodeInput.addEventListener('input', () => {
            const jamCode = jamCodeInput.value;
            if (jamCode.length === 6) {
                ws.send(JSON.stringify({ type: 'validation', code: jamCode }));
            } else {
                validity = false;
                document.getElementById('enterRoomJoinBtn').style.display = 'none';
            }
        });
    }

    const enterRoomJoinBtn = document.getElementById('enterRoomJoinBtn');
    if (enterRoomJoinBtn) {
        enterRoomJoinBtn.addEventListener('click', () => {
            const urlParams = new URLSearchParams(window.location.search);
            const username = urlParams.get('username');
            if (validity) {
                const jamCode = jamCodeInput.value;
                window.location.href = `jamming.html?role=join&code=${jamCode}&username=${username}`;
            }
        });
    }
});