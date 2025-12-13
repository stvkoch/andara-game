import { Vector2 } from "../utils/Vector2.js";
import { Laser } from "./Laser.js";
import { NPCAI } from "./NPCAI.js";

export class NPCNetwork extends NPCAI {
  constructor(ship, game) {
    super(ship, game);
    this.lastUpdateTime = 0;
  }
  
  /**
   * Update ship state from network data
   * @param {Object} networkData - Network data containing ship control state
   * @param {number} networkData.engineAngle - Engine angle in radians
   * @param {number} networkData.enginePower - Engine power (0-100)
   * @param {number} networkData.weaponAngle - Weapon angle in radians
   * @param {number} networkData.weaponPower - Weapon power (0-100)
   * @param {number} networkData.shieldAngle - Shield angle in radians
   * @param {number} networkData.shieldPower - Shield power (0-100)
   * @param {string} networkData.controlMode - Control mode ('ENGINE', 'WEAPON', 'SHIELD')
   * @param {boolean} networkData.shouldFire - Whether to fire weapon
   * @param {boolean} networkData.shouldLaunch - Whether to launch engine
   */
  updateFromNetwork(networkData) {
    if (!networkData) return;

    // Update control mode
    if (networkData.controlMode) {
      this.ship.controlMode = networkData.controlMode;
    }

    // Update engine state
    if (networkData.engineAngle !== undefined) {
      this.ship.engineAngle = networkData.engineAngle;
    }
    if (networkData.enginePower !== undefined) {
      this.ship.enginePower = networkData.enginePower;
    }

    // Update weapon state
    if (networkData.weaponAngle !== undefined) {
      this.ship.weaponAngle = networkData.weaponAngle;
    }
    if (networkData.weaponPower !== undefined) {
      this.ship.weaponPower = networkData.weaponPower;
    }

    // Update shield state
    if (networkData.shieldAngle !== undefined) {
      this.ship.shieldAngle = networkData.shieldAngle;
    }
    if (networkData.shieldPower !== undefined) {
      this.ship.shieldPower = networkData.shieldPower;
    }

    // Execute actions
    if (networkData.shouldLaunch) {
      this.executeLaunch();
    }
    if (networkData.shouldFire) {
      this.executeFire();
    }
  }

  /**
   * Execute engine launch based on current ship state
   */
  executeLaunch() {
    if (this.ship.energy <= 0 || this.ship.exploded) return;

    const launchCost = this.ship.enginePower * 3;
    if (this.ship.energy >= launchCost) {
      const force = Vector2.fromAngle(this.ship.engineAngle).mult(
        this.ship.enginePower / 10
      );
      this.game.physics.applyForce(this.ship, force);
      this.ship.energy -= launchCost;
    }
  }

  /**
   * Execute weapon fire based on current ship state
   */
  executeFire() {
    if (this.ship.energy <= 0 || this.ship.exploded) return;

    const fireCost = this.ship.weaponPower * 1.2;
    if (this.ship.energy >= fireCost) {
      this.game.lasers.push(
        new Laser(
          this.ship.position.x,
          this.ship.position.y,
          this.ship.weaponAngle,
          this.ship.weaponPower / 10,
          this.ship.id
        )
      );
      this.ship.energy -= fireCost;
    }
  }

  /**
   * Update ship from network data and execute actions
   * @param {Object} networkData - Network data (see updateFromNetwork)
   */
  update(networkData, dt) {
    if (!networkData) return;
    // check if the timestamp received is newer than the last update time
    if (networkData.timestamp <= this.lastUpdateTime) {
      return;
    }
    this.lastUpdateTime = networkData.timestamp;
    this.updateFromNetwork(networkData);
  }

  /**
   * Get current ship state for network transmission
   * @returns {Object} Current ship state
   */
  getShipState() {
    return {
      id: this.ship.id,
      position: {
        x: this.ship.position.x,
        y: this.ship.position.y,
      },
      velocity: {
        x: this.ship.velocity.x,
        y: this.ship.velocity.y,
      },
      energy: this.ship.energy,
      maxEnergy: this.ship.maxEnergy,
      controlMode: this.ship.controlMode,
      engineAngle: this.ship.engineAngle,
      enginePower: this.ship.enginePower,
      weaponAngle: this.ship.weaponAngle,
      weaponPower: this.ship.weaponPower,
      shieldAngle: this.ship.shieldAngle,
      shieldPower: this.ship.shieldPower,
      shieldActive: this.ship.shield.active,
      exploded: this.ship.exploded,
    };
  }
}
