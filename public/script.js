const socket = io();
let myNickname = '';
let currentRoom = null;
let ytPlayer = null;
let currentQuestionIndex = null;

// 스크립트 상단에 아래 함수를 추가합니다.
function enterLobby() {
    myNickname = document.getElementById('my-nickname').value.trim();
    if (!myNickname) {
        alert('닉네임을 입력해야 입장할 수 있습니다.');
        return;
    }
    document.getElementById('welcome-msg').innerText = `${myNickname}님, 환영합니다.`;
    switchScreen('home-screen'); // 스플래시에서 메인 로비로 이동
}

// --- 유튜브 Iframe API 초기화 ---
function onYouTubeIframeAPIReady() {
    ytPlayer = new YT.Player('youtube-player', {
        height: '0', width: '0',
        playerVars: { 'autoplay': 0, 'controls': 0 },
        events: { 'onReady': () => console.log('YT Ready') }
    });
}

// --- 화면 전환 ---
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}



// --- 로비 로직 ---
function openJoinScreen() {
    socket.emit('request_room_list');
    switchScreen('join-room-screen');
}

function openCreateScreen() {
    switchScreen('create-room-screen');
}

socket.on('update_room_list', (roomList) => {
    const container = document.getElementById('room-list-container');
    container.innerHTML = '';
    if (roomList.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:gray;">현재 생성된 방이 없습니다.</p>';
        return;
    }
    
    roomList.forEach(room => {
        const div = document.createElement('div');
        div.className = 'room-item';
        div.innerHTML = `
            <div>
                <div class="room-item-title">${room.name} ${room.hasPassword ? '🔒' : ''}</div>
                <div class="room-item-info">모드: ${room.mode} | 인원: ${room.currentPlayers}/${room.maxPlayers}</div>
            </div>
            <button class="btn btn-inline" style="width:auto; margin:0; padding:10px 15px;">참여</button>
        `;
        div.onclick = () => tryJoinRoom(room);
        container.appendChild(div);
    });
});

function tryJoinRoom(room) {
    if (room.currentPlayers >= room.maxPlayers) return alert('방이 꽉 찼습니다.');
    let pw = '';
    if (room.hasPassword) {
        pw = prompt('비밀번호를 입력하세요:');
        if (pw === null) return;
    }
    socket.emit('join_room', { roomId: room.id, password: pw, playerName: myNickname });
}

function requestCreateRoom() {
    const name = document.getElementById('new-room-name').value.trim();
    if (!name) return alert('방 제목을 입력하세요.');
    
    socket.emit('create_room', {
        name: name,
        password: document.getElementById('new-room-pw').value,
        maxPlayers: document.getElementById('new-room-max').value,
        mode: document.getElementById('new-room-mode').value,
        targetScore: document.getElementById('new-room-score').value
    });
}

socket.on('room_created', (roomId) => {
    // 내가 만든 방에 즉시 접속
    socket.emit('join_room', { 
        roomId: roomId, 
        password: document.getElementById('new-room-pw').value, 
        playerName: myNickname 
    });
});

// --- 대기실 로직 ---
socket.on('update_room_info', (room) => {
    currentRoom = room;
    document.getElementById('lobby-room-name').innerText = room.name;
    document.getElementById('lobby-room-info').innerText = `모드: ${room.mode} | 목표: ${room.targetScore}점`;
    
    const grid = document.getElementById('player-grid');
    grid.innerHTML = '';
    
    const amIHost = room.host === socket.id;
    let allReady = true;

    Object.values(room.players).forEach(p => {
        const card = document.createElement('div');
        card.className = `player-card ${p.isHost ? 'host' : ''} ${p.isReady ? 'ready' : ''}`;
        card.innerHTML = `
            <span>${p.isHost ? '👑' : '👤'} ${p.name} ${p.id === socket.id ? '(나)' : ''}</span>
            <span style="font-size:0.8em;">${p.isHost ? '방장' : (p.isReady ? 'READY' : '대기중')}</span>
        `;
        grid.appendChild(card);
        if (!p.isReady) allReady = false;
    });

    // 하단 버튼 구성
    const controls = document.getElementById('lobby-controls');
    if (amIHost) {
        controls.innerHTML = `<button class="btn" style="background:${allReady ? 'var(--success-color)' : 'var(--btn-bg)'}; color:#000;" onclick="startGame()" ${!allReady ? 'disabled' : ''}>게임 시작 (START)</button>`;
    } else {
        const myInfo = room.players[socket.id];
        controls.innerHTML = `<button class="btn" style="${myInfo.isReady ? 'background:var(--success-color); color:#000;' : ''}" onclick="toggleReady()">${myInfo.isReady ? '준비 완료!' : '준비하기 (READY)'}</button>`;
    }

    switchScreen('waiting-room-screen');
});

