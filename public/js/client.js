document.addEventListener('DOMContentLoaded', function() {
    const hostbtn = document.getElementById('hostBtn');
    const roomCodeDisplay = document.getElementById('roomCode');
    hostbtn.addEventListener('click', function() {
        var click = new CustomEvent('announcement', {
            detail: {
                message: 'Button Click'
            }
        });
    window.dispatchEvent(click)
    });

    window.addEventListener('announcement', function(e) {
        console.log('Announcement:', e.detail.message);

        var roomcode = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        roomCodeDisplay.textContent = `Room Code: ${roomcode}`;
        console.log(roomcode);
    });

    const joinbutton = document.getElementById('joinBtn');
    const code = document.getElementById('codeInput');
    joinbutton.addEventListener('click', () => {
        code.style.display = 'inline-block';
    });
});


