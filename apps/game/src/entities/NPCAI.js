import { Vector2 } from "../utils/Vector2.js";
import { Laser } from "./Laser.js";

const AI_STATE = {
  IDLE: "IDLE",
  EVADE: "EVADE",
  DESTROY_OBSTACLES: "DESTROY_OBSTACLES",
  DESTROY_OTHER_SHIPS: "DESTROY_OTHER_SHIPS",
  DESTROY_MAIN_SHIP: "DESTROY_MAIN_SHIP",
};

export class NPCAI {
  constructor(ship, game) {
    this.ship = ship;
    this.game = game;

    // Timers
    this.currentTime = 0;
    this.decisionTimer = 0;
    this.decisionInterval = 0.35; // how often NPC "thinks"

    this.lastFireTime = 0;
    this.fireCooldown = 0.8;

    // Idle tracking
    this.idleStartTime = 0;
    this.idleTargetDuration = 10 + Math.random() * 10; // Random 10-20 seconds
    this.hasTriggeredIdlePursuit = false;

    // State / target
    this.state = AI_STATE.IDLE;
    this.target = null;

    // Behavior tuning
    this.safeDistance = 90; // if closer than this to threats -> evade
    this.attackRange = 320; // consider targets within this range
    this.preferredFightDistance = 180; // try to keep around this distance

    // Personality (optional-ish)
    this.aggression = 0.6; // 0..1 more likely to focus ships vs obstacles
    this.accuracyJitter = 0.06; // radians
    this.strafeChance = 0.7;

    // Minor randomness so NPCs don't feel identical
    this._seed = Math.random() * 1000;
  }

  update(dt) {
    this.currentTime += dt;
    this.decisionTimer += dt;

    // Check idle pursuit trigger
    this.checkIdlePursuit();

    if (this.decisionTimer >= this.decisionInterval) {
      this.decisionTimer = 0;
      this.makeDecisions();
    }

    this.executeActions(dt);
  }

  checkIdlePursuit() {
    // If ship is exploded, don't check idle
    if (this.ship.exploded) return;

    // Check if destroying obstacles but obstacles are too few
    if (this.state === AI_STATE.DESTROY_OBSTACLES) {
      const totalShips = 1 + (this.game.npcShips ? this.game.npcShips.length : 0); // Player + NPCs
      const totalObstacles = this.game.obstacles ? this.game.obstacles.length : 0;
      const halfShips = totalShips / 2;
      
      if (totalObstacles < halfShips) {
        // Switch to pursuing main ship when obstacles are less than half of ships
        this.state = AI_STATE.DESTROY_MAIN_SHIP;
        this.target = this.game.ship;
        console.log(`NPC ${this.ship.id} switching to pursue main ship (obstacles: ${totalObstacles} < ships/2: ${halfShips})`);
        return;
      }
    }

    // If we're idle, track the time
    console.log('Checking idle pursuit', this.state);
    if (this.state === AI_STATE.IDLE) {
      // Initialize idle start time if just entered idle
      if (this.idleStartTime === 0) {
        this.idleStartTime = this.currentTime;
        this.hasTriggeredIdlePursuit = false;
      }

      // Check if idle duration exceeded target
      const idleDuration = this.currentTime - this.idleStartTime;
      if (idleDuration >= this.idleTargetDuration && !this.hasTriggeredIdlePursuit) {
        // Trigger pursuit of main ship
        this.hasTriggeredIdlePursuit = true;
        this.state = AI_STATE.DESTROY_MAIN_SHIP;
        this.target = this.game.ship;
        console.log(`NPC ${this.ship.id} idle for ${idleDuration.toFixed(1)}s - pursuing main ship!`);
      }
    } else {
      // Not idle, reset idle tracking
      this.idleStartTime = 0;
      // Reset trigger flag if we switch away from pursuit
      if (this.state !== AI_STATE.DESTROY_MAIN_SHIP) {
        this.hasTriggeredIdlePursuit = false;
      }
    }
  }

