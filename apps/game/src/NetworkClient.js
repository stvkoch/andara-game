/**
 * NetworkClient - Handles WebSocket connection and communication with game server
 */
export class NetworkClient {
  constructor(game, serverUrl = 'ws://localhost:3001') {
    this.game = game;
    this.serverUrl = serverUrl;
    this.ws = null;
    this.connected = false;
    this.connecting = false;
    this.playerId = null;
    this.roomId = null;
    this.playerName = 'Player';
    
    // Input throttling
    this.lastInputSend = 0;
    this.inputThrottleMs = 33; // ~30fps for input updates
    
    // Callbacks
    this.onConnected = null;
    this.onDisconnected = null;
    this.onGameState = null;
    this.onStateSnapshot = null;
    this.onAction = null;
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onError = null;
    
    // Position update throttling (removed - now only sends on change)
    
    // Reconnection
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this.reconnectTimer = null;
  }

  /**
   * Connect to the server
   */
  connect(playerName = 'Player', roomId = null) {
    if (this.connecting || this.connected) {
      console.warn('Already connected or connecting');
      return;
    }

    this.connecting = true;
    this.playerName = playerName;
    
    try {
      this.ws = new WebSocket(this.serverUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.connecting = false;
        this.connected = true;
        this.reconnectAttempts = 0;
        
        // Join room
        this.joinRoom(roomId);
        
        if (this.onConnected) {
          this.onConnected();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing server message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.handleDisconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.connecting = false;
        if (this.onError) {
          this.onError('Connection error');
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.connecting = false;
      if (this.onError) {
        this.onError('Failed to connect');
      }
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connected = false;
    this.connecting = false;
    this.playerId = null;
    this.roomId = null;
  }

  /**
   * Join a game room
   */
  joinRoom(roomId = null) {
    if (!this.connected || !this.ws) return;

    this.send({
      type: 'join',
      payload: {
        roomId: roomId,
        playerName: this.playerName
      }
    });
  }

  /**
   * Send player state update to server (replaces sendInput)
   */
  sendStateUpdate(state) {
    if (!this.connected || !this.ws) return;

    // Throttle continuous updates
    const now = Date.now();
    if ((now - this.lastInputSend) < this.inputThrottleMs) {
      return;
    }

    this.lastInputSend = now;

    this.send({
      type: 'playerStateUpdate',
      payload: state
    });
  }
  
  /**
   * Send player input to server (deprecated - use sendStateUpdate)
   * Kept for backward compatibility
   */
  sendInput(input) {
    // Convert input to state update format
    this.sendStateUpdate({
      controlMode: input.controlMode,
      engineAngle: input.engineAngle,
      enginePower: input.enginePower,
      weaponAngle: input.weaponAngle,
      weaponPower: input.weaponPower,
      shieldAngle: input.shieldAngle,
      shieldPower: input.shieldPower,
      shieldEnergized: input.shieldEnergized || false
    });
  }

  /**
   * Send ping to server
   */
  ping() {
    if (!this.connected || !this.ws) return;
    this.send({ type: 'ping' });
  }

  /**
   * Send message to server
   */
  send(data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      this.ws.send(JSON.stringify(data));
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }


  /**
   * Handle incoming server messages
   */
  handleMessage(data) {
    switch (data.type) {
      case 'connected':
        console.log('Server:', data.message);
        break;

      case 'joined':
        this.playerId = data.playerId;
        this.roomId = data.roomId;
        console.log(`Joined room ${this.roomId} as player ${this.playerId}`);
        
        if (this.onGameState && data.gameState) {
          this.onGameState(data.gameState);
        }
        break;

      case 'gameState':
        // Legacy support - convert to stateSnapshot
        if (this.onStateSnapshot) {
          this.onStateSnapshot(data.gameState, data.timestamp);
        }
        break;

      case 'stateSnapshot':
        console.log(`[CLIENT] Received stateSnapshot message: ${data.players?.length || 0} players`);
        if (this.onStateSnapshot) {
          this.onStateSnapshot(data, data.timestamp);
        }
        break;

      case 'playerStateUpdate':
        console.log(`[CLIENT] Received state update from player ${data.playerId?.substring(0, 8) || 'unknown'}`);
        if (this.onPlayerStateUpdate) {
          this.onPlayerStateUpdate(data.playerId, data.state);
        }
        break;

      case 'action':
        // Legacy support - convert to state update
        console.log(`[CLIENT] Received action message: ${data.action?.type} from player ${data.action?.playerId?.substring(0, 8) || 'unknown'}`);
        if (this.onAction) {
          this.onAction(data.action);
        }
        break;

      case 'playerJoined':
        console.log(`Player joined: ${data.playerName} (${data.playerId})`);
        if (this.onPlayerJoined) {
          this.onPlayerJoined(data.playerId, data.playerName, data.playerCount);
        }
        break;

      case 'playerLeft':
        console.log(`Player left: ${data.playerId}`);
        if (this.onPlayerLeft) {
          this.onPlayerLeft(data.playerId, data.playerCount);
        }
        break;

      case 'error':
        console.error('Server error:', data.message);
        if (this.onError) {
          this.onError(data.message);
        }
        break;

      case 'pong':
        // Ping response, connection is alive
        break;

      default:
        console.warn('Unknown message type:', data.type);
    }
  }

  /**
   * Handle disconnect and attempt reconnection
   */
  handleDisconnect() {
    const wasConnected = this.connected;
    this.connected = false;
    this.connecting = false;
    this.ws = null;

    if (wasConnected && this.onDisconnected) {
      this.onDisconnected();
    }

    // Attempt reconnection if we were connected
    if (wasConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      this.reconnectTimer = setTimeout(() => {
        this.connect(this.playerName, this.roomId);
      }, this.reconnectDelay);
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      if (this.onError) {
        this.onError('Connection lost. Please reconnect manually.');
      }
    }
  }

  /**
   * Get connection status
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get player ID
   */
  getPlayerId() {
    return this.playerId;
  }

  /**
   * Get room ID
   */
  getRoomId() {
    return this.roomId;
  }

  /**
   * Send player state update (position, velocity, energy)
   * Called only when state has changed (check done in Game.js)
   */
  sendPlayerState(position, velocity, energy) {
    if (!this.connected || !this.ws) return;

    const stateData = {
      type: 'playerState',
      payload: {
        position: { x: position.x, y: position.y },
        velocity: { x: velocity.x, y: velocity.y },
        energy: energy
      }
    };
    
    console.log(`[CLIENT] Sending player state to server:`, {
      position: `(${position.x.toFixed(1)}, ${position.y.toFixed(1)})`,
      velocity: `(${velocity.x.toFixed(2)}, ${velocity.y.toFixed(2)})`,
      energy: energy.toFixed(1)
    });
    
    this.send(stateData);
  }
}