function toggleReady() { socket.emit('toggle_ready'); }
function startGame() { socket.emit('start_game'); }
function leaveRoom() { 
    // 페이지 새로고침으로 깔끔하게 소켓 접속 해제 후 초기화
    location.reload(); 
}

socket.on('error_msg', (msg) => alert(msg));

// --- 인게임 로직 ---
// script.js 에서 // --- 인게임 로직 --- 아래에 있던 기존 코드들을 싹 지우고 아래로 교체하세요.

let localCountdownInterval = null;
let answerTimerInterval = null;

socket.on('game_started', () => {
    switchScreen('game-screen');
    renderScoreboard(currentRoom.players);
});

// 카운트다운 화면 처리
socket.on('countdown_start', () => {
    const countdownText = document.getElementById('countdown-text');
    const statusText = document.getElementById('status-text');
    const btnBuzz = document.getElementById('btn-buzz');
    
    document.getElementById('answer-input-area').classList.add('hidden');
    btnBuzz.disabled = true; // 반칙 방지를 위해 버저 잠금
    statusText.innerText = "준비하세요...";
    countdownText.style.display = 'block';
    
    let count = 3;
    countdownText.innerText = count;
    
    clearInterval(localCountdownInterval);
    localCountdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownText.innerText = count;
        } else {
            clearInterval(localCountdownInterval);
            countdownText.style.display = 'none';
        }
    }, 1000);
});

socket.on('play_question', (qIndex) => {
    const q = window.quizData[qIndex];
    document.getElementById('category-text').innerText = `주제: ${q.category}`;
    document.getElementById('status-text').innerText = "🔊 소리를 듣고 버저를 누르세요!";
    
    document.getElementById('btn-buzz').disabled = false; // 버저 활성화

    if (ytPlayer && ytPlayer.loadVideoById) {
        ytPlayer.loadVideoById({ videoId: q.videoId, startSeconds: q.startSeconds });
    }
});

// 버저 클릭 이벤트
document.getElementById('btn-buzz').addEventListener('click', () => {
    socket.emit('buzz');
});

socket.on('buzzer_hit', (playerInfo) => {
    document.getElementById('btn-buzz').disabled = true;
    if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();

    const statusText = document.getElementById('status-text');
    const inputArea = document.getElementById('answer-input-area');
    const typeInput = document.getElementById('type-answer');
    const timerSpan = document.getElementById('answer-timer');

    if (playerInfo.id === socket.id) {
        // 내가 누른 경우 정답 입력창 보이기
        statusText.innerText = "정답을 입력하세요!";
        inputArea.classList.remove('hidden');
        typeInput.value = '';
        typeInput.focus();
    } else {
        // 남이 누른 경우
        statusText.innerText = `✋ ${playerInfo.name}님이 정답을 입력 중입니다...`;
        inputArea.classList.add('hidden');
    }

    // 10초 시각적 타이머
    let timeLeft = 10;
    timerSpan.innerText = timeLeft;
    clearInterval(answerTimerInterval);
    answerTimerInterval = setInterval(() => {
        timeLeft--;
        timerSpan.innerText = timeLeft;
        if (timeLeft <= 0) clearInterval(answerTimerInterval);
    }, 1000);
});

// 정답 전송 로직 (제출 버튼 클릭 또는 엔터키)
function submitAnswer() {
    const ans = document.getElementById('type-answer').value;
    if (!ans.trim()) return;
    socket.emit('submit_answer', ans);
    document.getElementById('answer-input-area').classList.add('hidden');
}

document.getElementById('btn-submit-answer').addEventListener('click', submitAnswer);
document.getElementById('type-answer').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitAnswer();
});

// 채점 결과 수신
socket.on('judge_result', (data) => {
    clearInterval(answerTimerInterval);
    document.getElementById('answer-input-area').classList.add('hidden');
    document.getElementById('status-text').innerText = data.msg;
    renderScoreboard(data.players);
});

// 점수판 렌더링 함수
function renderScoreboard(players) {
    const board = document.getElementById('game-scoreboard');
    board.innerHTML = '';
    Object.values(players).forEach(p => {
        board.innerHTML += `<div class="score-badge">${p.name}: <span style="color:var(--correct-color);">${p.score}점</span></div>`;
    });
}
