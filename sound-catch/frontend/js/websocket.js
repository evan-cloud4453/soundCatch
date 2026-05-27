let socket;
let currentRoom = null;

function initSocket(nickname) {
    socket = io('http://localhost:3000');

    socket.on('room_update', (data) => {
        currentRoom = data.roomId;
        document.getElementById('room-display').innerText = `Room: ${currentRoom}`;
    });

    socket.on('round_start', (data) => {
        // 음원 재생 및 UI 활성화 로직
        document.getElementById('answer-input').disabled = false;
        document.getElementById('answer-input').focus();
    });

    socket.on('answer_result', (data) => {
        alert(`${data.winner}님이 정답을 맞췄습니다!`);
        document.getElementById('answer-input').disabled = true;
    });
}

function submitAnswer(text) {
    if (socket && currentRoom) {
        socket.emit('submit_answer', { 
            roomId: currentRoom, 
            nickname: document.getElementById('nickname').value, 
            answer: text 
        });
    }
}