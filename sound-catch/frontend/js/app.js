// UI State Management
const titleScreen = document.getElementById('title-screen');
const roomSelection = document.getElementById('room-selection');
const gameScreen = document.getElementById('game-screen');

document.getElementById('btn-start').addEventListener('click', () => {
    const nickname = document.getElementById('nickname').value;
    if (!nickname) return alert("닉네임을 입력해주세요!");
    
    // 소켓 연결 및 닉네임 저장
    initSocket(nickname); 
    
    titleScreen.classList.add('hidden');
    roomSelection.classList.remove('hidden');
});

document.getElementById('btn-create-room').addEventListener('click', () => {
    socket.emit('create_room', { nickname: document.getElementById('nickname').value });
    roomSelection.classList.add('hidden');
    gameScreen.classList.remove('hidden');
});

document.getElementById('answer-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        submitAnswer(e.target.value);
        e.target.value = '';
    }
});