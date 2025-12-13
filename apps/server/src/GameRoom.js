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
      lastInput: null,
      lastPing: Date.now(),
      lastProcessedActions: {
        shouldLaunch: false,
        shouldFire: false
      },
      lastShieldEnergized: false
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
   * Update player input
   */
  updatePlayerInput(playerId, input) {
    const player = this.players.get(playerId);
    if (player) {
      player.lastInput = input;
      player.lastPing = Date.now();
    }
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
   * Update game state - now only sends periodic state snapshots
   * Clients handle all physics locally
   */
  update(dt) {
    const now = Date.now();
    
    // Only update player input states (no physics simulation)
    for (const [playerId, player] of this.players.entries()) {
      const ship = this.gameState.ships.get(playerId);
      if (!ship || ship.exploded) continue;

      // Update ship state from player input (angles, powers, etc.)
      if (player.lastInput) {
        this.updateShipState(ship, player.lastInput, player);
      }
    }

    // Regenerate obstacles if needed (server manages obstacles)
    if (this.gameState.obstacles.length < 5) {
      this.generateObstacles(5);
    }

    // Send periodic state snapshot (positions, energy, etc.) - less frequent
    // Clients handle physics, server just syncs state
    if (now - this.gameState.lastUpdate > 100) { // Every 100ms instead of every frame
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
   * Update ship state from player input (no physics, just state)
   */
  updateShipState(ship, input, player) {
    // Update control mode
    if (input.controlMode) {
      ship.controlMode = input.controlMode;
    }

    // Update angles and powers
    if (input.engineAngle !== undefined) ship.engineAngle = input.engineAngle;
    if (input.enginePower !== undefined) ship.enginePower = input.enginePower;
    if (input.weaponAngle !== undefined) ship.weaponAngle = input.weaponAngle;
    if (input.weaponPower !== undefined) ship.weaponPower = input.weaponPower;
    if (input.shieldAngle !== undefined) ship.shieldAngle = input.shieldAngle;
    if (input.shieldPower !== undefined) ship.shieldPower = input.shieldPower;

    // Handle shield state
    if (input.shieldEnergized !== undefined) {
      const shieldStateChanged = ship.shieldEnergized !== input.shieldEnergized;
      ship.shieldEnergized = input.shieldEnergized;
      ship.shieldActive = ship.shieldEnergized || false;
      
      // Broadcast shield state change as action
      if (shieldStateChanged) {
        const action = {
          type: 'playerShieldChange',
          playerId: ship.id,
          shieldEnergized: ship.shieldEnergized,
          shieldAngle: ship.shieldAngle,
          shieldPower: ship.shieldPower,
          timestamp: Date.now()
        };
        console.log(`[SERVER] Broadcasting action: ${action.type} from player ${ship.id.substring(0, 8)}, energized: ${ship.shieldEnergized}`);
        this.broadcastAction(action, ship.id);
      }
    } else {
      ship.shieldActive = ship.shieldEnergized || false;
    }

    // Broadcast actions to other players (client handles physics)
    // Only broadcast if this is a new action (wasn't processed before)
    if (input.shouldLaunch && !player.lastProcessedActions.shouldLaunch) {
      const action = {
        type: 'playerLaunch',
        playerId: ship.id,
        engineAngle: ship.engineAngle,
        enginePower: ship.enginePower,
        timestamp: Date.now()
      };
      console.log(`[SERVER] Broadcasting action: ${action.type} from player ${ship.id.substring(0, 8)}`);
      this.broadcastAction(action, ship.id);
      player.lastProcessedActions.shouldLaunch = true;
    } else if (!input.shouldLaunch) {
      // Reset flag when action is no longer active
      player.lastProcessedActions.shouldLaunch = false;
    }

    if (input.shouldFire && !player.lastProcessedActions.shouldFire) {
      const action = {
        type: 'playerFire',
        playerId: ship.id,
        weaponAngle: ship.weaponAngle,
        weaponPower: ship.weaponPower,
        position: { x: ship.position.x, y: ship.position.y },
        timestamp: Date.now()
      };
      console.log(`[SERVER] Broadcasting action: ${action.type} from player ${ship.id.substring(0, 8)} at (${action.position.x.toFixed(1)}, ${action.position.y.toFixed(1)})`);
      this.broadcastAction(action, ship.id);
      player.lastProcessedActions.shouldFire = true;
    } else if (!input.shouldFire) {
      // Reset flag when action is no longer active
      player.lastProcessedActions.shouldFire = false;
    }
  }

  /**
   * Broadcast action to all players except sender
   */
  broadcastAction(action, excludePlayerId = null) {
    const excludeWs = excludePlayerId ? this.players.get(excludePlayerId)?.ws : null;
    this.broadcast({
      type: 'action',
      action: action
    }, excludeWs);
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


  /**
   * Update player position from client (client sends position updates periodically)
   */
  updatePlayerPosition(playerId, position, velocity, energy) {
    const ship = this.gameState.ships.get(playerId);
    if (ship) {
      const oldPos = { x: ship.position.x, y: ship.position.y };
      ship.position.x = position.x;
      ship.position.y = position.y;
      ship.velocity.x = velocity.x;
      ship.velocity.y = velocity.y;
      ship.energy = energy;
      
      // Log if position changed significantly
      const dx = Math.abs(position.x - oldPos.x);
      const dy = Math.abs(position.y - oldPos.y);
      if (dx > 1 || dy > 1) {
        console.log(`[SERVER] Updated player ${playerId.substring(0, 8)} position: (${oldPos.x.toFixed(1)}, ${oldPos.y.toFixed(1)}) -> (${position.x.toFixed(1)}, ${position.y.toFixed(1)}), energy: ${energy.toFixed(1)}`);
      }
    }
  }

  /**
   * Update player energy from laser hit and broadcast to other players
   */
  updatePlayerEnergy(playerId, energy, shieldPower) {
    const ship = this.gameState.ships.get(playerId);
    if (ship) {
      const oldEnergy = ship.energy;
      ship.energy = energy;
      if (shieldPower !== undefined) {
        ship.shieldPower = shieldPower;
      }
      
      // Broadcast energy change action to other players
      const action = {
        type: 'playerEnergyChange',
        playerId: playerId,
        energy: energy,
        shieldPower: shieldPower,
        timestamp: Date.now()
      };
      console.log(`[SERVER] Broadcasting energy change: player ${playerId.substring(0, 8)} energy ${oldEnergy.toFixed(1)} -> ${energy.toFixed(1)}`);
      this.broadcastAction(action, playerId);
    }
  }
}