  // ---------------------------
  // Decision / Strategy Layer
  // ---------------------------
  makeDecisions() {
    // If ship is exploded, do nothing.
    if (this.ship.exploded) return;

    // Hard survival rule: if a threat is too close, evade immediately.
    const threats = this.findThreats();
    const nearestThreat = this.findNearestThreat(threats);
    if (nearestThreat && nearestThreat.distance < this.safeDistance) {
      this.state = AI_STATE.EVADE;
      this.target = nearestThreat.entity;
      this.evade(nearestThreat);
      return;
    }

    // Otherwise choose a strategy using utility scores
    const chosen = this.chooseStrategy();
    this.state = chosen;

    switch (chosen) {
      case AI_STATE.DESTROY_MAIN_SHIP: {
        this.target = this.game.ship;
        this.attackShip(this.game.ship, { prioritize: true });
        break;
      }

      case AI_STATE.DESTROY_OTHER_SHIPS: {
        const npcTarget = this.findBestNPCVictim();
        this.target = npcTarget;
        if (npcTarget) this.attackShip(npcTarget);
        else this.state = AI_STATE.DESTROY_OBSTACLES; // fallback
        break;
      }

      case AI_STATE.DESTROY_OBSTACLES: {
        const obsTarget = this.findBestObstacleTarget();
        this.target = obsTarget;
        if (obsTarget) this.attackObstacle(obsTarget);
        else this.wander();
        break;
      }

      default:
        this.wander();
        break;
    }
  }

  chooseStrategy() {
    const scores = {
      [AI_STATE.DESTROY_MAIN_SHIP]: this.scoreDestroyMainShip(),
      [AI_STATE.DESTROY_OTHER_SHIPS]: this.scoreDestroyOtherShips(),
      [AI_STATE.DESTROY_OBSTACLES]: this.scoreDestroyObstacles(),
    };
    console.log('Scores', scores);

    // Pick best score
    let bestKey = AI_STATE.DESTROY_OBSTACLES;
    let bestVal = -Infinity;
    for (const k of Object.keys(scores)) {
      if (scores[k] > bestVal) {
        bestVal = scores[k];
        bestKey = k;
      }
    }
    return bestKey;
  }

  scoreDestroyMainShip() {
    const player = this.game.ship;
    if (!player || player.exploded) return -999;

    const dist = Vector2.distance(this.ship.position, player.position);
    if (dist > this.attackRange) return 0;

    // Prefer attacking if player is low energy and we're strong
    const energyAdv = (this.ship.energy - player.energy) * 0.7;

    // Closer is better up to preferred distance, too close is risky
    const distScore =
      dist >= this.preferredFightDistance
        ? this.attackRange - dist
        : this.attackRange -
          this.preferredFightDistance -
          (this.preferredFightDistance - dist) * 1.2;

    // More aggressive NPCs prioritize ships more
    return distScore + energyAdv + this.aggression * 120;
  }

  scoreDestroyOtherShips() {
    const target = this.findBestNPCVictim();
    if (!target) return 0;

    const dist = Vector2.distance(this.ship.position, target.position);
    if (dist > this.attackRange) return 0;

    // Prefer weaker ships (low energy) and nearby ones
    const weakBonus = (100 - target.energy) * 1.1;
    const nearBonus = this.attackRange - dist;

    // return weakBonus + nearBonus + (this.aggression/2) * 80;
    return 0;
  }

  scoreDestroyObstacles() {
    if (!this.game.obstacles || this.game.obstacles.length === 0) return 0;

    const closest = this.findClosestObstacle();
    if (!closest) return 0;

    const dist = Vector2.distance(this.ship.position, closest.position);

    // If obstacles are close-ish, clearing them is useful
    const closeness = Math.max(0, 250 - dist);

    // If we are low energy, prefer obstacles less (safer to wander/regen)
    const energyPenalty = this.ship.energy < 25 ? 60 : 0;

    // If many obstacles exist, increase this score
    const densityBonus = Math.min(120, this.game.obstacles.length * 15);

    // Less aggressive -> more likely to clear obstacles
    const antiAggro = (1 - this.aggression) * 120;

    return closeness + densityBonus + antiAggro - energyPenalty;
  }

  // ---------------------------
  // Threats / Target selection
  // ---------------------------
  findThreats() {
    const threats = [];

    // Obstacles near us
    this.game.obstacles.forEach((obs) => {
      const dist = Vector2.distance(this.ship.position, obs.position);
      if (dist < 170)
        threats.push({ type: "obstacle", entity: obs, distance: dist });
    });

    // Player as threat when close
    if (this.game.ship && !this.game.ship.exploded) {
      const dist = Vector2.distance(
        this.ship.position,
        this.game.ship.position
      );
      if (dist < 220)
        threats.push({
          type: "player",
          entity: this.game.ship,
          distance: dist,
        });
    }

    // Other NPCs as collision threats
    this.game.npcShips.forEach((npc) => {
      if (npc.id === this.ship.id || npc.exploded) return;
      const dist = Vector2.distance(this.ship.position, npc.position);
      if (dist < 140)
        threats.push({ type: "npc", entity: npc, distance: dist });
    });

    return threats;
  }

