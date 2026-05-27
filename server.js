const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let players = {}; // 접속한 플레이어 정보 저장
let gameState = 'WAITING'; // WAITING, PLAYING, BUZZED, JUDGING
let buzzedPlayer = null;

const COLORS = ['빨강', '파랑', '노랑', '초록', '보라'];
let availableColors = [...COLORS];

io.on('connection', (socket) => {
    console.log(`유저 접속: ${socket.id}`);

    // 플레이어 색상 선택 및 등록
    socket.on('register', () => {
        if (Object.keys(players).length >= 5) {
            socket.emit('error_msg', '최대 5명까지만 참여할 수 있습니다.');
            return;
        }
        if (players[socket.id]) return;

        const color = availableColors.shift();
        players[socket.id] = { id: socket.id, color: color, score: 0 };
        
        io.emit('update_players', Object.values(players));
    });

    // 게임 시작 (또는 다음 문제)
    socket.on('next_question', (questionData) => {
        gameState = 'PLAYING';
        buzzedPlayer = null;
        io.emit('play_question', questionData);
    });

    // 버저 누름 (선착순 처리)
    socket.on('buzz', () => {
        if (gameState !== 'PLAYING' || !players[socket.id]) return;
        
        gameState = 'BUZZED';
        buzzedPlayer = players[socket.id];
        
        // 가장 먼저 누른 사람의 정보 브로드캐스트
        io.emit('buzzer_hit', buzzedPlayer);
    });

    // 정답 판정
    socket.on('judge', (isCorrect) => {
        if (gameState !== 'BUZZED' || !buzzedPlayer) return;

        if (isCorrect) {
            players[buzzedPlayer.id].score += 1;
        } else {
            // 틀렸을 경우 나머지 모든 사람에게 1점씩
            Object.values(players).forEach(p => {
                if (p.id !== buzzedPlayer.id) p.score += 1;
            });
        }
        
        gameState = 'JUDGING';
        io.emit('update_players', Object.values(players));
        io.emit('judge_result', { isCorrect, buzzedPlayer });
    });

    // 접속 해제 시 처리
    socket.on('disconnect', () => {
        console.log(`유저 퇴장: ${socket.id}`);
        if (players[socket.id]) {
            availableColors.push(players[socket.id].color);
            delete players[socket.id];
            io.emit('update_players', Object.values(players));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});