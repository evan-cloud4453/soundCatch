const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public')); // html, css, js 파일 위치

// 메모리 DB (추후 MongoDB 스키마 [Rooms Collection] 로 대체)
const rooms = {}; 

// 임시 퀴즈 데이터 (추후 MongoDB [Questions Collection] 로 대체)
const dummyQuestions = [
    { id: 1, category: "애니메이션", audio_url: "/audio/frozen.mp3", answers: ["겨울왕국", "겨울 왕국", "frozen"] },
    { id: 2, category: "동물", audio_url: "/audio/lion.mp3", answers: ["사자", "lion"] }
];

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // 1. 방 생성
    socket.on('create_room', (data) => {
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms[roomCode] = {
            id: roomCode,
            hostId: socket.id,
            status: 'WAITING',
            players: [{ id: socket.id, nickname: data.nickname, score: 0 }],
            currentQuestion: null
        };
        
        socket.join(roomCode);
        socket.emit('room_joined', { roomCode, isHost: true });
        io.to(roomCode).emit('room_update', rooms[roomCode].players);
    });

    // 2. 방 입장
    socket.on('join_room', (data) => {
        const room = rooms[data.roomCode];
        if (!room) return socket.emit('error_msg', '존재하지 않는 방입니다.');
        if (room.status !== 'WAITING') return socket.emit('error_msg', '이미 게임이 진행 중입니다.');

        room.players.push({ id: socket.id, nickname: data.nickname, score: 0 });
        socket.join(data.roomCode);
        
        socket.emit('room_joined', { roomCode: data.roomCode, isHost: false });
        io.to(data.roomCode).emit('room_update', room.players);
    });

    // 3. 게임(라운드) 시작
    socket.on('start_game', (data) => {
        const room = rooms[data.roomCode];
        if (room && room.hostId === socket.id) {
            room.status = 'PLAYING';
            startNextRound(data.roomCode);
        }
    });

    // 4. 정답 제출 및 채점
    socket.on('submit_answer', async (data) => {
        const room = rooms[data.roomCode];
        if (!room || room.status !== 'PLAYING') return;

        const player = room.players.find(p => p.id === socket.id);
        const question = room.currentQuestion;

        // ★ [기획서 5번 항목] 추후 FastAPI 채점 서버로 HTTP 통신을 보내는 위치입니다.
        // const isCorrect = await callFastAPIScoring(data.answer, question.answers);
        
        // 현재는 임시 로직 (완전 일치 검사)
        const isCorrect = question.answers.includes(data.answer.toLowerCase().replace(/\s/g, ''));

        if (isCorrect) {
            player.score += 1;
            room.status = 'WAITING'; // 라운드 종료
            
            io.to(data.roomCode).emit('answer_result', {
                isCorrect: true,
                winner: player.nickname,
                correctAnswer: question.answers[0]
            });
            io.to(data.roomCode).emit('room_update', room.players);

            // 승리 조건 검사 (예: 3점)
            if (player.score >= 3) {
                setTimeout(() => {
                    io.to(data.roomCode).emit('game_over', { winner: player.nickname });
                }, 3000);
            } else {
                setTimeout(() => startNextRound(data.roomCode), 3000); // 다음 라운드
            }
        }
    });

    socket.on('disconnect', () => {
        // 플레이어 이탈 처리 로직 필요
    });
});

function startNextRound(roomCode) {
    const room = rooms[roomCode];
    // 무작위 문제 선택
    const randomQ = dummyQuestions[Math.floor(Math.random() * dummyQuestions.length)];
    room.currentQuestion = randomQ;
    room.status = 'PLAYING';

    io.to(roomCode).emit('round_start', {
        category: randomQ.category,
        audio_url: randomQ.audio_url
    });

    // 15초 제한 타이머 (원작 규칙)
    setTimeout(() => {
        if (rooms[roomCode] && rooms[roomCode].status === 'PLAYING' && rooms[roomCode].currentQuestion.id === randomQ.id) {
            // 시간 초과 처리
            io.to(roomCode).emit('answer_result', {
                isCorrect: false,
                correctAnswer: randomQ.answers[0]
            });
            // 오답 시 다른 사람 모두에게 점수 부여하는 원작 규칙 추가 위치
            setTimeout(() => startNextRound(roomCode), 3000);
        }
    }, 15000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sound Catch Server running on port ${PORT}`);
});