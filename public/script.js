const socket = io();
let ytPlayer;
let myPlayerInfo = null;
let currentQuestionIndex = null;

// 유튜브 Iframe API 초기화 (index.html에서 라이브러리 로드 후 자동 실행됨)
function onYouTubeIframeAPIReady() {
    ytPlayer = new YT.Player('youtube-player', {
        height: '0',
        width: '0',
        playerVars: { 'autoplay': 0, 'controls': 0 },
        events: {
            'onReady': () => console.log('유튜브 플레이어 로드 완료')
        }
    });
}

// UI 엘리먼트
const btnRegister = document.getElementById('btn-register');
const setupArea = document.getElementById('setup-area');
const gameArea = document.getElementById('game-area');
const scoreboard = document.getElementById('scoreboard');
const btnNext = document.getElementById('btn-next');
const btnBuzz = document.getElementById('btn-buzz');
const judgeArea = document.getElementById('judge-area');
const categoryText = document.getElementById('category-text');
const statusText = document.getElementById('status-text');
const answerText = document.getElementById('answer-text');

// 1. 등록하기
btnRegister.addEventListener('click', () => {
    socket.emit('register');
});

// 2. 서버 통신: 플레이어 업데이트
socket.on('update_players', (players) => {
    // 내가 등록 성공했는지 확인
    if (!myPlayerInfo) {
        const me = players.find(p => p.id === socket.id);
        if (me) {
            myPlayerInfo = me;
            setupArea.classList.add('hidden');
            gameArea.classList.remove('hidden');
            btnBuzz.innerText = `${me.color} 버저!`;
        }
    }

    // 스코어보드 다시 그리기
    scoreboard.innerHTML = '';
    players.forEach(p => {
        const card = document.createElement('div');
        card.className = `score-card color-${p.color}`;
        card.innerText = `${p.color}: ${p.score}점`;
        scoreboard.appendChild(card);
    });
});

socket.on('error_msg', (msg) => alert(msg));

// 3. 문제 출제 (누구든 '다음 문제' 버튼을 누르면 서버에 요청)
btnNext.addEventListener('click', () => {
    const randomIndex = Math.floor(Math.random() * window.quizData.length);
    socket.emit('next_question', randomIndex);
});

// 서버로부터 문제 재생 명령 받음
socket.on('play_question', (qIndex) => {
    currentQuestionIndex = qIndex;
    const q = window.quizData[qIndex];
    
    categoryText.innerText = `주제: ${q.category}`;
    statusText.innerText = "🔊 소리를 듣고 버저를 누르세요!";
    judgeArea.classList.add('hidden');
    btnBuzz.disabled = false;

    // 유튜브 지정된 시간부터 재생
    if (ytPlayer && ytPlayer.loadVideoById) {
        ytPlayer.loadVideoById({
            videoId: q.videoId,
            startSeconds: q.startSeconds
        });
    }
});

// 4. 버저 누르기
btnBuzz.addEventListener('click', () => {
    socket.emit('buzz');
});

// 누군가 버저를 가장 먼저 눌렀을 때
socket.on('buzzer_hit', (playerInfo) => {
    btnBuzz.disabled = true; // 버저 잠금
    
    // 재생 중인 소리 중지
    if (ytPlayer && ytPlayer.pauseVideo) {
        ytPlayer.pauseVideo();
    }

    statusText.innerText = `✋ ${playerInfo.color} 플레이어 호명! 정답을 외치세요!`;
    
    // 모두에게 판정 화면 노출
    const q = window.quizData[currentQuestionIndex];
    answerText.innerText = `정답: ${q.answer}`;
    judgeArea.classList.remove('hidden');
});

// 5. 정답 판정 (누구든 O/X 버튼을 누르면 서버에 전송)
document.getElementById('btn-correct').addEventListener('click', () => {
    socket.emit('judge', true);
});
document.getElementById('btn-wrong').addEventListener('click', () => {
    socket.emit('judge', false);
});

// 판정 결과 수신
socket.on('judge_result', ({ isCorrect, buzzedPlayer }) => {
    judgeArea.classList.add('hidden');
    if (isCorrect) {
        statusText.innerText = `✅ 정답입니다! ${buzzedPlayer.color} 점수 획득! (다음 문제를 눌러주세요)`;
    } else {
        statusText.innerText = `❌ 틀렸습니다! 다른 플레이어들이 점수를 얻습니다. (다음 문제를 눌러주세요)`;
    }
});


// --- UI 제어 함수 ---
// 화면 전환을 처리합니다.
function switchScreen(screenId) {
    // 모든 스크린에서 active 클래스 제거
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    // 요청된 스크린에 active 클래스 추가
    document.getElementById(screenId).classList.add('active');
}

// 앞으로 여기에 서버 통신(Socket) 코드 및 
// 방 접속, 문제 풀이 로직을 추가해 나갈 예정입니다.
