const io = require('socket.io')(3000, { cors: { origin: "*" } });
const roomManager = require('./roomManager');
const axios = require('axios'); // FastAPI 통신용

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('create_room', (data) => {
        const roomId = roomManager.createRoom(socket.id);
        roomManager.joinRoom(roomId, { id: socket.id, nickname: data.nickname });
        socket.join(roomId);
        socket.emit('room_update', { roomId, isHost: true });
    });

    socket.on('submit_answer', async (data) => {
        // FastAPI로 정답 판별 요청
        try {
            const response = await axios.post('http://localhost:8000/api/grade', {
                user_input: data.answer,
                correct_answers: ["겨울왕국", "겨울 왕국", "frozen"] // 임시 DB 데이터
            });

            if (response.data.is_correct) {
                io.to(data.roomId).emit('answer_result', { winner: data.nickname });
                // 점수 업데이트 로직 추가
            }
        } catch (error) {
            console.error("Scoring error:", error);
        }
    });
});