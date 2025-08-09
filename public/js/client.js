document.addEventListener('DOMContentLoaded', function() {

    let roomCode = null;

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
    if (generateCodeBtn) {
        generateCodeBtn.addEventListener('click', () => {
            roomCode = Math.floor(Math.random() * 1000000);
            const roomCodeString = roomCode.toString().padStart(6, '0');
            document.getElementById('jamCodeDisplay').textContent = `Your Jam Code: ${roomCodeString}`;
            document.getElementById('enterRoomBtn').style.display = 'inline-block';
            console.log(roomCodeString);
        });
    }

    const enterRoomHostBtn = document.getElementById('enterRoomBtn');
    if (enterRoomHostBtn) {
        enterRoomHostBtn.addEventListener('click', () => {
            if (roomCode !== null) {
                window.location.href = `page2.html?code=${roomCode}`;
            } else {
                alert("Please generate a jam code first.");
            }
        });
    }

    const jamCodeInput = document.getElementById('jamCode');
    if (jamCodeInput) {
        jamCodeInput.addEventListener('input', () => {
            const code = jamCodeInput.value;
            const enterRoomBtn = document.getElementById('enterRoomBtn');
            if (code.length === 6 && /^\d+$/.test(code)) {
                enterRoomBtn.style.display = 'inline-block';
            } else {
                enterRoomBtn.style.display = 'none';
            }
        });
    }

    const enterRoomJoinBtn = document.getElementById('enterRoomBtn');
    if (enterRoomJoinBtn && jamCodeInput) {
        enterRoomJoinBtn.addEventListener('click', () => {
            const code = jamCodeInput.value;
            if (code.length === 6 && /^\d+$/.test(code)) {
                window.location.href = `page2.html?code=${code}`;
            } else {
                alert("Please enter a valid 6-digit jam code.");
            }
        });
    }
});