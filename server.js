const quizData = [
    { category: '동물!', videoId: 'sS_tTj8H8sY', startSeconds: 2, answer: '사자' },
    { category: '애니메이션!', videoId: 'L0MK7qz13bU', startSeconds: 61, answer: '겨울왕국' },
    { category: '게임 소리!', videoId: 'NTa6XbzcqZI', startSeconds: 0, answer: '슈퍼 마리오' }
];


const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// 방 및 플레이어 데이터 관리
let rooms = {}; // { roomId: { name, host, maxPlayers, mode, password, targetScore, players: {}, state, buzzedPlayer } }

io.on('connection', (socket) => {
    console.log(`유저 접속: ${socket.id}`);

    // 1. 방 목록 전송 (로비 접속 시)
    socket.on('request_room_list', () => {
        const roomList = Object.keys(rooms).map(roomId => ({
            id: roomId,
            name: rooms[roomId].name,
            mode: rooms[roomId].mode,
            currentPlayers: Object.keys(rooms[roomId].players).length,
            maxPlayers: rooms[roomId].maxPlayers,
            hasPassword: !!rooms[roomId].password
        }));
        socket.emit('update_room_list', roomList);
    });

    // 2. 방 만들기
    socket.on('create_room', (data) => {
        const roomId = 'room_' + Date.now(); // 고유 방 ID 생성
        rooms[roomId] = {
            id: roomId,
            name: data.name,
            host: socket.id,
            maxPlayers: parseInt(data.maxPlayers),
            mode: data.mode,
            password: data.password,
            targetScore: parseInt(data.targetScore),
            players: {},
            state: 'WAITING', // WAITING, PLAYING, BUZZED
            buzzedPlayer: null
        };
        socket.emit('room_created', roomId);
        io.emit('update_room_list', getRoomList()); // 모든 유저에게 방 목록 갱신
    });

    // 3. 방 들어가기
    socket.on('join_room', (data) => {
        const room = rooms[data.roomId];
        if (!room) return socket.emit('error_msg', '존재하지 않는 방입니다.');
        if (room.password && room.password !== data.password) return socket.emit('error_msg', '비밀번호가 틀렸습니다.');
        if (Object.keys(room.players).length >= room.maxPlayers) return socket.emit('error_msg', '방이 가득 찼습니다.');
        if (room.state !== 'WAITING') return socket.emit('error_msg', '이미 게임이 진행 중인 방입니다.');

        // 기존 방이 있다면 나가기
        leaveCurrentRoom(socket);

        // 새 방 접속
        socket.join(data.roomId);
        room.players[socket.id] = {
            id: socket.id,
            name: data.playerName,
            isHost: room.host === socket.id,
            isReady: room.host === socket.id, // 방장은 항상 레디 상태
            score: 0
        };
        socket.roomId = data.roomId;

        io.to(data.roomId).emit('update_room_info', room);
        io.emit('update_room_list', getRoomList());
    });

    // 4. 레디(준비) 상태 변경
    socket.on('toggle_ready', () => {
        const room = rooms[socket.roomId];
        if (!room || room.players[socket.id].isHost) return;
        
        room.players[socket.id].isReady = !room.players[socket.id].isReady;
        io.to(socket.roomId).emit('update_room_info', room);
    });

    function playNextQuestion(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    
    room.state = 'WAITING_QUESTION';
    io.to(roomId).emit('countdown_start'); // 3초 카운트다운 명령
    
    setTimeout(() => {
        if(!rooms[roomId]) return;
        room.state = 'PLAYING';
        room.buzzedPlayer = null;
        const qIndex = Math.floor(Math.random() * quizData.length);
        room.currentQuestionIndex = qIndex;
        io.to(roomId).emit('play_question', qIndex); // 문제 출제
    }, 3000); // 3초 대기
}

socket.on('start_game', () => {
    const room = rooms[socket.roomId];
    if (!room || room.host !== socket.id) return;
    
    const allReady = Object.values(room.players).every(p => p.isReady);
    if (!allReady) return socket.emit('error_msg', '모든 플레이어가 준비해야 합니다.');

    io.to(socket.roomId).emit('game_started');
    playNextQuestion(socket.roomId);
});

socket.on('buzz', () => {
    const room = rooms[socket.roomId];
    if (!room || room.state !== 'PLAYING' || !room.players[socket.id]) return;
    
    room.state = 'BUZZED';
    room.buzzedPlayer = room.players[socket.id];
    io.to(socket.roomId).emit('buzzer_hit', room.buzzedPlayer);

    // 10초 타이머 시작
    room.answerTimeout = setTimeout(() => {
        if (rooms[socket.roomId] && rooms[socket.roomId].state === 'BUZZED') {
            // 시간 초과: 나머지 인원에게 1점씩
            Object.values(room.players).forEach(p => {
                if (p.id !== room.buzzedPlayer.id) p.score += 1;
            });
            io.to(socket.roomId).emit('judge_result', {
                isCorrect: false,
                msg: '시간 초과! 다른 플레이어들이 점수를 얻습니다.',
                players: room.players
            });
            setTimeout(() => playNextQuestion(socket.roomId), 3000); // 3초 후 다음 문제
        }
    }, 10000);
});

socket.on('submit_answer', (userAnswer) => {
    const room = rooms[socket.roomId];
    if (!room || room.state !== 'BUZZED' || room.buzzedPlayer.id !== socket.id) return;
    
    clearTimeout(room.answerTimeout); // 10초 타이머 정지

    const correctAnswer = quizData[room.currentQuestionIndex].answer;
    // 띄어쓰기를 모두 제거한 후 정답 비교
    const isCorrect = (userAnswer.replace(/\s+/g, '') === correctAnswer.replace(/\s+/g, ''));

    if (isCorrect) {
        room.players[socket.id].score += 1;
        io.to(socket.roomId).emit('judge_result', {
            isCorrect: true,
            msg: `정답입니다! ${room.buzzedPlayer.name}님 +1점!`,
            players: room.players
        });
    } else {
        Object.values(room.players).forEach(p => {
            if (p.id !== room.buzzedPlayer.id) p.score += 1;
        });
        io.to(socket.roomId).emit('judge_result', {
            isCorrect: false,
            msg: `오답입니다! 다른 플레이어들이 점수를 얻습니다. (정답: ${correctAnswer})`,
            players: room.players
        });
    }
    
    room.state = 'WAITING_QUESTION';
    setTimeout(() => playNextQuestion(socket.roomId), 3000); // 3초 후 다음 문제
});
    
    // 접속 종료 시
    socket.on('disconnect', () => {
        console.log(`유저 퇴장: ${socket.id}`);
        leaveCurrentRoom(socket);
    });

    // --- 유틸 함수 ---
    function leaveCurrentRoom(socket) {
        if (!socket.roomId || !rooms[socket.roomId]) return;
        const room = rooms[socket.roomId];
        
        delete room.players[socket.id];
        socket.leave(socket.roomId);

        // 남은 인원이 없으면 방 폭파, 아니면 호스트 승계
        if (Object.keys(room.players).length === 0) {
            delete rooms[socket.roomId];
        } else if (room.host === socket.id) {
            const nextHostId = Object.keys(room.players)[0];
            room.host = nextHostId;
            room.players[nextHostId].isHost = true;
            room.players[nextHostId].isReady = true;
            io.to(socket.roomId).emit('update_room_info', room);
        } else {
            io.to(socket.roomId).emit('update_room_info', room);
        }
        io.emit('update_room_list', getRoomList());
        socket.roomId = null;
    }

    function getRoomList() {
        return Object.keys(rooms).map(roomId => ({
            id: roomId,
            name: rooms[roomId].name,
            mode: rooms[roomId].mode,
            currentPlayers: Object.keys(rooms[roomId].players).length,
            maxPlayers: rooms[roomId].maxPlayers,
            hasPassword: !!rooms[roomId].password
        }));
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});
