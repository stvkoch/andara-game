import { Entity } from "./Entity.js";
import { Vector2 } from "../utils/Vector2.js";
import { Laser } from "./Laser.js";

const defaultShipOptions = {
  x: 0,
  y: 0,
  isNPC: false,
  id: null,
  size: 20,
  color: null, // Will be set based on isNPC if not provided
  maxEnergy: 100,
  energy: 100,
  energyRegen: 7,
  score: 0,
  level: 1,
  explosionDuration: 0.5,
};

const playerShipOptions = {
  ...defaultShipOptions,
  isNPC: false,
  color: "#00f0ff", // Cyan for player
  maxEnergy: 100,
  enginePower: 50,
  weaponPower: 50,
  shieldPower: 50,
};

const npcShipOptions = {
  ...defaultShipOptions,
  isNPC: true,
  color: "#ffaa00", // Orange for NPCs
  maxEnergy: 100,
  energyRegen: 4,
  enginePower: 20,
  weaponPower: 20,
  shieldPower: 20,
};

export class Ship extends Entity {
  // ai property is added here
  ai = null;
  id = null;

  constructor(options = {}) {
    // Merge with appropriate defaults based on isNPC
    const isNPC =
      options.isNPC !== undefined ? options.isNPC : defaultShipOptions.isNPC;
    const baseOptions = isNPC ? npcShipOptions : playerShipOptions;
    const mergedOptions = { ...baseOptions, ...options };

    super(mergedOptions.x, mergedOptions.y);

    this.id = mergedOptions.id || Math.random().toString(36).substring(2, 15);
    this.size = mergedOptions.size;
    this.isNPC = mergedOptions.isNPC;
    this.color = mergedOptions.color;

    // Control state
    this.controlMode = "ENGINE"; // 'ENGINE', 'WEAPON', 'SHIELD'
    this.engineAngle = Math.random() * 360;
    this.enginePower = mergedOptions.enginePower; // Default 50%
    this.weaponAngle = Math.random() * 360;
    this.weaponPower = mergedOptions.weaponPower; // Default 50%
    this.shieldAngle = Math.random() * 360;
    this.shieldPower = mergedOptions.shieldPower; // Default 50%
    this.fireCost = mergedOptions.fireCost || Math.random() * 0.3 + 0.2;

    this.shield = {
      active: false,
      energized: false, // Whether shield should be active (set by button)
      angle: 0,
      power: 0,
    };

    this.maxEnergy = mergedOptions.maxEnergy;
    this.energy = mergedOptions.energy;
    this.energyRegen = mergedOptions.energyRegen;

    // Score and level
    this.score = mergedOptions.score;
    this.level = mergedOptions.level;

    // Explosion state
    this.exploded = false;
    this.explosionTimer = 0;
    this.explosionDuration = mergedOptions.explosionDuration;

    // Callback for actions (fire, launch, shield change)
    this.onAction = null;
    this.onEnergyChange = null;
  }

  /**
   * Update state from server/network
   */
  updateState(state) {
    if (state.position) {
      this.position.x = state.position.x;
      this.position.y = state.position.y;
    }
    if (state.velocity) {
      this.velocity.x = state.velocity.x;
      this.velocity.y = state.velocity.y;
    }
    if (state.energy !== undefined) {
      this.energy = state.energy;
    }
    if (state.shieldPower !== undefined) {
      this.shieldPower = state.shieldPower;
    }
    if (state.shieldEnergized !== undefined) {
      this.shield.energized = state.shieldEnergized;
      this.shield.active = state.shieldEnergized;
    }
    if (state.shieldAngle !== undefined) {
      this.shieldAngle = state.shieldAngle;
      this.shield.angle = state.shieldAngle;
    }
    if (state.controlMode !== undefined) {
      this.controlMode = state.controlMode;
    }
    if (state.engineAngle !== undefined) {
      this.engineAngle = state.engineAngle;
    }
    if (state.enginePower !== undefined) {
      this.enginePower = state.enginePower;
    }
    if (state.weaponAngle !== undefined) {
      this.weaponAngle = state.weaponAngle;
    }
    if (state.weaponPower !== undefined) {
      this.weaponPower = state.weaponPower;
    }
    if (this.energy < 20) {
      this.color = "#ff0000";
    } else {
      this.color = this.isNPC ? "#ffaa00" : "#00f0ff";
    }
  }

