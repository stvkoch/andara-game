import { v4 as uuidv4 } from 'uuid';

export class GameRoom {
  constructor(id) {
    this.id = id;
    this.players = new Map(); // playerId -> Player
    this.gameState = {
      ships: new Map(), // playerId -> ShipState
      lasers: [],
      obstacles: [],
      stars: [],
      width: 1920,
      height: 1080,
      lastUpdate: Date.now()
    };
    this.gameLoopInterval = null;
    this.tickRate = 60; // Updates per second
    this.lastTick = Date.now();
    
    // Initialize game world
    this.initializeWorld();
    
    // Start game loop
    this.startGameLoop();
  }

  /**
   * Initialize game world (obstacles, stars, etc.)
   */
  initializeWorld() {
    // Generate stars
    for (let i = 0; i < 100; i++) {
      this.gameState.stars.push({
        x: Math.random() * this.gameState.width,
        y: Math.random() * this.gameState.height,
        size: Math.random() * 2,
        alpha: Math.random()
      });
    }

    // Generate initial obstacles
    this.generateObstacles(10);
  }

  /**
   * Generate obstacles
   */
  generateObstacles(count) {
    for (let i = 0; i < count; i++) {
      const x = Math.random() * this.gameState.width;
      const y = Math.random() * this.gameState.height;
      this.gameState.obstacles.push({
        id: uuidv4(),
        x,
        y,
        size: 20 + Math.random() * 20
      });
    }
  }

  /**
   * Add player to room
   */
  addPlayer(ws, playerId, playerName) {
    if (this.players.has(playerId)) {
      return null;
    }

    // Create initial ship state
    const shipState = {
      id: playerId,
      name: playerName,
      position: {
        x: Math.random() * this.gameState.width,
        y: Math.random() * this.gameState.height
      },
      velocity: { x: 0, y: 0 },
      energy: 100,
      maxEnergy: 100,
      controlMode: 'ENGINE',
      engineAngle: 0,
      enginePower: 50,
      weaponAngle: 0,
      weaponPower: 50,
      shieldAngle: 0,
      shieldPower: 50,
      shieldActive: false,
      exploded: false,
      size: 20,
      color: this.getPlayerColor(this.players.size)
    };

    this.gameState.ships.set(playerId, shipState);

    const player = {
      id: playerId,
      name: playerName,
      ws,
      lastPing: Date.now()
    };

    this.players.set(playerId, player);
    return player;
  }

  /**
   * Get player color based on index
   */
  getPlayerColor(index) {
    const colors = [
      '#00f0ff', // Cyan
      '#ffaa00', // Orange
      '#ff00ff', // Magenta
      '#00ff00', // Green
      '#ff0000', // Red
      '#0000ff', // Blue
      '#ffff00', // Yellow
      '#ff8800', // Dark Orange
      '#00ffff', // Aqua
      '#ff0088'  // Pink
    ];
    return colors[index % colors.length];
  }

  /**
   * Remove player from room
   */
  removePlayer(playerId) {
    this.players.delete(playerId);
    this.gameState.ships.delete(playerId);
    
    // Remove player's lasers
    this.gameState.lasers = this.gameState.lasers.filter(
      laser => laser.ownerId !== playerId
    );
  }

  /**
   * Update player state from client and relay to other players
   */
  updatePlayerState(playerId, state) {
    const ship = this.gameState.ships.get(playerId);
    if (!ship) return;
    
    // Update ship state from client
    if (state.position) {
      ship.position.x = state.position.x;
      ship.position.y = state.position.y;
    }
    if (state.velocity) {
      ship.velocity.x = state.velocity.x;
      ship.velocity.y = state.velocity.y;
    }
    if (state.energy !== undefined) ship.energy = state.energy;
    if (state.shieldPower !== undefined) ship.shieldPower = state.shieldPower;
    if (state.controlMode !== undefined) ship.controlMode = state.controlMode;
    if (state.engineAngle !== undefined) ship.engineAngle = state.engineAngle;
    if (state.enginePower !== undefined) ship.enginePower = state.enginePower;
    if (state.weaponAngle !== undefined) ship.weaponAngle = state.weaponAngle;
    if (state.weaponPower !== undefined) ship.weaponPower = state.weaponPower;
    if (state.shieldAngle !== undefined) ship.shieldAngle = state.shieldAngle;
    if (state.shieldEnergized !== undefined) {
      ship.shieldEnergized = state.shieldEnergized;
      ship.shieldActive = state.shieldEnergized || false;
    }
    
    // Update ping time
    const player = this.players.get(playerId);
    if (player) {
      player.lastPing = Date.now();
    }
    
    // Relay state update to other players
    this.broadcastStateUpdate(playerId, state);
  }
  
