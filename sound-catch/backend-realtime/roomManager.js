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
}
module.exports = new RoomManager();
