# Chat Survivors WebSocket Server

WebSocket server that routes messages between Twitch extension clients and the game server.

## Architecture

- **Stateless**: No data persistence or storage
- **Router only**: Forwards messages between extension and game
- **Game is source of truth**: Server never modifies or stores game state

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```
PORT=3000
JWT_SECRET=your-twitch-client-secret
```

- `JWT_SECRET`: Your Twitch extension client secret (found in Twitch Developer Console)

## Running

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

## How It Works

### Extension Client Flow
1. Extension connects to WebSocket server
2. Sends `auth` event with Twitch JWT token
3. Server validates token and responds with `auth_ok` or `auth_error`
4. Extension can now send events: `shop`, `buy`, `play`, `str`, `agi`, `vit`, `luc`, `sell`, `equip`, `report`
5. Server forwards these events to the game (with userId attached)
6. Server routes responses (`shop_display`, `status`) back to the correct extension client

### Game Server Flow
1. Game connects to WebSocket server
2. Sends `game_auth` event
3. Server stores game connection (no validation for local development)
4. Game receives events from extension clients (with userId)
5. Game sends response events with userId
6. Server routes responses to the correct extension client

## Event Contract

All events follow the contract defined in `events.csv`:

- **auth** (extension → server): Authenticate user
- **auth_ok/auth_error** (server → extension): Auth response
- **shop, buy, play, report** (extension → game): Player actions
- **str, agi, vit, luc** (extension → game): Stat increases
- **sell, equip** (extension → game): Inventory actions
- **shop_display, status** (game → extension): State snapshots
