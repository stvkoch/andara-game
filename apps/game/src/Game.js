import { Physics } from './Physics.js';
import { Ship } from './entities/Ship.js';
import { Obstacle } from './entities/Obstacle.js';
import { Laser } from './entities/Laser.js';
import { Vector2 } from './utils/Vector2.js';
import { Input } from './Input.js';
import { NPCAI } from './entities/NPCAI.js';
import { NetworkClient } from './NetworkClient.js';
import { NetworkPlayerShip } from './entities/NetworkPlayerShip.js';

export class Game {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");
    this.width = this.canvas.width = this.canvas.parentElement.clientWidth;
    this.height = this.canvas.height = this.canvas.parentElement.clientHeight;

    // Multiplayer options
    this.multiplayer = options.multiplayer || false;
    this.networkClient = null;
    this.networkPlayers = new Map(); // playerId -> NetworkPlayerShip
    this.serverState = null;
    this.lastServerUpdate = 0;
    
    // Track last sent state to only send on changes
    this.lastSentState = {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      energy: 0
    };
    this.stateChangeThreshold = {
      position: 1.0, // Send if position changed by more than 1 unit
      velocity: 0.1, // Send if velocity changed by more than 0.1
      energy: 1.0    // Send if energy changed by more than 1 unit
    };

    this.physics = new Physics(0.01); // Drag
    this.ship = new Ship({
      x: this.width / 2,
      y: this.height / 2,
      isNPC: false
    });
    this.input = new Input(this.ship);
    
    // Set network client reference in input if multiplayer
    if (this.multiplayer) {
      // Will be set after networkClient is created
    }

    this.lasers = [];
    this.obstacles = [];
    this.stars = [];
    this.npcShips = [];

    // Generate game elements (only in single-player)
    if (!this.multiplayer) {
      this.generateStars();
      this.generateObstacles();
      this.generateNPCs();
    }

    this.entities = [this.ship, ...this.obstacles, ...this.npcShips];

    // Bind methods
    this.update = this.update.bind(this);
    this.draw = this.draw.bind(this);
    this.loop = this.loop.bind(this);

    // Setup Input
    this.input.onLaunch((angle, power) => {
      // Power passed here is 0-10 (derived from 0-100%)
      // Let's make cost proportional to power.
      // Full power (10) = 30 Energy.
      const launchCost = power * 3;

      if (this.ship.energy >= launchCost) {
        console.log(
          `Launch: Angle ${angle}, Power ${power}, Cost ${launchCost}`
        );
        
        // In multiplayer, send input to server (server handles physics)
        if (this.multiplayer && this.networkClient && this.networkClient.isConnected()) {
          this.networkClient.sendInput({
            controlMode: this.ship.controlMode,
            engineAngle: this.ship.engineAngle,
            enginePower: this.ship.enginePower,
            weaponAngle: this.ship.weaponAngle,
            weaponPower: this.ship.weaponPower,
            shieldAngle: this.ship.shieldAngle,
            shieldPower: this.ship.shieldPower,
            shouldLaunch: true,
            shouldFire: false,
            shieldEnergized: this.ship.shield.energized
          });
        }
        
        // Apply locally for prediction (hybrid mode)
        const force = Vector2.fromAngle(angle).mult(power);
        this.physics.applyForce(this.ship, force);
        this.ship.energy -= launchCost;
      } else {
        console.log("Not enough energy for launch!");
      }
    });

    this.input.onFire((angle, power) => {
      // Power passed here is 0-10
      // Full power (10) = 10 Energy.
      const fireCost = power * 1.2;

      if (this.ship.energy >= fireCost) {
        console.log(`Fire: Angle ${angle}, Power ${power}, Cost ${fireCost}`);
        
        // In multiplayer, send input to server
        if (this.multiplayer && this.networkClient && this.networkClient.isConnected()) {
          this.networkClient.sendInput({
            controlMode: this.ship.controlMode,
            engineAngle: this.ship.engineAngle,
            enginePower: this.ship.enginePower,
            weaponAngle: this.ship.weaponAngle,
            weaponPower: this.ship.weaponPower,
            shieldAngle: this.ship.shieldAngle,
            shieldPower: this.ship.shieldPower,
            shouldLaunch: false,
            shouldFire: true,
            shieldEnergized: this.ship.shield.energized
          });
        }
        
        // Apply locally for prediction
        this.lasers.push(
          new Laser(
            this.ship.position.x,
            this.ship.position.y,
            angle,
            fireCost,
            this.ship.id
          )
        );
        this.ship.energy -= fireCost;
      } else {
        console.log("Not enough energy to fire!");
      }
    });

