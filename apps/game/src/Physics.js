import { Vector2 } from './utils/Vector2.js';

export class Physics {
  constructor(dragCoefficient = 0.02) {
    this.dragCoefficient = dragCoefficient;
  }

  applyPhysics(entity) {
    // Apply velocity to position
    entity.position.add(entity.velocity);

    // Apply acceleration to velocity
    entity.velocity.add(entity.acceleration);

    // Reset acceleration
    entity.acceleration.mult(0);

    // Apply Drag (Gravity in user terms)
    // Drag force opposed to velocity: Fd = -c * v
    const speed = entity.velocity.mag();
    if (speed > 0) {
        // Simple linear drag or quadratic? User asked for "stop by gravity force"
        // Let's use a friction factor per frame.
        // V_new = V * (1 - friction)
        entity.velocity.mult(1 - this.dragCoefficient);
        
        // Snap to 0 if very small
        if (speed < 0.01) {
            entity.velocity.mult(0);
        }
    }
  }

  /**
   * Apply a force to an entity
   * @param {Entity} entity
   * @param {Vector2} force
   */
  applyForce(entity, force) {
    // F = ma -> a = F/m (assuming mass 1 for now)
    entity.acceleration.add(force);
  }
}
