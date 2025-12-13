import './style.css'
import { Game } from './src/Game.js';
import { Physics } from './src/Physics.js';
import { Vector2 } from './src/utils/Vector2.js';

console.log('Booting Space Game...');

const game = new Game('gameCanvas');
game.start();

// Expose game instance for UI later
window.game = game;
window.Vector2 = Vector2;
window.Physics = Physics;
