const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const http = require('http');

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET ? Buffer.from(process.env.JWT_SECRET, 'base64') : null;

// Lets an external watchdog (see chat-survivors' ~/stream-test/watchdog.py)
// force this process to restart without needing dashboard access - Render
// restarts a web service automatically whenever its process exits, same as
// clicking "Restart service" in the dashboard. Added 2026-09-25: the game's
// connection to this server was observed going stale (gameConnection stuck
// while the underlying socket still looked alive) with no in-process way to
// detect/self-heal it server-side, and dashboard actions require a person
// present. Query-param secret, not a real auth scheme - this only needs to
// stop a stranger who finds the URL from being able to bounce the service,
// not resist a determined attacker. Must be set via the ADMIN_RESTART_SECRET
// env var in Render's dashboard (Environment tab) - deliberately no
// hardcoded fallback here, this file is public-ish source, not a secret
// store. The endpoint refuses all requests until it's set.
const ADMIN_RESTART_SECRET = process.env.ADMIN_RESTART_SECRET || null;

// ============================================================================
// CONNECTION STORAGE
// ============================================================================

// Map: userId (real Twitch user_id) -> WebSocket connection (extension clients)
const extensionClients = new Map();

// Reference to the game server connection (single connection)
let gameConnection = null;

// ============================================================================
// HTTP SERVER (for health check)
// ============================================================================

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/admin/restart') && req.method === 'GET') {
    const providedSecret = new URL(req.url, `http://${req.headers.host}`).searchParams.get('secret');
    if (!ADMIN_RESTART_SECRET || providedSecret !== ADMIN_RESTART_SECRET) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
    console.log('Restart requested via /admin/restart - exiting so the platform restarts this process.');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Restarting...');
    // Let the response actually flush to the socket before exiting.
    setTimeout(() => process.exit(0), 200);
    return;
  }

  if (req.url === '/health' && req.method === 'GET') {
    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      websocket: {
        port: PORT,
        running: wss.clients.size !== undefined,
        connectedClients: wss.clients.size,
        extensionClients: extensionClients.size,
        gameServerConnected: gameConnection !== null && gameConnection.readyState === WebSocket.OPEN
      }
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(healthStatus, null, 2));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// ============================================================================
// WEBSOCKET SERVER
// ============================================================================

const wss = new WebSocket.Server({ server });

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

wss.on('connection', (ws) => {
  console.log('New connection established');

  // Track authentication status
  ws.isAuthenticated = false;
  ws.userId = null;
  ws.isGame = false;

  // Render's edge proxy was silently dropping idle connections (~10s after
  // auth, seen in production logs) without the client ever seeing a close
  // frame - the client-side heartbeat (Godot's heartbeat_interval) sends
  // pings server-ward, but that alone wasn't enough, so the server now also
  // pings each client periodically. WS ping/pong is handled automatically
  // by both Godot's WebSocketPeer and browsers' native WebSocket, no
  // client-side changes needed. Also doubles as dead-connection cleanup
  // (a client that never pongs back gets terminated).
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (error) {
      console.error('Failed to parse message:', error);
      ws.send(JSON.stringify({ event: 'error', reason: 'invalid_json' }));
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    if (ws.isGame) {
      console.log('Game server disconnected');
      gameConnection = null;
    } else if (ws.userId) {
      console.log(`Extension client disconnected: ${ws.userId}`);
      extensionClients.delete(ws.userId);
    }
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Protocol-level ws.ping()/pong() alone wasn't enough to survive Render's
// edge proxy (production logs kept showing the game connection dying
// ~15-17s after auth, right around one heartbeat interval, with none of
// this file's own "Terminating dead connection" log ever printing - so it
// wasn't even this code closing it, the proxy was) - some edge proxies only
// count actual data frames as "activity" for their idle timeout, not
// protocol-level ping/pong control frames. Belt and suspenders: keep the
// native ping/pong for real dead-connection detection, but also push a
// real text frame every interval. "status_broadcast" is already a
// recognized no-op event in websocket_client.gd's _on_message_received
// (and safely ignored by anything else), so no client-side changes needed.
const HEARTBEAT_INTERVAL_MS = 15000;
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('Terminating dead connection (no pong received)');
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'status_broadcast' }));
    }
  });
}, HEARTBEAT_INTERVAL_MS);

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

