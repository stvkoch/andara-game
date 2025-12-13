import { Vector2 } from '../utils/Vector2.js';

export class Entity {
  constructor(x, y) {
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(0, 0);
    this.acceleration = new Vector2(0, 0);
    this.size = 10;
    this.color = '#fff';
  }

  update() {
    // Override in subclass or use component system
  } 

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw velocity vector (debug?)
    // ctx.strokeStyle = 'red';
    // ctx.beginPath();
    // ctx.moveTo(this.position.x, this.position.y);
    // ctx.lineTo(this.position.x + this.velocity.x * 10, this.position.y + this.velocity.y * 10);
    // ctx.stroke();
  }
}
