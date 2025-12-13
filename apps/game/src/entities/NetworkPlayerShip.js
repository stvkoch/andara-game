import { Ship } from './Ship.js';
import { NPCNetwork } from './NPCNetwork.js';

/**
 * NetworkPlayerShip - A ship controlled by network updates from another player
 * Uses NPCNetwork for handling network state updates
 */
export class NetworkPlayerShip extends Ship {
  constructor(shipState, game) {
    super({
      x: shipState.position.x,
      y: shipState.position.y,
      isNPC: true, // Treat as NPC for rendering
      id: shipState.id,
      color: shipState.color || '#ffaa00'
    });

    this.game = game;
    this.networkAI = new NPCNetwork(this, game);
    
    // Store last update time for interpolation
    this.lastUpdateTime = Date.now();
    this.targetPosition = { x: shipState.position.x, y: shipState.position.y };
    this.targetVelocity = { x: shipState.velocity.x, y: shipState.velocity.y };
    
    // Update initial state
    this.updateFromServer(shipState);
  }

  /**
   * Update ship state from server data
   */
  updateFromServer(shipState) {
    if (!shipState) return;

    // Store target values for interpolation
    this.targetPosition.x = shipState.position.x;
    this.targetPosition.y = shipState.position.y;
    this.targetVelocity.x = shipState.velocity.x;
    this.targetVelocity.y = shipState.velocity.y;

    // Update ship properties directly
    this.energy = shipState.energy;
    this.maxEnergy = shipState.maxEnergy;
    this.controlMode = shipState.controlMode;
    this.engineAngle = shipState.engineAngle;
    this.enginePower = shipState.enginePower;
    this.weaponAngle = shipState.weaponAngle;
    this.weaponPower = shipState.weaponPower;
    this.shieldAngle = shipState.shieldAngle;
    this.shieldPower = shipState.shieldPower;
    this.shield.active = shipState.shieldActive || false;
    this.shield.energized = shipState.shieldEnergized !== undefined ? shipState.shieldEnergized : (shipState.shieldActive || false);
    this.exploded = shipState.exploded || false;

    // Update network AI with state
    if (this.networkAI) {
      this.networkAI.updateFromNetwork({
        controlMode: shipState.controlMode,
        engineAngle: shipState.engineAngle,
        enginePower: shipState.enginePower,
        weaponAngle: shipState.weaponAngle,
        weaponPower: shipState.weaponPower,
        shieldAngle: shipState.shieldAngle,
        shieldPower: shipState.shieldPower,
        timestamp: Date.now()
      });
    }

    this.lastUpdateTime = Date.now();
  }

  /**
   * Interpolate position smoothly towards target
   */
  interpolatePosition(dt, lerpFactor = 0.2) {
    const dx = this.targetPosition.x - this.position.x;
    const dy = this.targetPosition.y - this.position.y;
    
    // Smooth interpolation
    this.position.x += dx * lerpFactor;
    this.position.y += dy * lerpFactor;
    
    // Update velocity towards target
    const vx = this.targetVelocity.x - this.velocity.x;
    const vy = this.targetVelocity.y - this.velocity.y;
    this.velocity.x += vx * lerpFactor;
    this.velocity.y += vy * lerpFactor;
  }

  /**
   * Update network player ship
   */
  update(dt) {
    // Interpolate position smoothly
    this.interpolatePosition(dt);
    
    // Update explosion if exploded
    if (this.exploded) {
      if (this.updateExplosion(dt)) {
        // Explosion complete - ship will be removed by game
        return;
      }
    } else {
      // Energy regeneration (server controls this, but we can show it updating)
      // Note: Server is authoritative, so this is just for visual feedback
      if (this.energy < this.maxEnergy) {
        this.energy += this.energyRegen * dt;
        if (this.energy > this.maxEnergy) this.energy = this.maxEnergy;
      }
    }
  }
}

