class RoomManager {
    constructor() {
        this.rooms = new Map();
    }

    createRoom(hostId) {
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        this.rooms.set(roomId, {
            id: roomId,
            host_id: hostId,
            players: [],
            status: "WAITING",
            target_score: 20
        });
        return roomId;
    }

    joinRoom(roomId, player) {
        const room = this.rooms.get(roomId);
        if (room && room.status === "WAITING") {
            room.players.push({ id: player.id, nickname: player.nickname, score: 0 });
            return true;
        }
        return false;
    }
    
    // 추가 로직: 게임 시작, 라운드 관리 등
    disconnectPlayer(socketId) {
        // 모든 방을 순회하며 해당 플레이어를 찾아 '연결 끊김' 상태로 변경
        this.rooms.forEach(room => {
            const player = room.players.find(p => p.id === socketId);
            if (player) {
                player.status = 'DISCONNECTED';
                // 5분(300000ms) 내에 안 돌아오면 방에서 완전히 퇴장 처리
                player.timeout = setTimeout(() => {
                    room.players = room.players.filter(p => p.id !== socketId);
                }, 300000); 
            }
        });
    }

    reconnectPlayer(oldNickname, newSocketId, roomId) {
        const room = this.rooms.get(roomId);
        if (room) {
            const player = room.players.find(p => p.nickname === oldNickname && p.status === 'DISCONNECTED');
            if (player) {
                clearTimeout(player.timeout); // 퇴장 타이머 취소
                player.id = newSocketId;      // 새로운 소켓 선으로 교체
                player.status = 'ACTIVE';     // 상태 복구 (점수 유지됨)
                return true;
            }
        }
        return false;
    }
}
module.exports = new RoomManager();
