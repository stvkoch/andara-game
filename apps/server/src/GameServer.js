import { GameRoom } from './GameRoom.js';
import { v4 as uuidv4 } from 'uuid';

export class GameServer {
  constructor() {
    this.rooms = new Map(); // roomId -> GameRoom
    this.players = new Map(); // ws -> PlayerInfo
    this.maxRooms = 100;
    this.maxPlayersPerRoom = 10;
  }

  /**
   * Get or create a room for a player
   */
  getOrCreateRoom(roomId = null) {
    if (roomId && this.rooms.has(roomId)) {
      return this.rooms.get(roomId);
    }

    // Find a room with available space
    for (const [id, room] of this.rooms.entries()) {
      if (room.getPlayerCount() < this.maxPlayersPerRoom) {
        return room;
      }
    }

    // Create new room if none available
    if (this.rooms.size < this.maxRooms) {
      const newRoomId = roomId || uuidv4();
      const room = new GameRoom(newRoomId);
      this.rooms.set(newRoomId, room);
      return room;
    }

    return null; // Server at capacity
  }

  /**
   * Handle incoming WebSocket message
   */
  handleMessage(ws, data) {
    const { type, payload } = data;

    switch (type) {
      case 'join':
        this.handleJoin(ws, payload);
        break;
      
      case 'playerInput':
        this.handlePlayerInput(ws, payload);
        break;
      
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
      
      default:
        console.warn(`Unknown message type: ${type}`);
    }
  }

  /**
   * Handle player joining a room
   */
  handleJoin(ws, payload) {
    const { roomId, playerName } = payload || {};
    
    // Get or create room
    const room = this.getOrCreateRoom(roomId);
    
    if (!room) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Server at capacity. Please try again later.'
      }));
      return;
    }

    // Add player to room
    const playerId = uuidv4();
    const player = room.addPlayer(ws, playerId, playerName || `Player${playerId.substring(0, 6)}`);
    
    if (!player) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to join room'
      }));
      return;
    }

    // Store player info
    this.players.set(ws, {
      playerId,
      roomId: room.id,
      playerName: player.name
    });

    // Send join confirmation
    ws.send(JSON.stringify({
      type: 'joined',
      roomId: room.id,
      playerId: playerId,
      gameState: room.getGameState()
    }));

    // Notify other players
    room.broadcast({
      type: 'playerJoined',
      playerId: playerId,
      playerName: player.name,
      playerCount: room.getPlayerCount()
    }, ws);

    console.log(`Player ${playerId} joined room ${room.id}`);
  }

  /**
   * Handle player input
   */
  handlePlayerInput(ws, payload) {
    const playerInfo = this.players.get(ws);
    
    if (!playerInfo) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Not in a room. Please join first.'
      }));
      return;
    }

    const room = this.rooms.get(playerInfo.roomId);
    
    if (!room) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Room not found'
      }));
      return;
    }

    // Update player input in room
    room.updatePlayerInput(playerInfo.playerId, {
      ...payload,
      timestamp: Date.now()
    });
  }

  /**
   * Handle player disconnect
   */
  handleDisconnect(ws) {
    const playerInfo = this.players.get(ws);
    
    if (!playerInfo) {
      return;
    }

    const room = this.rooms.get(playerInfo.roomId);
    
    if (room) {
      room.removePlayer(playerInfo.playerId);
      
      // Notify other players
      room.broadcast({
        type: 'playerLeft',
        playerId: playerInfo.playerId,
        playerCount: room.getPlayerCount()
      });

      // Clean up empty rooms after a delay
      if (room.getPlayerCount() === 0) {
        setTimeout(() => {
          if (room.getPlayerCount() === 0) {
            this.rooms.delete(room.id);
            console.log(`Room ${room.id} cleaned up`);
          }
        }, 60000); // 1 minute delay
      }
    }

    this.players.delete(ws);
    console.log(`Player ${playerInfo.playerId} disconnected`);
  }
}

