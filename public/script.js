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

    // 5. 게임 시작 (방장 전용)
    socket.on('start_game', () => {
        const room = rooms[socket.roomId];
        if (!room || room.host !== socket.id) return;

        // 모두 레디했는지 확인
        const allReady = Object.values(room.players).every(p => p.isReady);
        if (!allReady) return socket.emit('error_msg', '모든 플레이어가 준비해야 합니다.');

        room.state = 'PLAYING';
        io.to(socket.roomId).emit('game_started');
    });

    // 6. 버저 및 게임 진행 로직
    socket.on('buzz', () => {
        const room = rooms[socket.roomId];
        if (!room || room.state !== 'PLAYING' || !room.players[socket.id]) return;
        
        room.state = 'BUZZED';
        room.buzzedPlayer = room.players[socket.id];
        io.to(socket.roomId).emit('buzzer_hit', room.buzzedPlayer);
    });

    socket.on('judge', (isCorrect) => {
        const room = rooms[socket.roomId];
        if (!room || room.state !== 'BUZZED' || room.host !== socket.id) return;

        if (isCorrect) {
            room.players[room.buzzedPlayer.id].score += 1;
        } else {
            Object.values(room.players).forEach(p => {
                if (p.id !== room.buzzedPlayer.id) p.score += 1;
            });
        }
        
        room.state = 'PLAYING'; // 다시 문제 풀 수 있는 상태로
        io.to(socket.roomId).emit('judge_result', { 
            isCorrect, 
            buzzedPlayer: room.buzzedPlayer,
            players: room.players
        });
    });

    socket.on('next_question', (questionData) => {
        const room = rooms[socket.roomId];
        if (!room || room.host !== socket.id) return;
        
        room.state = 'PLAYING';
        room.buzzedPlayer = null;
        io.to(socket.roomId).emit('play_question', questionData);
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
