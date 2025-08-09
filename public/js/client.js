document.addEventListener('DOMContentLoaded', function() {

      // Host button event listener
    const hostBtn = document.getElementById('hostBtn');
    if (hostBtn) {
        hostBtn.addEventListener('click', () => {
            window.location.href = 'host.html';
        });
    }

    // Join button event listener
    const joinBtn = document.getElementById('joinBtn');
    if (joinBtn) {
        joinBtn.addEventListener('click', () => {
            window.location.href = 'join.html';
        });
    }

    const generateCodeBtn = document.getElementById('generateCodeBtn');
    if (generateCodeBtn) {
        generateCodeBtn.addEventListener('click', () => {
            var roomcode = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
            document.getElementById('jamCodeDisplay').textContent = `Your Jam Code: ${roomcode}`;
            document.getElementById('enterRoomBtn').style.display = 'inline-block';
            localStorage.setItem('jamCode', roomcode);
            console.log(roomcode);
        });
    }

    const enterRoomBtn = document.getElementById('enterRoomBtn');
    if (enterRoomBtn) {
      if (roomcode) {
        window.location.href = `page2.html?code=${roomcode}`;
      }
      else {
        alert("Please generate a jam code first.");
      }
    }

    const jamCode = document.getElementById('jamCode');
    if (jamCode) {
        jamCode.addEventListener('input', () => {
            document.getElementById('enterRoomBtn').style.display = 'none';
        });
    }

    const prepareToJoin = document.getElementById('prepareToJoin');
    if (prepareToJoin) {
        prepareToJoin.addEventListener('click', () => {
            const code = document.getElementById('jamCode').value;
            if (code && code.length >= 4) {
                localStorage.setItem('jamCode', code);
                document.getElementById('enterRoomBtn').style.display = 'inline-block';
            }
            else {
                alert("Please enter a valid jam code.");
            }
        });
    }

    window.onload = () => {
      const storedCode = localStorage.getItem('jamCode');
      if (storedCode) {
        document.getElementById('jamCode').value = storedCode;
        document.getElementById('enterRoomBtn').style.display = 'inline-block';
      }
    };
});


