/**
 * Example WebSocket client for connecting to the Andara Game Server
 * This is a reference implementation for integrating with the game client
 */

// Example usage in browser:
/*
const ws = new WebSocket('ws://localhost:3001');

ws.onopen = () => {
  console.log('Connected to server');
  
  // Join a room
  ws.send(JSON.stringify({
    type: 'join',
    payload: {
      playerName: 'MyPlayer'
    }
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'connected':
      console.log('Server:', data.message);
      break;
    
    case 'joined':
      console.log('Joined room:', data.roomId);
      console.log('Player ID:', data.playerId);
      console.log('Initial game state:', data.gameState);
      break;
    
    case 'gameState':
      // Update game with new state
      updateGame(data.gameState);
      break;
    
    case 'playerJoined':
      console.log('Player joined:', data.playerName);
      break;
    
    case 'playerLeft':
      console.log('Player left:', data.playerId);
      break;
    
    case 'error':
      console.error('Server error:', data.message);
      break;
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from server');
};

// Send player input
function sendPlayerInput(input) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'playerInput',
      payload: {
        controlMode: input.controlMode || 'ENGINE',
        engineAngle: input.engineAngle || 0,
        enginePower: input.enginePower || 50,
        weaponAngle: input.weaponAngle || 0,
        weaponPower: input.weaponPower || 50,
        shieldAngle: input.shieldAngle || 0,
        shieldPower: input.shieldPower || 50,
        shouldLaunch: input.shouldLaunch || false,
        shouldFire: input.shouldFire || false,
        shieldEnergized: input.shieldEnergized || false
      }
    }));
  }
}

// Example: Send input every frame
function gameLoop() {
  // Get input from your game's input system
  const input = {
    controlMode: 'ENGINE',
    engineAngle: Math.PI / 4,
    enginePower: 75,
    weaponAngle: Math.PI / 2,
    weaponPower: 50,
    shieldAngle: 0,
    shieldPower: 50,
    shouldLaunch: false,
    shouldFire: false,
    shieldEnergized: false
  };
  
  sendPlayerInput(input);
  requestAnimationFrame(gameLoop);
}
*/

export const clientExample = {
  connect: (url = 'ws://localhost:3001') => {
    const ws = new WebSocket(url);
    return ws;
  },
  
  joinRoom: (ws, playerName, roomId = null) => {
    ws.send(JSON.stringify({
      type: 'join',
      payload: {
        playerName,
        roomId
      }
    }));
  },
  
  sendInput: (ws, input) => {
    ws.send(JSON.stringify({
      type: 'playerInput',
      payload: input
    }));
  }
};

