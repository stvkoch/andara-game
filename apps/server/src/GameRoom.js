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
   * Update game state
   */
  update(dt) {
    const now = Date.now();
    
    // Update each ship based on player input
    for (const [playerId, player] of this.players.entries()) {
      const ship = this.gameState.ships.get(playerId);
      if (!ship || ship.exploded) continue;

      // Apply player input
      if (player.lastInput) {
        this.applyPlayerInput(ship, player.lastInput, dt);
      }

      // Update physics
      this.updateShipPhysics(ship, dt);

      // Regenerate energy
      if (ship.energy < ship.maxEnergy) {
        ship.energy = Math.min(ship.maxEnergy, ship.energy + 7 * dt);
      }
    }

    // Update lasers
    this.updateLasers(dt);

    // Check collisions
    this.checkCollisions();

    // Regenerate obstacles if needed
    if (this.gameState.obstacles.length < 5) {
      this.generateObstacles(5);
    }

    // Broadcast game state to all players
    this.broadcast({
      type: 'gameState',
      gameState: this.getGameState(),
      timestamp: now
    });

    this.gameState.lastUpdate = now;
  }

  /**
   * Apply player input to ship
   */
  applyPlayerInput(ship, input, dt) {
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

    // Handle actions
    if (input.shouldLaunch) {
      this.executeLaunch(ship);
    }

    if (input.shouldFire) {
      this.executeFire(ship);
    }

    // Handle shield
    if (input.shieldEnergized !== undefined) {
      ship.shieldEnergized = input.shieldEnergized;
    }

    if (ship.shieldEnergized && ship.energy > 0) {
      const shieldCostRate = (ship.shieldPower / 100) * 30;
      const shieldFrameCost = shieldCostRate * dt;
      
      if (ship.energy > shieldFrameCost) {
        ship.shieldActive = true;
        ship.energy -= shieldFrameCost;
      } else {
        ship.shieldActive = false;
        ship.shieldEnergized = false;
      }
    } else {
      ship.shieldActive = false;
    }
  }

  /**
   * Execute engine launch
   */
  executeLaunch(ship) {
    if (ship.energy <= 0 || ship.exploded) return;

    const launchCost = ship.enginePower * 3;
    if (ship.energy >= launchCost) {
      const force = {
        x: Math.cos(ship.engineAngle) * (ship.enginePower / 10),
        y: Math.sin(ship.engineAngle) * (ship.enginePower / 10)
      };
      
      ship.velocity.x += force.x;
      ship.velocity.y += force.y;
      ship.energy -= launchCost;
    }
  }

  /**
   * Execute weapon fire
   */
  executeFire(ship) {
    if (ship.energy <= 0 || ship.exploded) return;

    const fireCost = ship.weaponPower * 1.2;
    if (ship.energy >= fireCost) {
      this.gameState.lasers.push({
        id: uuidv4(),
        ownerId: ship.id,
        position: { ...ship.position },
        angle: ship.weaponAngle,
        speed: ship.weaponPower / 10,
        damage: fireCost,
        life: 3.0 // seconds
      });
      ship.energy -= fireCost;
    }
  }

  /**
   * Update ship physics
   */
  updateShipPhysics(ship, dt) {
    // Apply drag
    const drag = 0.01;
    ship.velocity.x *= (1 - drag);
    ship.velocity.y *= (1 - drag);

    // Update position
    ship.position.x += ship.velocity.x * dt * 60; // Scale for game speed
    ship.position.y += ship.velocity.y * dt * 60;

    // Bounds checking
    if (ship.position.x < 0 || ship.position.x > this.gameState.width) {
      ship.velocity.x *= -0.5;
      ship.position.x = Math.max(0, Math.min(ship.position.x, this.gameState.width));
    }
    if (ship.position.y < 0 || ship.position.y > this.gameState.height) {
      ship.velocity.y *= -0.5;
      ship.position.y = Math.max(0, Math.min(ship.position.y, this.gameState.height));
    }
  }

  /**
   * Update lasers
   */
  updateLasers(dt) {
    for (let i = this.gameState.lasers.length - 1; i >= 0; i--) {
      const laser = this.gameState.lasers[i];
      
      laser.position.x += Math.cos(laser.angle) * laser.speed * dt * 60;
      laser.position.y += Math.sin(laser.angle) * laser.speed * dt * 60;
      laser.life -= dt;

      // Remove expired lasers
      if (laser.life <= 0) {
        this.gameState.lasers.splice(i, 1);
        continue;
      }

      // Remove lasers out of bounds
      if (laser.position.x < 0 || laser.position.x > this.gameState.width ||
          laser.position.y < 0 || laser.position.y > this.gameState.height) {
        this.gameState.lasers.splice(i, 1);
      }
    }
  }

  /**
   * Check collisions
   */
  checkCollisions() {
    // Laser vs Ships
    for (let i = this.gameState.lasers.length - 1; i >= 0; i--) {
      const laser = this.gameState.lasers[i];
      
      for (const [playerId, ship] of this.gameState.ships.entries()) {
        if (ship.id === laser.ownerId || ship.exploded) continue;

        const dx = laser.position.x - ship.position.x;
        const dy = laser.position.y - ship.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < ship.size) {
          // Check shield protection
          let isProtected = false;
          if (ship.shieldActive) {
            const angleToLaser = Math.atan2(dy, dx);
            let shieldFacing = ship.shieldAngle % (Math.PI * 2);
            if (shieldFacing > Math.PI) shieldFacing -= Math.PI * 2;
            
            const maxSpread = Math.PI;
            const spread = (ship.shieldPower / 100) * maxSpread;
            const halfSpread = spread / 2;
            let diff = angleToLaser - shieldFacing;
            
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            
            if (Math.abs(diff) < halfSpread) {
              isProtected = true;
            }
          }

          this.gameState.lasers.splice(i, 1);

          if (!isProtected) {
            ship.energy -= laser.damage;
            if (ship.energy < 0) {
              ship.exploded = true;
            }
          }
          break;
        }
      }

      // Laser vs Obstacles
      for (let j = this.gameState.obstacles.length - 1; j >= 0; j--) {
        const obstacle = this.gameState.obstacles[j];
        const dx = laser.position.x - obstacle.x;
        const dy = laser.position.y - obstacle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < obstacle.size) {
          obstacle.size -= laser.damage * 0.5;
          this.gameState.lasers.splice(i, 1);
          
          if (obstacle.size < 10) {
            this.gameState.obstacles.splice(j, 1);
          }
          break;
        }
      }
    }

    // Ship vs Obstacles
    for (const [playerId, ship] of this.gameState.ships.entries()) {
      if (ship.exploded) continue;

      for (const obstacle of this.gameState.obstacles) {
        const dx = ship.position.x - obstacle.x;
        const dy = ship.position.y - obstacle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = ship.size + obstacle.size;

        if (dist < minDist) {
          const normal = {
            x: dx / dist,
            y: dy / dist
          };
          const overlap = minDist - dist;
          
          ship.position.x += normal.x * (overlap + 1);
          ship.position.y += normal.y * (overlap + 1);
          ship.velocity.x *= -0.5;
          ship.velocity.y *= -0.5;
        }
      }
    }

    // Ship vs Ship
    const shipsArray = Array.from(this.gameState.ships.values());
    for (let i = 0; i < shipsArray.length; i++) {
      const ship1 = shipsArray[i];
      if (ship1.exploded) continue;

      for (let j = i + 1; j < shipsArray.length; j++) {
        const ship2 = shipsArray[j];
        if (ship2.exploded) continue;

        const dx = ship1.position.x - ship2.position.x;
        const dy = ship1.position.y - ship2.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = ship1.size + ship2.size;

        if (dist < minDist) {
          const normal = {
            x: dx / dist,
            y: dy / dist
          };
          const overlap = minDist - dist;
          
          ship1.position.x += normal.x * (overlap / 2);
          ship1.position.y += normal.y * (overlap / 2);
          ship2.position.x -= normal.x * (overlap / 2);
          ship2.position.y -= normal.y * (overlap / 2);
          
          ship1.velocity.x *= -0.5;
          ship1.velocity.y *= -0.5;
          ship2.velocity.x *= -0.5;
          ship2.velocity.y *= -0.5;
        }
      }
    }
  }
}

