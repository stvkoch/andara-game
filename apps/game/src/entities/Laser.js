import { Entity } from './Entity.js';
import { Vector2 } from '../utils/Vector2.js';

export class Laser extends Entity {
  constructor(x, y, angle, power, id) {
    super(x, y);
    this.size = 3;
    this.color = '#ff00ff';
    this.angle = angle;
    // Velocity based on angle and massive speed? Or controlled by power?
    // "shoot a laser that will decrease the power of obstaculo"
    // Usually lasers are fast. Let's make speed high constant + power?
    // Or maybe Power = Damage, and Speed is fixed?
    // User said "set the direction and the power and shoot a laser"
    // Let's use Power as Damage. Speed fixed.
    
    this.speed = 10;
    this.velocity = Vector2.fromAngle(angle).mult(this.speed);
    
    this.damage = power; // Arbitrary damage scale
    this.life = 100; // Frames to live
    this.id = id;
  }

  update() {
      this.position.add(this.velocity);
      this.life--;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.position.x, this.position.y);
    ctx.rotate(this.angle);
    
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.fillRect(-10, -2, 20, 4); // Long laser bolt
    ctx.fill();

    // Glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.restore();
    ctx.shadowBlur = 0;
  }
}