  /**
   * Add energy to the ship, capped at maxEnergy
   * @param {number} amount - Amount of energy to add
   * @returns {number} - Actual amount of energy added
   */
  addEnergy(amount) {
    if (amount <= 0 || this.exploded) {
      return 0;
    }

    const oldEnergy = this.energy;
    const newEnergy = Math.min(this.maxEnergy, this.energy + amount);

    // Use updateState to update energy
    this.updateState({ energy: newEnergy });

    // Trigger energy change callback if set
    if (this.onEnergyChange) {
      this.onEnergyChange(this.energy, this.shieldPower);
    }
  }

  /**
   * Apply action (fire, launch, shield change)
   */
  applyAction(action, physics = null) {
    switch (action.type) {
      case "fire":
        return this.fire(physics);

      case "launch":
        return this.launch(action.angle, action.power, physics);

      case "shieldChange":
        this.setShieldState(
          action.shieldEnergized,
          action.shieldAngle,
          action.shieldPower
        );
        return true;

      default:
        return false;
    }
  }

  /**
   * Fire weapon - creates laser and consumes energy
   */
  fire(physics = null) {
    const fireCost = this.fireCost * this.weaponPower;
    const laserPower = this.fireCost * this.weaponPower;
    if (this.energy < fireCost || this.exploded) {
      return null;
    }

    // Disable shield when shooting
    this.shield.energized = false;
    this.shield.active = false;

    const laser = new Laser(
      this.position.x,
      this.position.y,
      this.weaponAngle,
      laserPower,
      this.id
    );

    this.energy -= fireCost;

    if (this.onAction) {
      this.onAction("fire", {
        position: { x: this.position.x, y: this.position.y },
        weaponAngle: this.weaponAngle,
        weaponPower: laserPower,
      });
    }

    return laser;
  }

  /**
   * Launch engine - applies force and consumes energy
   */
  launch(angle, power, physics) {
    if (!physics || this.energy < power * 3 || this.exploded) {
      return false;
    }

    const force = Vector2.fromAngle(angle).mult(power);
    physics.applyForce(this, force);
    this.energy -= power * 3;

    if (this.onAction) {
      this.onAction("launch", {
        engineAngle: angle,
        enginePower: power,
      });
    }

    return true;
  }

  /**
   * Set shield state
   */
  setShieldState(energized, angle, power) {
    this.shield.energized = energized;
    this.shield.active = energized;
    if (angle !== undefined) {
      this.shieldAngle = angle;
      this.shield.angle = angle;
    }
    if (power !== undefined) {
      this.shieldPower = power;
      this.shield.power = power;
    }

    if (this.onAction) {
      this.onAction("shieldChange", {
        shieldEnergized: energized,
        shieldAngle: this.shieldAngle,
        shieldPower: this.shieldPower,
      });
    }
  }

  /**
   * Check if shield protects against laser
   */
  checkShieldProtection(laserPosition) {
    if (!this.shield.active || this.shieldPower <= 0) {
      return false;
    }

    const dx = laserPosition.x - this.position.x;
    const dy = laserPosition.y - this.position.y;
    const angleToLaser = Math.atan2(dy, dx);

    let shieldFacing = this.shield.angle % (Math.PI * 2);
    if (shieldFacing > Math.PI) shieldFacing -= Math.PI * 2;

    const maxSpread = Math.PI;
    const spread = (this.shieldPower / 100) * maxSpread;
    const halfSpread = spread / 2;

    let diff = angleToLaser - shieldFacing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    return Math.abs(diff) < halfSpread;
  }

  /**
   * Take damage from laser
   */
  takeDamage(damage, laserPosition, isMyLaser = false) {
    if (this.exploded) return false;

    const isProtected = this.checkShieldProtection(laserPosition);

    if (isProtected && this.shieldPower > 0) {
      // Shield absorbs damage
      this.shieldPower -= damage;
      if (this.shieldPower < 0) this.shieldPower = 0;

      if (this.onEnergyChange) {
        this.onEnergyChange(this.energy, this.shieldPower);
      }

      return true; // Damage absorbed
    } else {
      // Hull takes damage
      this.energy -= damage;

      // Damage indication

      if (this.onEnergyChange) {
        this.onEnergyChange(this.energy, this.shieldPower);
      }

      return true; // Damage taken
    }
  }

  checkExplosion() {
    if (this.energy < 0 && !this.exploded) {
      this.exploded = true;
      this.explosionTimer = 0;
      return true;
    }
    return false;
  }

