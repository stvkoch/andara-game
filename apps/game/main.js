import './style.css'
import { Game } from './src/Game.js';
import { Physics } from './src/Physics.js';
import { Vector2 } from './src/utils/Vector2.js';

console.log('Booting Space Game...');

// Initialize game in single-player mode by default
let game = new Game('gameCanvas', { multiplayer: false });
game.start();

// Expose game instance for UI later
window.game = game;
window.Vector2 = Vector2;
window.Physics = Physics;

// Multiplayer connection handlers
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const serverUrlInput = document.getElementById('serverUrl');
const playerNameInput = document.getElementById('playerName');
const connectionStatus = document.getElementById('connectionStatus');
const playerCount = document.getElementById('playerCount');

let isMultiplayerMode = false;

connectBtn.addEventListener('click', () => {
  const serverUrl = serverUrlInput.value.trim();
  const playerName = playerNameInput.value.trim() || 'Player';
  
  if (!serverUrl) {
    alert('Please enter a server URL');
    return;
  }
  
  // If not in multiplayer mode, switch to multiplayer
  if (!isMultiplayerMode) {
    // Stop current game
    // Note: We can't easily stop requestAnimationFrame, but we can switch modes
    isMultiplayerMode = true;
    
    // Reinitialize game in multiplayer mode
    // This is a simple approach - in production you might want to properly clean up
    game = new Game('gameCanvas', { multiplayer: true });
    game.start();
    
    // Initialize network client
    game.initNetworkClient(serverUrl, playerName);
    
    // Update UI
    connectBtn.style.display = 'none';
    disconnectBtn.style.display = 'inline-block';
    serverUrlInput.disabled = true;
    playerNameInput.disabled = true;
    connectionStatus.textContent = 'Connecting...';
    connectionStatus.style.color = '#ff0';
  } else {
    // Already in multiplayer, just reconnect
    if (game.networkClient) {
      game.networkClient.disconnect();
      game.networkClient.connect(playerName);
    }
  }
});

disconnectBtn.addEventListener('click', () => {
  if (game.networkClient) {
    game.networkClient.disconnect();
  }
  
  // Switch back to single-player mode
  isMultiplayerMode = false;
  
  // Reinitialize game in single-player mode
  game = new Game('gameCanvas', { multiplayer: false });
  game.start();
  
  // Update UI
  connectBtn.style.display = 'inline-block';
  disconnectBtn.style.display = 'none';
  serverUrlInput.disabled = false;
  playerNameInput.disabled = false;
  connectionStatus.textContent = 'Disconnected';
  connectionStatus.style.color = '#f00';
  playerCount.textContent = '0';
  
  // Update window reference
  window.game = game;
});

// Override updateConnectionStatus to also update UI
const originalUpdateConnectionStatus = Game.prototype.updateConnectionStatus;
Game.prototype.updateConnectionStatus = function(connected) {
  originalUpdateConnectionStatus.call(this, connected);
  if (connected) {
    if (connectBtn) connectBtn.style.display = 'none';
    if (disconnectBtn) disconnectBtn.style.display = 'inline-block';
    if (connectionStatus) {
      connectionStatus.textContent = 'Connected';
      connectionStatus.style.color = '#0f0';
    }
  } else {
    if (connectionStatus) {
      connectionStatus.textContent = 'Disconnected';
      connectionStatus.style.color = '#f00';
    }
  }
};

// Override updatePlayerCount to also update UI
const originalUpdatePlayerCount = Game.prototype.updatePlayerCount;
Game.prototype.updatePlayerCount = function(count) {
  originalUpdatePlayerCount.call(this, count);
  if (playerCount) playerCount.textContent = count;
};
