import { Entity } from './Entity.js';

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
  color: '#00f0ff', // Cyan for player
  maxEnergy: 100,
  enginePower: 50,
  weaponPower: 50,
  shieldPower: 50,
};

const npcShipOptions = {
  ...defaultShipOptions,
  isNPC: true,
  color: '#ffaa00', // Orange for NPCs
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
    const isNPC = options.isNPC !== undefined ? options.isNPC : defaultShipOptions.isNPC;
    const baseOptions = isNPC ? npcShipOptions : playerShipOptions;
    const mergedOptions = { ...baseOptions, ...options };
    
    super(mergedOptions.x, mergedOptions.y);
    
    this.id = mergedOptions.id || Math.random().toString(36).substring(2, 15);
    this.size = mergedOptions.size;
    this.isNPC = mergedOptions.isNPC;
    this.color = mergedOptions.color;
    
    // Control state
    this.controlMode = 'ENGINE'; // 'ENGINE', 'WEAPON', 'SHIELD'
    this.engineAngle = Math.random() * 360;
    this.enginePower = mergedOptions.enginePower; // Default 50%
    this.weaponAngle = Math.random() * 360;
    this.weaponPower = mergedOptions.weaponPower; // Default 50%
    this.shieldAngle = Math.random() * 360;
    this.shieldPower = mergedOptions.shieldPower; // Default 50%
    
    this.shield = {
        active: false,
        energized: false, // Whether shield should be active (set by button)
        angle: 0,
        power: 0
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
        
        ctx.fillStyle = `rgba(255, ${150 + Math.random() * 100}, 0, ${alpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(x, y, particleSize, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Layer 6: Sparks (small fast particles)
      const sparks = 16;
      for (let i = 0; i < sparks; i++) {
        const angle = (i / sparks) * Math.PI * 2 + Math.sin(progress * Math.PI * 2) * 0.3;
        const dist = radius * (1.0 + progress * 1.2);
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        const sparkSize = this.size * 0.1;
        
        // Bright yellow-white sparks
        ctx.fillStyle = `rgba(255, 255, ${200 + Math.random() * 55}, ${alpha * 0.9})`;
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

    ctx.fillStyle = this.color;
    
    // Draw a triangle ship
    ctx.beginPath();
    ctx.moveTo(10, 0);   // Nose
    ctx.lineTo(-10, -10); // Rear Left
    ctx.lineTo(-5, 0);    // Engine center
    ctx.lineTo(-10, 10);  // Rear Right
    ctx.closePath();
    ctx.fill();

    // Draw engine glow if moving
    if (this.velocity.mag() > 0.1) {
        ctx.fillStyle = 'rgba(255, 100, 0, 0.8)';
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(-15, -5);
        ctx.lineTo(-20, 0); // Tip of flame
        ctx.lineTo(-15, 5);
        ctx.fill();
    }

    ctx.restore();

    // Draw Shield (always show for NPCs when energized, only when active for player)
    if (this.shield.active || (this.isNPC && this.shield.energized && this.shieldPower > 0)) {
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
          ? (0.5 + (shieldPower / 200))
          : (0.2 + (shieldPower / 500)); // Dimmer when inactive
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

        ctx.fillStyle = '#ff00ff';
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
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Energy fill
        const energyPercent = this.energy / this.maxEnergy;
        const fillWidth = barWidth * energyPercent;
        ctx.fillStyle = energyPercent < 0.2 ? '#ff0000' : '#0f0';
        ctx.fillRect(barX, barY, fillWidth, barHeight);
        
        // Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
  }
}