function handleMessage(ws, data) {
  const { event } = data;

  // Special case: Game server authentication
  if (event === 'game_auth') {
    handleGameAuth(ws, data);
    return;
  }

  // Handle authentication for extension clients
  if (event === 'auth') {
    handleAuth(ws, data);
    return;
  }

  // All other events require authentication
  if (!ws.isAuthenticated) {
    ws.send(JSON.stringify({ event: 'auth_error', reason: 'not_authenticated' }));
    return;
  }

  // Route events based on sender
  if (ws.isGame) {
    // Events from game -> route to extension client
    routeToExtension(data);
  } else {
    // Events from extension -> route to game
    routeToGame(ws, data);
  }
}

// ============================================================================
// AUTHENTICATION HANDLERS
// ============================================================================

function handleGameAuth(ws, data) {
  // Local game server authentication (no validation needed for local development)
  ws.isGame = true;
  ws.isAuthenticated = true;
  gameConnection = ws;
  console.log('Game server authenticated');
}

function handleAuth(ws, data) {
  const { token, userId } = data;

  // Check if token is present
  if (!token) {
    console.log('Auth failed: Token is missing');
    ws.send(JSON.stringify({ event: 'auth_error', reason: 'missing_token' }));
    return;
  }

  // Check if JWT_SECRET is configured
  if (!JWT_SECRET) {
    console.error('Auth failed: JWT_SECRET not configured');
    ws.send(JSON.stringify({ event: 'auth_error', reason: 'server_error' }));
    return;
  }

  // Verify and validate JWT token
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (!decoded) {
      console.log('Auth failed: Token decoded to null/undefined');
      ws.send(JSON.stringify({ event: 'auth_error', reason: 'invalid_token' }));
      return;
    }

    // Validate token expiration
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      console.log(`Auth failed: Token expired (exp: ${decoded.exp}, now: ${Math.floor(Date.now() / 1000)})`);
      ws.send(JSON.stringify({ event: 'auth_error', reason: 'token_expired' }));
      return;
    }

    // Extract user_id from token (only authenticated Twitch users have this)
    const realUserId = decoded.user_id;

    if (!realUserId) {
      console.log('Auth failed: user_id not found in token');
      ws.send(JSON.stringify({ event: 'auth_error', reason: 'user_not_shared' }));
      return;
    }

    // Associate connection with userId
    ws.userId = realUserId;
    ws.isAuthenticated = true;

    // Store connection in map
    extensionClients.set(realUserId, ws);

    console.log(`Extension client authenticated: ${realUserId}`);

    // Send success response
    ws.send(JSON.stringify({ event: 'auth_ok' }));

  } catch (error) {
    console.error('JWT validation error:', error.name, '-', error.message);
    ws.send(JSON.stringify({ 
      event: 'auth_error', 
      reason: 'invalid_token'
    }));
  }
}

// ============================================================================
// ROUTING FUNCTIONS
// ============================================================================

function routeToGame(ws, data) {
  // Forward event from extension to game server
  if (!gameConnection || gameConnection.readyState !== WebSocket.OPEN) {
    console.log('Game server not connected, cannot route event');
    return;
  }

  // Add userId to the payload so game knows who sent it
  const payload = {
    ...data,
    userId: ws.userId
  };

  console.log(`Routing to game: ${data.event} from ${ws.userId}`);
  gameConnection.send(JSON.stringify(payload));
}

function routeToExtension(data) {
  // Route event from game to the appropriate extension client
  const { userId, event } = data;

  if (!userId) {
    console.error('Game sent event without userId:', event);
    return;
  }

  const client = extensionClients.get(userId);

  if (!client || client.readyState !== WebSocket.OPEN) {
    console.log(`Extension client not connected: ${userId}`);
    return;
  }

  // Remove userId from payload before sending to extension
  const { userId: _, ...payload } = data;

  console.log(`Routing to extension: ${event} to ${userId}`);
  client.send(JSON.stringify(payload));
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});