    this.input.onReset(() => {
      this.reset();
    });

    window.addEventListener("resize", () => {
      this.width = this.canvas.width = this.canvas.parentElement.clientWidth;
      this.height = this.canvas.height = this.canvas.parentElement.clientHeight;
    });

    this.lastTime = 0;

    // UI Elements for Energy
    this.energyValue = document.getElementById("energyValue");
    this.energyBar = document.getElementById("energyBar");

    // UI Elements for Score
    this.scoreValue = document.getElementById("scoreValue");
    this.levelValue = document.getElementById("levelValue");

    // Initialize score display
    this.updateScoreDisplay();
  }

  /**
   * Initialize network client for multiplayer
   */
  initNetworkClient(serverUrl, playerName) {
    if (!this.multiplayer) return;
    
    this.networkClient = new NetworkClient(this, serverUrl);
    
    // Set up callbacks
    this.networkClient.onConnected = () => {
      console.log('Connected to multiplayer server');
      this.updateConnectionStatus(true);
    };
    
    this.networkClient.onDisconnected = () => {
      console.log('Disconnected from multiplayer server');
      this.updateConnectionStatus(false);
    };
    
    this.networkClient.onStateSnapshot = (snapshot, timestamp) => {
      this.handleStateSnapshot(snapshot, timestamp);
    };
    
    this.networkClient.onAction = (action) => {
      this.handleAction(action);
    };
    
    this.networkClient.onPlayerJoined = (playerId, playerName, playerCount) => {
      console.log(`[CLIENT] Player joined: ${playerName} (${playerId.substring(0, 8)}), total players: ${playerCount}`);
      this.updatePlayerCount(playerCount);
    };
    
    this.networkClient.onPlayerLeft = (playerId, playerCount) => {
      console.log(`[CLIENT] Player left: ${playerId.substring(0, 8)}, total players: ${playerCount}`);
      this.updatePlayerCount(playerCount);
      // Remove network player
      if (this.networkPlayers.has(playerId)) {
        const networkShip = this.networkPlayers.get(playerId);
        const index = this.npcShips.indexOf(networkShip);
        if (index > -1) {
          this.npcShips.splice(index, 1);
        }
        this.networkPlayers.delete(playerId);
        this.updateEntities();
      }
    };
    
    this.networkClient.onError = (error) => {
      console.error('Network error:', error);
    };
    
    // Set network client in input
    this.input.setNetworkClient(this.networkClient);
    
    // Connect
    this.networkClient.connect(playerName);
  }

  /**
   * Handle server state snapshot (positions, energy, etc.)
   */
  handleStateSnapshot(snapshot, timestamp) {
    this.serverState = snapshot;
    this.lastServerUpdate = timestamp || Date.now();
    
    console.log(`[CLIENT] Received state snapshot: ${snapshot.players?.length || 0} players, ${snapshot.obstacles?.length || 0} obstacles, timestamp: ${timestamp}`);
    
    // Update world dimensions if different
    if (snapshot.width && snapshot.height) {
      if (this.width !== snapshot.width || this.height !== snapshot.height) {
        console.log(`[CLIENT] World dimensions changed: ${this.width}x${this.height} -> ${snapshot.width}x${snapshot.height}`);
        this.width = snapshot.width;
        this.height = snapshot.height;
      }
    }
    
    // Sync stars (only once)
    if (this.stars.length === 0 && snapshot.stars) {
      console.log(`[CLIENT] Syncing ${snapshot.stars.length} stars from server`);
      this.stars = snapshot.stars;
    }
    
    // Sync obstacles from server
    const obstaclesBefore = this.obstacles.length;
    this.syncObstacles(snapshot.obstacles);
    if (this.obstacles.length !== obstaclesBefore) {
      console.log(`[CLIENT] Obstacles synced: ${obstaclesBefore} -> ${this.obstacles.length}`);
    }
    
    // Sync network players (positions, energy, etc.)
    const playersBefore = this.networkPlayers.size;
    this.syncNetworkPlayers(snapshot.players);
    if (this.networkPlayers.size !== playersBefore) {
      console.log(`[CLIENT] Network players synced: ${playersBefore} -> ${this.networkPlayers.size}`);
    }
  }

  /**
   * Handle action from server (fire, launch, etc.)
   */
  handleAction(action) {
    const { type, playerId } = action;
    
    // Skip our own actions (we already applied them locally)
    if (playerId === this.networkClient?.getPlayerId()) {
      console.log(`[CLIENT] Ignoring own action: ${type}`);
      return;
    }

    console.log(`[CLIENT] Received action: ${type} from player ${playerId?.substring(0, 8) || 'unknown'}`);

    switch (type) {
      case 'playerFire':
        this.handlePlayerFire(action);
        break;
      
      case 'playerLaunch':
        this.handlePlayerLaunch(action);
        break;
      
      default:
        console.warn(`[CLIENT] Unknown action type: ${type}`);
    }
  }

  /**
   * Handle player fire action
   */
  handlePlayerFire(action) {
    const networkShip = this.networkPlayers.get(action.playerId);
    if (!networkShip) {
      console.warn(`[CLIENT] Cannot handle fire action: network ship ${action.playerId?.substring(0, 8)} not found`);
      return;
    }

    // Create laser from action
    const laser = new Laser(
      action.position.x,
      action.position.y,
      action.weaponAngle,
      action.weaponPower * 1.2, // damage
      action.playerId
    );
    this.lasers.push(laser);
    console.log(`[CLIENT] Applied fire action: created laser at (${action.position.x.toFixed(1)}, ${action.position.y.toFixed(1)}) with angle ${(action.weaponAngle * 180 / Math.PI).toFixed(1)}°`);
  }

  /**
   * Handle player launch action
   */
  handlePlayerLaunch(action) {
    const networkShip = this.networkPlayers.get(action.playerId);
    if (!networkShip) {
      console.warn(`[CLIENT] Cannot handle launch action: network ship ${action.playerId?.substring(0, 8)} not found`);
      return;
    }

    // Apply launch force to network ship
    const force = Vector2.fromAngle(action.engineAngle).mult(action.enginePower / 10);
    this.physics.applyForce(networkShip, force);
    console.log(`[CLIENT] Applied launch action: applied force ${force.mag().toFixed(2)} at angle ${(action.engineAngle * 180 / Math.PI).toFixed(1)}° to player ${action.playerId?.substring(0, 8)}`);
  }

  /**
   * Sync obstacles from server state
   */
  syncObstacles(serverObstacles) {
    if (!serverObstacles) return;
    
    // Create a map of server obstacle IDs
    const serverIds = new Set(serverObstacles.map(o => o.id));
    
    // Remove obstacles not in server state
    this.obstacles = this.obstacles.filter(obs => {
      const obsId = obs.id || `${obs.position.x},${obs.position.y}`;
      return serverIds.has(obsId);
    });
    
    // Add/update obstacles from server
    serverObstacles.forEach(serverObs => {
      const existing = this.obstacles.find(obs => {
        const obsId = obs.id || `${obs.position.x},${obs.position.y}`;
        return obsId === serverObs.id;
      });
      
      if (existing) {
        existing.position.x = serverObs.x;
        existing.position.y = serverObs.y;
        existing.size = serverObs.size;
        existing.id = serverObs.id;
      } else {
        const obstacle = new Obstacle(serverObs.x, serverObs.y, serverObs.size);
        obstacle.id = serverObs.id;
        this.obstacles.push(obstacle);
      }
    });
  }

  /**
   * Sync lasers from server state (removed - lasers created from actions)
   */
  syncLasers(serverLasers) {
    // Lasers are now created from actions, not synced from server
    // This method kept for compatibility but does nothing
  }

  /**
   * Sync network players from server state snapshot
   */
  syncNetworkPlayers(serverPlayers) {
    if (!serverPlayers) return;
    
    const myPlayerId = this.networkClient?.getPlayerId();
    
    serverPlayers.forEach(playerState => {
      // Skip our own ship
      if (playerState.id === myPlayerId) return;
      
      if (this.networkPlayers.has(playerState.id)) {
        // Update existing network player position/state
        const networkShip = this.networkPlayers.get(playerState.id);
        const oldPos = { x: networkShip.position.x, y: networkShip.position.y };
        networkShip.updateFromServer(playerState);
        
        // Log if position changed significantly
        const dx = Math.abs(playerState.position.x - oldPos.x);
        const dy = Math.abs(playerState.position.y - oldPos.y);
        if (dx > 1 || dy > 1) {
          console.log(`[CLIENT] Updated network player ${playerState.id.substring(0, 8)}: pos (${oldPos.x.toFixed(1)}, ${oldPos.y.toFixed(1)}) -> (${playerState.position.x.toFixed(1)}, ${playerState.position.y.toFixed(1)}), energy: ${playerState.energy.toFixed(1)}`);
        }
      } else {
        // Create new network player
        console.log(`[CLIENT] Creating new network player ${playerState.id.substring(0, 8)} at (${playerState.position.x.toFixed(1)}, ${playerState.position.y.toFixed(1)})`);
        const networkShip = new NetworkPlayerShip(playerState, this);
        this.networkPlayers.set(playerState.id, networkShip);
        
        // Add to npcShips for rendering/collision
        this.npcShips.push(networkShip);
        this.updateEntities();
      }
    });
    
    // Remove network players not in server state
    for (const [playerId, networkShip] of this.networkPlayers.entries()) {
      if (!serverPlayers.find(s => s.id === playerId)) {
        console.log(`[CLIENT] Removing network player ${playerId.substring(0, 8)}`);
        const index = this.npcShips.indexOf(networkShip);
        if (index > -1) {
          this.npcShips.splice(index, 1);
        }
        this.networkPlayers.delete(playerId);
        this.updateEntities();
      }
    }
  }


  /**
   * Update entities array
   */
  updateEntities() {
    this.entities = [this.ship, ...this.obstacles, ...this.npcShips];
  }

  /**
   * Update connection status UI (to be implemented)
   */
  updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connectionStatus');
    if (statusEl) {
      statusEl.textContent = connected ? 'Connected' : 'Disconnected';
      statusEl.style.color = connected ? '#0f0' : '#f00';
    }
  }

  /**
   * Update player count UI (to be implemented)
   */
  updatePlayerCount(count) {
    const countEl = document.getElementById('playerCount');
    if (countEl) {
      countEl.textContent = `${count} player${count !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Check if player state has changed significantly
   */
  hasStateChanged(position, velocity, energy) {
    const posChanged = 
      Math.abs(position.x - this.lastSentState.position.x) > this.stateChangeThreshold.position ||
      Math.abs(position.y - this.lastSentState.position.y) > this.stateChangeThreshold.position;
    
    const velChanged =
      Math.abs(velocity.x - this.lastSentState.velocity.x) > this.stateChangeThreshold.velocity ||
      Math.abs(velocity.y - this.lastSentState.velocity.y) > this.stateChangeThreshold.velocity;
    
    const energyChanged = 
      Math.abs(energy - this.lastSentState.energy) > this.stateChangeThreshold.energy;
    
    return posChanged || velChanged || energyChanged;
  }

  reset() {
      this.ship.velocity.mult(0);
      this.ship.acceleration.mult(0);
      this.ship.position.x = this.width / 2;
      this.ship.position.y = this.height / 2;
      this.ship.color = '#00f0ff'; // Reset color if it turned red
      this.ship.energy = this.ship.maxEnergy;
      
      // Reset explosion state
      this.ship.exploded = false;
      this.ship.explosionTimer = 0;
      
      // Reset shield state
      this.ship.shield.energized = false;
      this.ship.shield.active = false;
      
      // Reset control state
      this.ship.engineAngle = 0;
      this.ship.enginePower = 50;
      this.ship.weaponAngle = 0;
      this.ship.weaponPower = 50;
      this.ship.shieldAngle = 0;
      this.ship.shieldPower = 50;
      this.ship.controlMode = 'ENGINE';
      
      // Reset score (or keep it? Let's keep it for now)
      // this.ship.score = 0;
      // this.ship.level = 1;
      
      // Sync UI
      this.input.syncUIToShip();
      this.updateScoreDisplay();
  }

  updateScoreDisplay() {
      if (this.scoreValue) {
          this.scoreValue.textContent = this.ship.score;
      }
      if (this.levelValue) {
          this.levelValue.textContent = this.ship.level;
      }
  }

  generateStars() {
    for (let i = 0; i < 100; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 2,
        alpha: Math.random(),
      });
    }
  }

  generateObstacles(numObstacles = Math.max(3, Math.floor(Math.random() * 12))) {
    for (let i = 0; i < numObstacles; i++) {
      // Random pos
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      // Ensure not too close to ship
      if (Math.hypot(x - this.width / 2, y - this.height / 2) > 100) {
        this.obstacles.push(new Obstacle(x, y, 20 + Math.random() * 20));
      }
    }
  }

  generateNPCs(numNPCs = Math.max(3, Math.floor(Math.random() * 15))) {
    for (let i = 0; i < numNPCs; i++) {
      let x, y;
      let attempts = 0;
      do {
        x = Math.random() * this.width;
        y = Math.random() * this.height;
        attempts++;
      } while (
        Math.hypot(x - this.width / 2, y - this.height / 2) < 150 &&
        attempts < 20
      );

      const npcShip = new Ship({
        x: x,
        y: y,
        isNPC: true,
        enginePower: Math.random() * 50,
        weaponPower: Math.random() * 50,
        shieldPower: Math.random() * 50,
        energyRegen: Math.random() * 5 + 1,
        explosionDuration: Math.random() * 0.5 + 0.1,
      });
      const npcAI = new NPCAI(npcShip, this);
      npcShip.ai = npcAI;
      this.npcShips.push(npcShip);
    }
  }

  start() {
    this.loop(0);
  }

  loop(timestamp) {
    const deltaTime = (timestamp - this.lastTime) / 1000; // Seconds
    this.lastTime = timestamp;

    this.update(deltaTime);
    this.draw();

    requestAnimationFrame(this.loop);
  }

  update(dt) {
    // Ship angle is updated by Input when engine angle changes
    
    // In multiplayer mode, server controls obstacles and NPCs
    if (!this.multiplayer) {
      // Regenerate obstacles if none exist
      if (this.obstacles.length === 0) {
        this.generateObstacles();
        // Update entities array
        this.updateEntities();
      }
      
      // Regenerate NPCs if none exist
      if (this.npcShips.length === 0) {
        this.generateNPCs();
        // Update entities array
        this.updateEntities();
      }
    }
    
    // Check for player ship explosion
    if (this.ship.checkExplosion()) {
        console.log('Player ship exploded!');
    }
    
    // Update player ship explosion
    if (this.ship.exploded) {
        if (this.ship.updateExplosion(dt)) {
            // Explosion complete - reset player ship
            this.reset();
        }
    }

    // Energy Regeneration (only if not exploded)
    if (!this.ship.exploded && this.ship.energy < this.ship.maxEnergy) {
        this.ship.energy += this.ship.energyRegen * dt;
        if (this.ship.energy > this.ship.maxEnergy) this.ship.energy = this.ship.maxEnergy;
    }

    // Update Shield State & Drain (only if not exploded)
    if (this.ship.exploded) {
        this.ship.shield.active = false;
        this.ship.shield.energized = false;
    } else {
        // Shield activates only if energized (button pressed) and has enough energy
        const shieldCostRate = (this.ship.shieldPower / 100);
        const shieldFrameCost = shieldCostRate * dt;

        if (this.ship.shield.energized && this.ship.energy > shieldFrameCost) {
            this.ship.shield.active = true;
            this.ship.shield.angle = this.ship.shieldAngle;
            this.ship.shield.power = this.ship.shieldPower;
            this.ship.energy -= shieldFrameCost;
        } else {
            this.ship.shield.active = false;
            // Auto-deactivate if not enough energy
            if (this.ship.energy <= shieldFrameCost) {
                this.ship.shield.energized = false;
            }
        }
    }

    // Update NPC ships and network players
    for (let i = this.npcShips.length - 1; i >= 0; i--) {
        const npcShip = this.npcShips[i];
        
        // Check if it's a network player
        const isNetworkPlayer = this.networkPlayers.has(npcShip.id);
        
        // Check for explosion
        if (!isNetworkPlayer && npcShip.checkExplosion()) {
            console.log('NPC ship exploded!');
        }
        
        // Update explosion
        if (npcShip.exploded) {
            if (npcShip.updateExplosion(dt)) {
                // Explosion complete - remove NPC
                this.npcShips.splice(i, 1);
                if (isNetworkPlayer) {
                    this.networkPlayers.delete(npcShip.id);
                }
                continue;
            }
        } else {
            // Network players are updated from server state
            if (isNetworkPlayer) {
                npcShip.update(dt);
            } else {
                // Regular NPC AI logic
                // Energy Regeneration for NPCs
                if (npcShip.energy < npcShip.maxEnergy) {
                    npcShip.energy += npcShip.energyRegen * dt;
                    if (npcShip.energy > npcShip.maxEnergy) npcShip.energy = npcShip.maxEnergy;
                }

                // Update NPC AI
                if (npcShip.ai) {
                    npcShip.ai.update(dt);
                }

                // Update NPC shield state & drain
                // Shield cannot be active when shooting (WEAPON mode) - same as player ship
                const npcShieldActiveRequest = (npcShip.controlMode === 'SHIELD');
                const isShooting = (npcShip.controlMode === 'WEAPON' && npcShip.weaponPower > 0);
                
                // Check if NPC recently fired (within fire cooldown)
                let recentlyFired = false;
                if (npcShip.ai && npcShip.ai.lastFireTime) {
                    const timeSinceFire = npcShip.ai.currentTime - npcShip.ai.lastFireTime;
                    recentlyFired = timeSinceFire < npcShip.ai.fireCooldown;
                }
                
                const npcShieldCostRate = (npcShip.shieldPower / 100) * 30;
                const npcShieldFrameCost = npcShieldCostRate * dt;

                // Shield can only be active if:
                // 1. Control mode is SHIELD (requested)
                // 2. Not currently shooting (WEAPON mode with weaponPower > 0)
                // 3. Not recently fired (within fire cooldown)
                // 4. Has enough energy
                if (npcShieldActiveRequest && !isShooting && !recentlyFired && npcShip.energy > npcShieldFrameCost) {
                    npcShip.shield.active = true;
                    npcShip.shield.angle = npcShip.shieldAngle;
                    npcShip.shield.power = npcShip.shieldPower;
                    npcShip.energy -= npcShieldFrameCost;
                } else {
                    npcShip.shield.active = false;
                }

                // Apply physics to NPCs
                this.physics.applyPhysics(npcShip);

                // Bounds checking for NPCs
                if (npcShip.position.x < 0 || npcShip.position.x > this.width) {
                    npcShip.velocity.x *= -0.5;
                    npcShip.position.x = Math.max(0, Math.min(npcShip.position.x, this.width));
                }
                if (npcShip.position.y < 0 || npcShip.position.y > this.height) {
                    npcShip.velocity.y *= -0.5;
                    npcShip.position.y = Math.max(0, Math.min(npcShip.position.y, this.height));
                }
            }
        }
    }

    // Update Energy UI
    this.energyValue.textContent = Math.floor(this.ship.energy);
    this.energyBar.style.width = `${(this.ship.energy / this.ship.maxEnergy) * 100}%`;
    
    // Change bar color if low
    if (this.ship.energy < 20) {
        this.energyBar.style.backgroundColor = '#ff0000';
    } else {
        this.energyBar.style.backgroundColor = '#0f0';
    }

    // Update Score UI
    this.updateScoreDisplay();

    // Update Physics (client handles all physics)
    if (!this.ship.exploded) {
        this.physics.applyPhysics(this.ship);
        
        // Send position update to server only if state changed
        if (this.multiplayer && this.networkClient && this.networkClient.isConnected()) {
          const stateChanged = this.hasStateChanged(
            this.ship.position,
            this.ship.velocity,
            this.ship.energy
          );
          
          if (stateChanged) {
            console.log(`[CLIENT] Sending state update: pos (${this.ship.position.x.toFixed(1)}, ${this.ship.position.y.toFixed(1)}), energy ${this.ship.energy.toFixed(1)}`);
            
            this.networkClient.sendPlayerState(
              this.ship.position,
              this.ship.velocity,
              this.ship.energy
            );
            
            // Update last sent state
            this.lastSentState = {
              position: { x: this.ship.position.x, y: this.ship.position.y },
              velocity: { x: this.ship.velocity.x, y: this.ship.velocity.y },
              energy: this.ship.energy
            };
          }
        }
    }

    // Update Lasers
    this.lasers.forEach((laser, index) => {
        laser.update();
        if (laser.life <= 0) {
            this.lasers.splice(index, 1);
        }
    });

    // Collision: Ship vs Obstacles
    this.obstacles.forEach(obs => {
        const dx = this.ship.position.x - obs.position.x;
        const dy = this.ship.position.y - obs.position.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const minDist = this.ship.size + obs.size;

        if (dist < minDist) {
            // Collision!
            console.log('Ship hit obstacle!');
            
            // Check Shield Protection
            let protectedByShield = false;
            if (this.ship.shield.active) {
                // Angle from Ship to Obstacle
                const angleToObs = Math.atan2(obs.position.y - this.ship.position.y, obs.position.x - this.ship.position.x);
                
                // Shield Facing Angle (Normalize to -PI to PI)
                let shieldFacing = this.ship.shield.angle % (Math.PI * 2);
                if (shieldFacing > Math.PI) shieldFacing -= Math.PI * 2;
                
                // Shield Arc Spread
                const maxSpread = Math.PI; 
                const spread = (this.ship.shield.power / 100) * maxSpread;
                const halfSpread = spread / 2;

                // Angle Difference
                let diff = angleToObs - shieldFacing;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;

                if (Math.abs(diff) < halfSpread) {
                    protectedByShield = true;
                }
            }

            const normal = new Vector2(dx, dy).normalize();
            const overlap = minDist - dist;
            this.ship.position.add(normal.mult(overlap + 1));

            if (protectedByShield) {
                console.log('Shield Deflection!');
                this.ship.velocity.mult(-0.8); // Elastic bounce
                // Maybe push obstacle?
            } else {
                console.log('Hull Impact!');
                this.ship.velocity.mult(-0.5); // Dampened bounce
                this.ship.color = '#ff0000';   // Damage indication
            }
        }
    });

    // Collision: NPC Ships vs Obstacles
    this.npcShips.forEach(npcShip => {
        this.obstacles.forEach(obs => {
            const dx = npcShip.position.x - obs.position.x;
            const dy = npcShip.position.y - obs.position.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const minDist = npcShip.size + obs.size;

            if (dist < minDist) {
                // Check Shield Protection
                let protectedByShield = false;
                if (npcShip.shield.active) {
                    const angleToObs = Math.atan2(obs.position.y - npcShip.position.y, obs.position.x - npcShip.position.x);
                    let shieldFacing = npcShip.shield.angle % (Math.PI * 2);
                    if (shieldFacing > Math.PI) shieldFacing -= Math.PI * 2;
                    const maxSpread = Math.PI;
                    const spread = (npcShip.shield.power / 100) * maxSpread;
                    const halfSpread = spread / 2;
                    let diff = angleToObs - shieldFacing;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;

                    if (Math.abs(diff) < halfSpread) {
                        protectedByShield = true;
                    }
                }

                const normal = new Vector2(dx, dy).normalize();
                const overlap = minDist - dist;
                npcShip.position.add(normal.mult(overlap + 1));

                if (protectedByShield) {
                    npcShip.velocity.mult(-0.8);
                } else {
                    npcShip.velocity.mult(-0.5);
                    npcShip.color = '#ff0000';
                }
            }
        });

        // Collision: NPC Ships vs Player Ship
        const dx = npcShip.position.x - this.ship.position.x;
        const dy = npcShip.position.y - this.ship.position.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const minDist = npcShip.size + this.ship.size;

        if (dist < minDist) {
            const normal = new Vector2(dx, dy).normalize();
            const overlap = minDist - dist;
            npcShip.position.add(normal.mult(overlap / 2));
            this.ship.position.add(normal.mult(-overlap / 2));
            npcShip.velocity.mult(-0.5);
            this.ship.velocity.mult(-0.5);
        }
    });

    // Collision: Laser vs Obstacles and Ships
    for (let i = this.lasers.length - 1; i >= 0; i--) {
        const laser = this.lasers[i];
        const isMyLaser = laser.id === this.ship.id;
        let laserHit = false;

        // Check obstacles first
        for (let j = this.obstacles.length - 1; j >= 0; j--) {
            const obs = this.obstacles[j];
            const dx = laser.position.x - obs.position.x;
            const dy = laser.position.y - obs.position.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            // Simple point collision
            if (dist < obs.size) {
                // Hit!
                obs.size -= laser.damage * 0.5; // Shrink
                this.lasers.splice(i, 1); // Remove laser
                laserHit = true;
                console.log('Laser hit obstacle!');
                
                if (isMyLaser) {
                  this.ship.score += 10;
                  this.updateScoreDisplay();
                }
                
                if (obs.size < 10) {
                    this.obstacles.splice(j, 1); // Destroy obstacle
                    // Bonus points for destroying obstacle
                    if (isMyLaser) {
                      this.ship.score += 50;
                      this.updateScoreDisplay();
                    }
                }
                break; // Laser handled
            }
        }
        if(laserHit) {
          console.log('Laser hit something!');
          continue;
        }
      

        // If laser still exists, check ships
        if (i < this.lasers.length) {
          if (laser.id !== this.ship.id) {
            // Check player ship
            const dx = laser.position.x - this.ship.position.x;
            const dy = laser.position.y - this.ship.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.ship.size) {
              // Check if shield protects
              let isProtected = false;
              if (this.ship.shield.active) {
                const angleToLaser = Math.atan2(dy, dx);
                let shieldFacing = this.ship.shield.angle % (Math.PI * 2);
                if (shieldFacing > Math.PI) shieldFacing -= Math.PI * 2;
                const maxSpread = Math.PI;
                const spread = (this.ship.shield.power / 100) * maxSpread;
                const halfSpread = spread / 2;
                let diff = angleToLaser - shieldFacing;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                if (Math.abs(diff) < halfSpread) {
                  isProtected = true;
                }
              }
              this.lasers.splice(i, 1);

              if (!isProtected) {
                this.ship.color = "#ff0000";
              }
              laserHit = true;
              if (isProtected && this.ship.shieldPower > 0) {
                this.ship.shieldPower -= laser.damage;
              } else {
                this.ship.energy -= laser.damage;
              }
            }
          }
            // Check NPC ships
            if (!laserHit && i < this.lasers.length) {
                for (let k = this.npcShips.length - 1; k >= 0; k--) {
                  
                    const npcShip = this.npcShips[k];
                    if (npcShip.id === laser.id) continue;

                    const dx2 = laser.position.x - npcShip.position.x;
                    const dy2 = laser.position.y - npcShip.position.y;
                    const dist2 = Math.sqrt(dx2*dx2 + dy2*dy2);
                    if (dist2 < npcShip.size) {
                        // Check if shield protects
                        let isProtected = false;
                        if (npcShip.shield.active) {
                            const angleToLaser = Math.atan2(dy2, dx2);
                            let shieldFacing = npcShip.shield.angle % (Math.PI * 2);
                            if (shieldFacing > Math.PI) shieldFacing -= Math.PI * 2;
                            const maxSpread = Math.PI;
                            const spread = (npcShip.shield.power / 100) * maxSpread;
                            const halfSpread = spread / 2;
                            let diff = angleToLaser - shieldFacing;
                            while (diff > Math.PI) diff -= Math.PI * 2;
                            while (diff < -Math.PI) diff += Math.PI * 2;
                            if (Math.abs(diff) < halfSpread) {
                                isProtected = true;
                            }
                        }
                        if (!isProtected) {
                          npcShip.energy -= laser.damage;
                          if (isMyLaser) {
                            this.ship.score += 10;
                            this.updateScoreDisplay();
                          }
                          this.lasers.splice(i, 1);
                        }
                        break;
                    }
                }
            }
        }
    }

    // Bounds checking
    if (this.ship.position.x < 0 || this.ship.position.x > this.width) {
        this.ship.velocity.x *= -0.5;
        this.ship.position.x = Math.max(0, Math.min(this.ship.position.x, this.width));
    }
    if (this.ship.position.y < 0 || this.ship.position.y > this.height) {
        this.ship.velocity.y *= -0.5;
        this.ship.position.y = Math.max(0, Math.min(this.ship.position.y, this.height));
    }
  }

  draw() {
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw Stars
    this.ctx.fillStyle = '#ffffff';
    this.stars.forEach(star => {
        this.ctx.globalAlpha = star.alpha;
        this.ctx.beginPath();
        this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        this.ctx.fill();
    });
    this.ctx.globalAlpha = 1.0;

    // Draw Aim Indicator (Orbiting Dot)
    const aimAngle = this.ship.weaponAngle;
    const aimDist = this.ship.size + 7;
    const aimX = this.ship.position.x + Math.cos(aimAngle) * aimDist;
    const aimY = this.ship.position.y + Math.sin(aimAngle) * aimDist;

    this.ctx.fillStyle = '#ff00ff';
    this.ctx.beginPath();
    this.ctx.arc(aimX, aimY, 3, 0, Math.PI * 2);
    this.ctx.fill();


    this.obstacles.forEach(o => o.draw(this.ctx));
    this.lasers.forEach(l => l.draw(this.ctx));
    this.npcShips.forEach(npc => npc.draw(this.ctx));
    this.ship.draw(this.ctx);
  }
}
