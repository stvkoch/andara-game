import { Entity } from './Entity.js';

export class Obstacle extends Entity {
  constructor(x, y, radius = 30) {
    super(x, y);
    this.size = radius;
    this.color = '#ff4444';
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, this.size, 0, Math.PI * 2);
    ctx.fill();

    // Shine effect
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(this.position.x - this.size * 0.3, this.position.y - this.size * 0.3, this.size * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}
