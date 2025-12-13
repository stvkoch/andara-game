# Andara Game Server

Multiplayer WebSocket server for the Andara Game.

## Features

- Real-time multiplayer game synchronization
- WebSocket-based communication
- Room-based game sessions
- Server-side game state management
- Physics simulation
- Collision detection

## Getting Started

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

### Production

```bash
pnpm start
```

## Configuration

- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment (development/production)

## API

### WebSocket Messages

#### Client → Server

**Join Room**
```json
{
  "type": "join",
  "payload": {
    "roomId": "optional-room-id",
    "playerName": "Player Name"
  }
}
```

**Player Input**
```json
{
  "type": "playerInput",
  "payload": {
    "controlMode": "ENGINE" | "WEAPON" | "SHIELD",
    "engineAngle": 0.0,
    "enginePower": 50,
    "weaponAngle": 0.0,
    "weaponPower": 50,
    "shieldAngle": 0.0,
    "shieldPower": 50,
    "shouldLaunch": false,
    "shouldFire": false,
    "shieldEnergized": false
  }
}
```

**Ping**
```json
{
  "type": "ping"
}
```

#### Server → Client

**Connected**
```json
{
  "type": "connected",
  "message": "Connected to Andara Game Server"
}
```

**Joined**
```json
{
  "type": "joined",
  "roomId": "room-id",
  "playerId": "player-id",
  "gameState": { ... }
}
```

**Game State Update**
```json
{
  "type": "gameState",
  "gameState": {
    "ships": [...],
    "lasers": [...],
    "obstacles": [...],
    "stars": [...],
    "width": 1920,
    "height": 1080
  },
  "timestamp": 1234567890
}
```

**Player Joined**
```json
{
  "type": "playerJoined",
  "playerId": "player-id",
  "playerName": "Player Name",
  "playerCount": 2
}
```

**Player Left**
```json
{
  "type": "playerLeft",
  "playerId": "player-id",
  "playerCount": 1
}
```

**Error**
```json
{
  "type": "error",
  "message": "Error message"
}
```

## Architecture

- **GameServer**: Manages rooms and player connections
- **GameRoom**: Handles game state and simulation for a room
- WebSocket server handles real-time communication
- Server-side authoritative game state

