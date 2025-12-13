import { Physics } from './Physics.js';
import { Ship } from './entities/Ship.js';
import { Obstacle } from './entities/Obstacle.js';
import { Laser } from './entities/Laser.js';
import { Vector2 } from './utils/Vector2.js';
import { Input } from './Input.js';
import { NPCAI } from './entities/NPCAI.js';

export class Game {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");
    this.width = this.canvas.width = this.canvas.parentElement.clientWidth;
    this.height = this.canvas.height = this.canvas.parentElement.clientHeight;

    this.physics = new Physics(0.01); // Drag
    this.ship = new Ship({
      x: this.width / 2,
      y: this.height / 2,
      isNPC: false
    });
    this.input = new Input(this.ship);

    this.lasers = [];
    this.obstacles = [];
    this.stars = [];
    this.npcShips = [];

    // Generate game elements
    this.generateStars();
    this.generateObstacles();
    this.generateNPCs();

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
        // Spawn Laser
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
    
    // Regenerate obstacles if none exist
    if (this.obstacles.length === 0) {
      this.generateObstacles();
      // Update entities array
      this.entities = [this.ship, ...this.obstacles, ...this.npcShips];
    }
    
    // Regenerate NPCs if none exist
    if (this.npcShips.length === 0) {
      this.generateNPCs();
      // Update entities array
      this.entities = [this.ship, ...this.obstacles, ...this.npcShips];
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

    // Update NPC ships
    for (let i = this.npcShips.length - 1; i >= 0; i--) {
        const npcShip = this.npcShips[i];
        
        // Check for explosion
        if (npcShip.checkExplosion()) {
            console.log('NPC ship exploded!');
        }
        
        // Update explosion
        if (npcShip.exploded) {
            if (npcShip.updateExplosion(dt)) {
                // Explosion complete - remove NPC
                this.npcShips.splice(i, 1);
                continue;
            }
        } else {
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
            const npcShieldActiveRequest = (npcShip.controlMode === 'SHIELD');
            const npcShieldCostRate = (npcShip.shieldPower / 100) * 30;
            const npcShieldFrameCost = npcShieldCostRate * dt;

            if (npcShieldActiveRequest && npcShip.energy > npcShieldFrameCost) {
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

    // Update Physics (only if not exploded)
    if (!this.ship.exploded) {
        this.physics.applyPhysics(this.ship);
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
              console.log('Checking player ship',this.ship.id, laser.id,
                this.ship.shield.active,
              );
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
