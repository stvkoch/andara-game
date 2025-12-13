import { Entity } from './Entity.js';

export class Obstacle extends Entity {
  constructor(x, y, radius = 30) {
    super(x, y);
    this.size = radius;
    this.color = '#ff4444';
    this.id = null; // Will be set if synced from server
    this.onDestroyed = null; // Callback when destroyed
  }
  
  /**
   * Update state from server/network
   */
  updateState(state) {
    if (state.position) {
      this.position.x = state.position.x;
      this.position.y = state.position.y;
    }
    if (state.size !== undefined) {
      this.size = state.size;
    }
  }
  
  /**
   * Take damage from laser
   */
  takeDamage(damage, laserPosition, laserId) {
    this.size -= damage * 0.5; // Shrink
    
    if (this.size < 10) {
      // Destroyed
      if (this.onDestroyed) {
        this.onDestroyed(laserId);
      }
      return true; // Destroyed
    }
    
    return false; // Still alive
  }
  
  /**
   * Check if obstacle is destroyed
   */
  isDestroyed() {
    return this.size < 10;
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