  findNearestThreat(threats) {
    if (!threats.length) return null;
    return threats.reduce(
      (best, t) => (t.distance < best.distance ? t : best),
      threats[0]
    );
  }

  findClosestObstacle() {
    let best = null;
    let bestD = Infinity;
    for (const obs of this.game.obstacles) {
      const d = Vector2.distance(this.ship.position, obs.position);
      if (d < bestD) {
        bestD = d;
        best = obs;
      }
    }
    return best;
  }

  findBestObstacleTarget() {
    if (!this.game.obstacles || this.game.obstacles.length === 0) return null;

    // Prefer medium distance obstacles (not too close, not too far)
    let best = null;
    let bestScore = -Infinity;

    for (const obs of this.game.obstacles) {
      const d = Vector2.distance(this.ship.position, obs.position);
      if (d < 70 || d > 360) continue;

      // Slightly prefer bigger obstacles (if size exists)
      const sizeBonus = typeof obs.size === "number" ? obs.size * 1.2 : 0;

      // Prefer nearer within the valid band
      const score = 360 - d + sizeBonus;

      if (score > bestScore) {
        bestScore = score;
        best = obs;
      }
    }

    return best;
  }

  findBestNPCVictim() {
    let best = null;
    let bestScore = -Infinity;

    for (const npc of this.game.npcShips) {
      if (!npc || npc.id === this.ship.id || npc.exploded) continue;

      const d = Vector2.distance(this.ship.position, npc.position);
      if (d > this.attackRange) continue;

      // Prefer low energy targets + closer targets
      const weak = (100 - npc.energy) * 1.2;
      const near = this.attackRange - d;

      const score = weak + near;
      if (score > bestScore) {
        bestScore = score;
        best = npc;
      }
    }

    return best;
  }

  // ---------------------------
  // Behaviors
  // ---------------------------
  evade(threat) {
    // Run away
    this.fleeFrom(threat.entity);

    // Shield facing the threat direction (if we can afford)
    this.faceShieldTo(threat.entity);
  }

  fleeFrom(entity) {
    const dir = new Vector2(
      this.ship.position.x - entity.position.x,
      this.ship.position.y - entity.position.y
    ).normalize();

    const fleeAngle = Math.atan2(dir.y, dir.x);

    this.ship.controlMode = "ENGINE";
    this.ship.engineAngle = fleeAngle;

    // Use less energy if low; more if healthy
    const base = this.ship.energy < 30 ? 25 : 45;
    this.ship.enginePower = base + Math.random() * 15;
  }

  faceShieldTo(entity) {
    if (this.ship.energy < 6) return;

    const dir = new Vector2(
      entity.position.x - this.ship.position.x,
      entity.position.y - this.ship.position.y
    ).normalize();

    const ang = Math.atan2(dir.y, dir.x);

    this.ship.controlMode = "SHIELD";
    this.ship.shieldAngle = ang;

    // If low energy keep shield smaller
    this.ship.shieldPower = this.ship.energy < 30 ? 45 : 65;
  }

  attackObstacle(obs) {
    if (!obs) return;

    // Aim at obstacle
    const angle = this.angleTo(obs.position);

    // Small jitter so it doesn't feel robotic
    this.ship.weaponAngle = angle + this.randJitter(this.accuracyJitter);

    // Keep a decent distance (don’t crash into it)
    this.maintainDistance(obs.position, this.preferredFightDistance);

    // Shoot if possible
    this.tryFire();
  }

  attackShip(target, { prioritize = false } = {}) {
    if (!target || target.exploded) return;

    const dist = Vector2.distance(this.ship.position, target.position);
    const angle = this.angleTo(target.position);

    // Aim at ship (with slight jitter)
    this.ship.weaponAngle = angle + this.randJitter(this.accuracyJitter);

    // If prioritizing the player, be a bit more aggressive in closing distance
    const desired = prioritize
      ? this.preferredFightDistance * 0.9
      : this.preferredFightDistance;

    // Strafe around target for dogfighting feel
    if (Math.random() < this.strafeChance) {
      const strafeDir =
        Math.sin(this._seed + this.currentTime * 2) > 0 ? 1 : -1;
      const strafeAngle = angle + (Math.PI / 2) * strafeDir;
      this.thrust(strafeAngle, dist < desired ? 28 : 42);
    } else {
      // Normal distance keeping
      this.maintainDistance(target.position, desired);
    }

    // Shield occasionally if we are close and low-ish energy
    if (dist < 160 && this.ship.energy < 35 && Math.random() < 0.35) {
      this.faceShieldTo(target);
    }

    this.tryFire();
  }

