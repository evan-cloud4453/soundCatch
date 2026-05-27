const socket = io();

let myNickname = '';
let currentRoomCode = '';
let isHost = false;
let timerInterval = null;

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function goToRoomSelect() {
    const name = document.getElementById('nickname-input').value.trim();
    if (!name) return alert('호출명을 입력해주세요.');
    myNickname = name;
    switchScreen('room-select-screen');
}

function createRoom() {
    socket.emit('create_room', { nickname: myNickname });
}

function joinRoom() {
    const code = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (!code) return alert('방 코드를 입력해주세요.');
    socket.emit('join_room', { roomCode: code, nickname: myNickname });
}

// 서버 응답 처리
socket.on('room_joined', (data) => {
    currentRoomCode = data.roomCode;
    isHost = data.isHost;
    
    document.getElementById('lobby-room-code').textContent = currentRoomCode;
    if (isHost) {
        document.getElementById('host-controls').style.display = 'block';
        document.getElementById('waiting-msg').style.display = 'none';
    }
    
    switchScreen('lobby-screen');
});

socket.on('room_update', (players) => {
    const container = document.getElementById('player-list-container');
    container.innerHTML = '';
    players.forEach(p => {
        container.innerHTML += `<div class="player-item">
            <span>${p.nickname} ${p.id === socket.id ? '(나)' : ''}</span>
            <span style="color: var(--neon-purple);">${p.score} pt</span>
        </div>`;
    });
});

socket.on('error_msg', (msg) => alert(msg));

// 게임 시작 및 라운드 제어
function startGame() {
    if (isHost) socket.emit('start_game', { roomCode: currentRoomCode });
}

socket.on('round_start', (data) => {
    switchScreen('game-screen');
    document.getElementById('question-category').textContent = `카테고리: ${data.category}`;
    document.getElementById('answer-input').value = '';
    document.getElementById('answer-input').disabled = false;
    document.getElementById('round-status').textContent = '';
    
    // 오디오 재생 로직 (차후 실제 오디오 객체 연결)
    console.log("Audio URL:", data.audio_url); 
    
    startTimer();
});

function startTimer() {
    let timeLeft = 15;
    document.getElementById('timer-display').textContent = timeLeft;
    clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer-display').textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            document.getElementById('answer-input').disabled = true;
        }
    }, 1000);
}

function handleAnswerEnter(e) {
    if (e.key === 'Enter') submitAnswer();
}

function submitAnswer() {
    const answer = document.getElementById('answer-input').value.trim();
    if (!answer) return;
    
    document.getElementById('answer-input').disabled = true;
    document.getElementById('round-status').textContent = '분석 중...';
    
    socket.emit('submit_answer', { roomCode: currentRoomCode, answer: answer });
}

socket.on('answer_result', (data) => {
    clearInterval(timerInterval);
    const statusEl = document.getElementById('round-status');
    
    if (data.isCorrect) {
        statusEl.textContent = `정답입니다! [${data.winner}]님이 맞췄습니다. (정답: ${data.correctAnswer})`;
        statusEl.style.color = '#00ff00';
    } else {
        statusEl.textContent = `시간 초과! 정답자는 없습니다. (정답: ${data.correctAnswer})`;
        statusEl.style.color = '#ff0055';
    }
});

socket.on('game_over', (data) => {
    switchScreen('result-screen');
    document.getElementById('winner-name').textContent = `우승자: ${data.winner}`;
});