  /**
   * Broadcast state update to other players
   */
  broadcastStateUpdate(playerId, state) {
    const excludeWs = this.players.get(playerId)?.ws;
    this.broadcast({
      type: 'playerStateUpdate',
      playerId: playerId,
      state: state,
      timestamp: Date.now()
    }, excludeWs);
  }

  /**
   * Get player count
   */
  getPlayerCount() {
    return this.players.size;
  }

  /**
   * Get current game state
   */
  getGameState() {
    return {
      ...this.gameState,
      ships: Array.from(this.gameState.ships.values()),
      lasers: [...this.gameState.lasers],
      obstacles: [...this.gameState.obstacles],
      stars: [...this.gameState.stars]
    };
  }

  /**
   * Broadcast message to all players in room
   */
  broadcast(message, excludeWs = null) {
    const data = JSON.stringify(message);
    for (const [playerId, player] of this.players.entries()) {
      if (player.ws !== excludeWs && player.ws.readyState === 1) { // WebSocket.OPEN
        try {
          player.ws.send(data);
        } catch (error) {
          console.error(`Error sending to player ${playerId}:`, error);
        }
      }
    }
  }

  /**
   * Start game loop
   */
  startGameLoop() {
    const intervalMs = 1000 / this.tickRate;
    
    this.gameLoopInterval = setInterval(() => {
      this.update(intervalMs / 1000);
    }, intervalMs);
  }

  /**
   * Stop game loop
   */
  stopGameLoop() {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
  }

  /**
   * Update game state - just sends periodic state snapshots
   * Server only relays state updates, clients handle all physics
   */
  update(dt) {
    const now = Date.now();

    // Regenerate obstacles if needed (server manages obstacles)
    if (this.gameState.obstacles.length < 5) {
      this.generateObstacles(5);
    }

    // Send periodic state snapshot (positions, energy, etc.) - less frequent
    // Clients handle physics, server just syncs state
    if (now - this.gameState.lastUpdate > 100) { // Every 100ms
      const playerStates = this.getPlayerStates();
      const snapshot = {
        type: 'stateSnapshot',
        players: playerStates,
        obstacles: this.gameState.obstacles.map(o => ({
          id: o.id,
          x: o.x,
          y: o.y,
          size: o.size
        })),
        stars: this.gameState.stars,
        width: this.gameState.width,
        height: this.gameState.height,
        timestamp: now
      };
      
      console.log(`[SERVER] Broadcasting state snapshot: ${playerStates.length} players, ${this.gameState.obstacles.length} obstacles`);
      this.broadcast(snapshot);

      this.gameState.lastUpdate = now;
    }
  }


  /**
   * Get player states for snapshot
   */
  getPlayerStates() {
    const states = [];
    for (const [playerId, ship] of this.gameState.ships.entries()) {
      states.push({
        id: ship.id,
        position: { x: ship.position.x, y: ship.position.y },
        velocity: { x: ship.velocity.x, y: ship.velocity.y },
        energy: ship.energy,
        maxEnergy: ship.maxEnergy,
        controlMode: ship.controlMode,
        engineAngle: ship.engineAngle,
        enginePower: ship.enginePower,
        weaponAngle: ship.weaponAngle,
        weaponPower: ship.weaponPower,
        shieldAngle: ship.shieldAngle,
        shieldPower: ship.shieldPower,
        shieldActive: ship.shieldActive,
        shieldEnergized: ship.shieldEnergized || false,
        exploded: ship.exploded
      });
    }
    return states;
  }


}