  updateExplosion(dt) {
    if (this.exploded) {
      this.explosionTimer += dt;
      if (this.explosionTimer >= this.explosionDuration) {
        // Explosion complete
        return true;
      }
    }
    return false;
  }

  draw(ctx) {
    // Draw explosion if exploded
    if (this.exploded) {
      const progress = this.explosionTimer / this.explosionDuration;
      const radius = this.size * (1 + progress * 3);
      const alpha = 1 - progress;

      // Draw explosion particles
      ctx.save();
      ctx.translate(this.position.x, this.position.y);

      // Multiple explosion layers for depth

      // Layer 1: Outer shockwave ring
      const shockwaveRadius = radius * 1.2;
      ctx.strokeStyle = `rgba(255, 150, 50, ${alpha * 0.6})`;
      ctx.lineWidth = 3 + progress * 5;
      ctx.beginPath();
      ctx.arc(0, 0, shockwaveRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Layer 2: Main explosion gradient
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      gradient.addColorStop(0.2, `rgba(255, 200, 100, ${alpha * 0.9})`);
      gradient.addColorStop(0.5, `rgba(255, 100, 0, ${alpha * 0.6})`);
      gradient.addColorStop(0.8, `rgba(200, 50, 0, ${alpha * 0.3})`);
      gradient.addColorStop(1, `rgba(100, 0, 0, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      // Layer 3: Bright core with pulsing
      const coreSize = radius * (0.4 - progress * 0.2);
      const corePulse = Math.sin(progress * Math.PI * 4) * 0.2 + 1;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * corePulse})`;
      ctx.beginPath();
      ctx.arc(0, 0, coreSize, 0, Math.PI * 2);
      ctx.fill();

      // Layer 4: Flying debris particles (primary)
      const primaryParticles = 12;
      for (let i = 0; i < primaryParticles; i++) {
        const angle = (i / primaryParticles) * Math.PI * 2 + progress * 0.5;
        const dist = radius * (0.8 + progress * 0.4);
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        const particleSize = this.size * (0.4 - progress * 0.2);

        // Varying colors for debris
        const hue = i % 3;
        let color;
        if (hue === 0) {
          color = `rgba(255, ${200 - progress * 100}, 0, ${alpha})`;
        } else if (hue === 1) {
          color = `rgba(255, ${100 + progress * 50}, 0, ${alpha * 0.8})`;
        } else {
          color = `rgba(200, 50, 0, ${alpha * 0.6})`;
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, particleSize, 0, Math.PI * 2);
        ctx.fill();

        // Add glow to particles
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Layer 5: Secondary smaller particles
      const secondaryParticles = 20;
      for (let i = 0; i < secondaryParticles; i++) {
        const angle = (i / secondaryParticles) * Math.PI * 2 + progress * 1.5;
        const dist = radius * (0.5 + progress * 0.8 + (i % 3) * 0.1);
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        const particleSize = this.size * (0.15 - progress * 0.1);

        ctx.fillStyle = `rgba(255, ${150 + Math.random() * 100}, 0, ${
          alpha * 0.7
        })`;
        ctx.beginPath();
        ctx.arc(x, y, particleSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Layer 6: Sparks (small fast particles)
      const sparks = 16;
      for (let i = 0; i < sparks; i++) {
        const angle =
          (i / sparks) * Math.PI * 2 + Math.sin(progress * Math.PI * 2) * 0.3;
        const dist = radius * (1.0 + progress * 1.2);
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        const sparkSize = this.size * 0.1;

        // Bright yellow-white sparks
        ctx.fillStyle = `rgba(255, 255, ${200 + Math.random() * 55}, ${
          alpha * 0.9
        })`;
        ctx.beginPath();
        ctx.arc(x, y, sparkSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Layer 7: Smoke trails (darker particles)
      if (progress > 0.3) {
        const smokeParticles = 8;
        for (let i = 0; i < smokeParticles; i++) {
          const angle = (i / smokeParticles) * Math.PI * 2;
          const dist = radius * (0.6 + (progress - 0.3) * 0.5);
          const x = Math.cos(angle) * dist;
          const y = Math.sin(angle) * dist;
          const smokeSize = this.size * (0.5 + (progress - 0.3) * 0.8);

          ctx.fillStyle = `rgba(100, 50, 0, ${alpha * 0.4 * (1 - progress)})`;
          ctx.beginPath();
          ctx.arc(x, y, smokeSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
      return; // Don't draw ship if exploded
    }

    ctx.save();
    ctx.translate(this.position.x, this.position.y);
    // Rotate 90 deg because 0 is usually Right in math, but Up in games?
    // Let's assume 0 is Right (Standard math circle).
    ctx.rotate(this.engineAngle);

    // Draw NPC ships with Klingon design, player ships with triangle
    if (this.isNPC) {
      this.drawKlingonShip(ctx);
    } else {
      this.drawTriangleShip(ctx);
    }

    // Draw engine glow if moving
    if (this.velocity.mag() > 0.1) {
      ctx.fillStyle = "rgba(255, 100, 0, 0.8)";
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(-15, -5);
      ctx.lineTo(-20, 0); // Tip of flame
      ctx.lineTo(-15, 5);
      ctx.fill();
    }

    ctx.restore();

    // Draw Shield (always show for NPCs when energized, only when active for player)
    if (
      this.shield.active ||
      (this.isNPC && this.shield.energized && this.shieldPower > 0)
    ) {
      ctx.save();
      ctx.translate(this.position.x, this.position.y);
      ctx.rotate(this.shieldAngle);

      const radius = this.size + 15; // Fixed radius
      const maxSpread = Math.PI; // Max is Semicircle (180 degrees)
      // Use shield.power if active, otherwise use shieldPower property
      const shieldPower = this.shieldPower;
      const spread = (shieldPower / 100) * maxSpread;
      const startAngle = -spread / 2;
      const endAngle = spread / 2;

      ctx.beginPath();
      ctx.arc(0, 0, radius, startAngle, endAngle);

      // Dimmer for inactive shields on NPCs
      const alpha = this.shield.active
        ? 0.5 + shieldPower / 200
        : 0.2 + shieldPower / 500; // Dimmer when inactive
      ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`; // Cyan glow
      ctx.lineWidth = this.shield.active ? 4 : 2; // Thinner when inactive
      ctx.stroke();

      ctx.restore();
    }

    // Draw Weapon Aim Indicator for NPCs (similar to player ship)
    if (this.isNPC && this.weaponPower > 0) {
      const aimAngle = this.weaponAngle;
      const aimDist = this.size + 7;
      const aimX = this.position.x + Math.cos(aimAngle) * aimDist;
      const aimY = this.position.y + Math.sin(aimAngle) * aimDist;

      ctx.fillStyle = "#ff00ff";
      ctx.beginPath();
      ctx.arc(aimX, aimY, 2, 0, Math.PI * 2); // Slightly smaller for NPCs
      ctx.fill();
    }

    // Draw Energy Bar as bottom line for NPCs
    if (this.isNPC) {
      const barWidth = this.size * 2;
      const barHeight = 4;
      const barX = this.position.x - barWidth / 2;
      const barY = this.position.y + this.size + 8;

      // Background
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // Energy fill
      const energyPercent = this.energy / this.maxEnergy;
      const fillWidth = barWidth * energyPercent;
      ctx.fillStyle = energyPercent < 0.2 ? "#ff0000" : "#0f0";
      ctx.fillRect(barX, barY, fillWidth, barHeight);

      // Border
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
  }

  drawTriangleShip(ctx) {
    ctx.fillStyle = this.color;
    // Draw a triangle ship
    ctx.beginPath();
    ctx.moveTo(10, 0); // Nose
    ctx.lineTo(-10, -10); // Rear Left
    ctx.lineTo(-5, 0); // Engine center
    ctx.lineTo(-10, 10); // Rear Right
    ctx.closePath();
    ctx.fill();
  }

  drawPlayerShip(ctx) {
    // 1. Draw Engine Glows (draw these first so they are underneath)
    ctx.fillStyle = "orange";
    ctx.shadowBlur = 10; // Add a glow effect
    ctx.shadowColor = "red";

    // Left engine glow
    ctx.beginPath();
    ctx.rect(-12, -8, 4, 4);
    ctx.fill();
    // Right engine glow
    ctx.beginPath();
    ctx.rect(-12, 4, 4, 4);
    ctx.fill();

    // Reset shadow for the main body
    ctx.shadowBlur = 0;

    // 2. Draw Main Body/Wings
    ctx.fillStyle = "#555577"; // Blue-grey hull
    ctx.strokeStyle = "#aabbdd";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(15, 0); // Nose point
    ctx.lineTo(-5, -12); // Left wingtip
    ctx.lineTo(-8, -4); // Left engine connector
    ctx.lineTo(-8, 4); // Right engine connector
    ctx.lineTo(-5, 12); // Right wingtip
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Draw Heavy Engine Pods on the sides
    ctx.fillStyle = "#444444"; // Darker engine color
    ctx.beginPath();
    // Left pod
    ctx.rect(-10, -10, 6, 5);
    // Right pod
    ctx.rect(-10, 5, 6, 5);
    ctx.fill();
    ctx.stroke();
  }

  drawShip(ctx) {
    // Calculate scale factor based on ship size (base design is for size ~150)
    const baseSize = 200;
    const scale = this.size / baseSize;
    
    // --- DRAWING HELPERS ---
    // Helper to draw the main body shape (used for shadow and main body)
    function drawBodyShape() {
      ctx.beginPath();
      ctx.arc(0, 0, 150 * scale, 0, Math.PI * 2);
      ctx.closePath();
    }

    // Helper to draw thruster nozzles
    function drawNozzles(isShadow = false) {
      ctx.fillStyle = isShadow ? "rgba(0,0,0,0.3)" : "#3A4750"; // Dark grey
      const nozzleWidthTop = 40 * scale;
      const nozzleWidthBottom = 50 * scale;
      const nozzleHeight = 40 * scale;
      const offset = 60 * scale;
      const yStart = 135 * scale;

      // Left Nozzle
      ctx.beginPath();
      ctx.moveTo(-offset - nozzleWidthTop / 2, yStart);
      ctx.lineTo(-offset + nozzleWidthTop / 2, yStart);
      ctx.lineTo(-offset + nozzleWidthBottom / 2, yStart + nozzleHeight);
      ctx.lineTo(-offset - nozzleWidthBottom / 2, yStart + nozzleHeight);
      ctx.closePath();
      ctx.fill();

      // Right Nozzle
      ctx.beginPath();
      ctx.moveTo(offset - nozzleWidthTop / 2, yStart);
      ctx.lineTo(offset + nozzleWidthTop / 2, yStart);
      ctx.lineTo(offset + nozzleWidthBottom / 2, yStart + nozzleHeight);
      ctx.lineTo(offset - nozzleWidthBottom / 2, yStart + nozzleHeight);
      ctx.closePath();
      ctx.fill();
    }

    // Helper for flames
    function drawFlame(xOffset, yStart, flameScale) {
      ctx.save();
      ctx.translate(xOffset, yStart);
      ctx.scale(flameScale * scale, flameScale * scale);

      // Outer Flame (Red-Orange)
      ctx.fillStyle = "#E64A19";
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.quadraticCurveTo(-30, 40, 0, 80); // Tip
      ctx.quadraticCurveTo(30, 40, 20, 0);
      ctx.closePath();
      ctx.fill();

      // Middle Flame (Orange)
      ctx.fillStyle = "#FF9800";
      ctx.beginPath();
      ctx.moveTo(-15, 5);
      ctx.quadraticCurveTo(-20, 35, 0, 65);
      ctx.quadraticCurveTo(20, 35, 15, 5);
      ctx.closePath();
      ctx.fill();

      // Inner Flame (Yellow)
      ctx.fillStyle = "#FFEB3B";
      ctx.beginPath();
      ctx.moveTo(-10, 15);
      ctx.quadraticCurveTo(-12, 35, 0, 50);
      ctx.quadraticCurveTo(12, 35, 10, 15);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // 2. The Shadow (Drawn first, offset slightly)
    ctx.save();
    ctx.translate(0, 10); // Shadow offset
    // ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillStyle = "rgba(240, 12, 12, 1)";
    drawBodyShape();
    ctx.fill();
    drawNozzles(true);
    // Simple shadow for flames
    ctx.beginPath();
    ctx.ellipse(-60 * scale, 200 * scale, 25 * scale, 40 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(60 * scale, 200 * scale, 25 * scale, 40 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Main Body Base
    const bodyGrad = ctx.createLinearGradient(-150 * scale, -150 * scale, 150 * scale, 150 * scale);
    bodyGrad.addColorStop(0.2, "#F5F5F5"); // White highlight top left
    bodyGrad.addColorStop(1, "#CFD8DC"); // Greyish bottom right

    drawBodyShape();
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    // Slight rim stroke for definition
    ctx.strokeStyle = "#ECEFF1";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 4. Body Details (Panel Lines)
    ctx.strokeStyle = "#B0BEC5"; // Light grey lines
    ctx.lineWidth = 4 * scale;
    ctx.lineCap = "round";

    // Center vertical line
    ctx.beginPath();
    ctx.moveTo(0, -150 * scale);
    ctx.lineTo(0, 150 * scale);
    ctx.stroke();

    // Inner circle arc boundaries
    const innerR = 100 * scale;
    ctx.beginPath();
    // Top arc segment
    ctx.arc(0, 0, innerR, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    // Bottom arc segment
    ctx.arc(0, 0, innerR, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();

    // Horizontal panel connectors
    // ctx.beginPath();
    // ctx.moveTo(-148 * scale, 0);
    // ctx.lineTo(-innerR, 0);
    // ctx.moveTo(148 * scale, 0);
    // ctx.lineTo(innerR, 0);
    // ctx.stroke();

    // 5. Rivets on the right
    // ctx.fillStyle = "#B0BEC5";
    // ctx.beginPath();
    // ctx.arc(125 * scale, -20 * scale, 8 * scale, 0, Math.PI * 2);
    // ctx.fill();
    // ctx.beginPath();
    // ctx.arc(125 * scale, 20 * scale, 8 * scale, 0, Math.PI * 2);
    // ctx.fill();

    // 6. Thrusters and Flames
    // drawNozzles();
    // drawFlame(-60 * scale, 170 * scale, 1);
    // drawFlame(60 * scale, 170 * scale, 1);

    // 7. Window Assembly
    // Window Frame
    ctx.fillStyle = "#37474F"; // Dark charcoal
    ctx.beginPath();
    ctx.arc(0, 0, 70 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Window Glass
    const glassGrad = ctx.createLinearGradient(-30 * scale, -30 * scale, 30 * scale, 50 * scale);
    glassGrad.addColorStop(0, "#4DD0E1"); // Cyan
    glassGrad.addColorStop(1, "#00ACC1"); // Darker cyan

    ctx.fillStyle = glassGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 55 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Window Reflections (Sharp cartoon style)
    // ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    // ctx.beginPath();
    // // Top left large reflection curved shape
    // ctx.moveTo(-15 * scale, -45 * scale);
    // ctx.quadraticCurveTo(-45 * scale, -20 * scale, -35 * scale, 10 * scale);
    // ctx.quadraticCurveTo(-25 * scale, -10 * scale, -5 * scale, -30 * scale);
    // ctx.closePath();
    // ctx.fill();

    // Bottom right smaller reflection
    // ctx.beginPath();
    // ctx.ellipse(25 * scale, 25 * scale, 15 * scale, 8 * scale, Math.PI / 4, 0, Math.PI * 2);
    // ctx.fill();

    ctx.restore(); // Restore from CX, CY translation
  }

  drawKlingonShip(ctx) {
    // Scale factor to match ship size (original design is ~360 units wide)
    const scale = this.size / 200; // Scale relative to default size of 20
    const baseWidth = 360;
    const baseHeight = 230;

    // Use ship's color, or default to brownish for NPCs
    const shipColor = this.color || "#8B4513";

    // Draw the main body (bridge, neck, and primary hull)
    // Coordinates are centered and scaled
    ctx.fillStyle = shipColor;
    ctx.beginPath();

    // Top of the bridge (centered at origin)
    ctx.moveTo(0 * scale, -90 * scale);
    // Right side of the bridge/neck junction
    ctx.lineTo(50 * scale, -40 * scale);
    // Right wing tip
    ctx.lineTo(180 * scale, -15 * scale);
    // Bottom right hull edge
    ctx.lineTo(50 * scale, 10 * scale);
    // Bottom center of the hull
    ctx.lineTo(0 * scale, 0 * scale);
    // Bottom left hull edge (mirrored right side)
    ctx.lineTo(-50 * scale, 10 * scale);
    // Left wing tip
    ctx.lineTo(-180 * scale, -15 * scale);
    // Left side of the bridge/neck junction
    ctx.lineTo(-50 * scale, -40 * scale);
    // Back to the top of the bridge to close the path
    ctx.closePath();
    ctx.fill();

    // Draw the engine section (below the main body)
    ctx.beginPath();
    ctx.fillStyle = "#555"; // Darker color for engines
    ctx.rect(-20 * scale, 10 * scale, 40 * scale, 30 * scale);
    ctx.fill();
    ctx.closePath();

    // Add a small detail to the bridge (window)
    ctx.beginPath();
    ctx.fillStyle = "#eee";
    ctx.arc(0 * scale, -75 * scale, 5 * scale, 0, Math.PI * 2, false);
    ctx.fill();
    ctx.closePath();
  }
}