  maintainDistance(point, desiredDist) {
    const dist = Vector2.distance(this.ship.position, point);
    const angle = this.angleTo(point);

    // Too close -> back off
    if (dist < desiredDist * 0.8) {
      this.thrust(angle + Math.PI, 40);
      return;
    }

    // Too far -> move closer
    if (dist > desiredDist * 1.2) {
      this.thrust(angle, 40);
      return;
    }

    // In the band: light orbit to keep movement
    const orbitDir = Math.cos(this._seed + this.currentTime) > 0 ? 1 : -1;
    this.thrust(angle + orbitDir * (Math.PI / 2), 22);
  }

  wander() {
    // Soft roaming so NPCs don’t freeze when no targets
    if (this.ship.energy < 18) {
      // conserve: mild drift
      if (Math.random() < 0.2) this.thrust(Math.random() * Math.PI * 2, 18);
      return;
    }

    if (Math.random() < 0.45) {
      const a = (this._seed + this.currentTime) % (Math.PI * 2);
      this.thrust(a, 28 + Math.random() * 18);
    }
  }

  // ---------------------------
  // Shooting / Engine execution
  // ---------------------------
  tryFire() {
    const ready = this.currentTime - this.lastFireTime >= this.fireCooldown;
    if (!ready) return;

    // Need some energy reserve so NPC doesn’t self-delete instantly
    if (this.ship.energy < 12) return;

    this.ship.controlMode = "WEAPON";

    // Power is tuned to your Laser usage (it uses weaponPower as damage-ish)
    // Keep it reasonable so NPCs don't one-shot everything.
    const max = 28;
    const min = 12;
    const scaled = Math.min(max, Math.max(min, this.ship.energy / 4));
    this.ship.weaponPower = scaled;
  }

  thrust(angle, power) {
    this.ship.controlMode = "ENGINE";
    this.ship.engineAngle = angle;

    // Use power as "impulse strength" proxy.
    // Keep within a range that can actually pass the energy check in executeActions().
    this.ship.enginePower = Math.max(18, Math.min(55, power));
  }

  executeActions(dt) {
    // ENGINE (impulse-like)
    // NOTE: your existing engine model in NPCAI consumed enginePower*3 energy and then zeroed it.
    // We'll keep that pattern for compatibility with the rest of your codebase.
    if (
      this.ship.controlMode === "ENGINE" &&
      this.ship.enginePower > 0 &&
      this.ship.energy >= this.ship.enginePower * 3
    ) {
      const force = Vector2.fromAngle(this.ship.engineAngle).mult(
        this.ship.enginePower / 10
      );
      this.game.physics.applyForce(this.ship, force);

      this.ship.energy -= this.ship.enginePower * 3;

      // one impulse per decision tick (feels intentional)
      this.ship.enginePower = 0;
    }

    // WEAPON (fires laser)
    if (
      this.ship.controlMode === "WEAPON" &&
      this.ship.weaponPower > 0 &&
      this.ship.energy >= this.ship.weaponPower
    ) {
      const fireCost = this.ship.weaponPower;

      this.game.lasers.push(
        new Laser(
          this.ship.position.x,
          this.ship.position.y,
          this.ship.weaponAngle,
          this.ship.weaponPower,
          this.ship.id
        )
      );

      // Keep your original "half cost" pattern (so NPCs can fight longer)
      this.ship.energy -= fireCost / 2;

      this.lastFireTime = this.currentTime;

      // Reset weapon power so it doesn't spam each frame
      this.ship.weaponPower = 0;
    }

    // SHIELD handling remains in Game.js update loop (like your current setup)
  }

  // ---------------------------
  // Helpers
  // ---------------------------
  angleTo(pos) {
    const dx = pos.x - this.ship.position.x;
    const dy = pos.y - this.ship.position.y;
    return Math.atan2(dy, dx);
  }

  randJitter(amount) {
    return (Math.random() * 2 - 1) * amount;
  }
}
