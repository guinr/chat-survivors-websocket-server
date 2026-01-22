const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const http = require('http');

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET;

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
    console.error('Auth failed: JWT_SECRET not configured in environment variables!');
    ws.send(JSON.stringify({ event: 'auth_error', reason: 'server_error' }));
    return;
  }

  // Verify and validate JWT token
  try {
    console.log('Attempting to verify JWT token...');
    const decoded = jwt.verify(token, JWT_SECRET);
    
    console.log('JWT signature valid. Decoded token:', JSON.stringify(decoded, null, 2));
    
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
      console.log('Auth failed: user_id not found in token. Token contents:', JSON.stringify(decoded, null, 2));
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
    console.error('JWT validation error:', error.name);
    console.error('   Error message:', error.message);
    
    // Provide more specific error messages
    if (error.name === 'JsonWebTokenError') {
      console.error('   Token format is invalid or signature doesn\'t match');
    } else if (error.name === 'TokenExpiredError') {
      console.error('   Token has expired');
    } else if (error.name === 'NotBeforeError') {
      console.error('   Token not active yet');
    }
    
    ws.send(JSON.stringify({ 
      event: 'auth_error', 
      reason: 'invalid_token',
      details: error.message 
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
