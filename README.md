# Andara Game Monorepo

This is a pnpm workspace monorepo for the Andara Game project.

## Structure

```
andara-game/
├── apps/
│   ├── game/      # Game client application
│   └── server/    # Multiplayer WebSocket server
├── packages/      # Shared packages
└── package.json   # Root package.json
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Installation

```bash
pnpm install
```

### Available Scripts

- `pnpm dev` - Run dev mode for all apps (game client and server)
- `pnpm build` - Build all packages and apps
- `pnpm test` - Run tests for all packages
- `pnpm lint` - Lint all packages
- `pnpm clean` - Clean build artifacts

### Running Individual Apps

```bash
# Run game client only
pnpm --filter @andara-game/game dev

# Run server only
pnpm --filter @andara-game/server dev
```

### Adding a New Package

1. Create a new directory in `packages/` or `apps/`
2. Add a `package.json` file
3. Run `pnpm install` to link dependencies

### Running Commands in Specific Packages

```bash
# Run command in a specific package
pnpm --filter <package-name> <command>

# Example: run dev in a specific app
pnpm --filter my-app dev
```

