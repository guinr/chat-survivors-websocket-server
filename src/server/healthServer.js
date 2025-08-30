import http from 'http';
import { connectionManager } from './connectionManager.js';

export function createHealthServer({ port, logger }) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    if (url.pathname === '/health' && req.method === 'GET') {
      const connections = connectionManager.getActiveConnections();
      const status = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        connections: connections.length,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
      };
      
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(status, null, 2));
      
      logger.debug(status, 'Health check solicitado');
      return;
    }
    
    if (url.pathname === '/' && req.method === 'GET') {
      const welcomeMessage = {
        service: 'Chat Survivors WebSocket Server',
        status: 'running',
        websocket: `ws://${req.headers.host}`,
        health: `http://${req.headers.host}/health`,
        docs: 'https://github.com/guinr/chat-survivors-websocket-server'
      };
      
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(welcomeMessage, null, 2));
      return;
    }
    
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  return server;
}
