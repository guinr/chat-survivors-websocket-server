import WebSocket from 'ws';
import jwt from 'jsonwebtoken';

const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || 'test-secret-key';

class ExtensionSimulator {
  constructor(userId, displayName, clientSecret) {
    this.userId = userId;
    this.displayName = displayName;
    this.clientSecret = clientSecret;
    this.ws = null;
    this.isConnected = false;
    this.token = this.generateToken();
  }

  generateToken() {
    return jwt.sign(
      { 
        sub: this.userId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      },
      this.clientSecret
    );
  }

  connect() {
    console.log(`🔧 Conectando extensão para ${this.displayName} (${this.userId})...`);
    
    this.ws = new WebSocket('ws://localhost:8080');
    
    this.ws.on('open', () => {
      console.log(`✅ Extensão ${this.displayName} conectada!`);
      this.isConnected = true;
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`📨 ${this.displayName} recebeu:`, message);
      } catch (err) {
        console.error(`❌ Erro ao processar mensagem para ${this.displayName}:`, err);
      }
    });

    this.ws.on('close', () => {
      console.log(`🔌 Extensão ${this.displayName} desconectada`);
      this.isConnected = false;
    });

    this.ws.on('error', (err) => {
      console.error(`💥 Erro na extensão ${this.displayName}:`, err);
    });
  }

  simulateUserActions() {
    const actions = [
      () => this.sendAction('str', { points: 1 }),
      () => this.sendAction('agi', { points: 2 }),
      () => this.sendAction('vit', { points: 1 }),
      () => this.sendAction('luc', { points: 3 }),
      () => this.sendAction('buy', { item: 'Potion', quantity: 1 }),
      () => this.sendAction('sell', { item: 'Old Sword', quantity: 1 }),
      () => this.sendAction('equip', { item: 'Magic Ring', slot: 'ring' })
    ];

    const scheduleNextAction = () => {
      setTimeout(() => {
        if (this.isConnected) {
          const randomAction = actions[Math.floor(Math.random() * actions.length)];
          randomAction();
          scheduleNextAction();
        }
      }, Math.random() * 5000 + 3000);
    };

    scheduleNextAction();
  }

  sendAction(action, data = null) {
    if (!this.isConnected) return;
    
    const message = {
      role: 'extension',
      token: this.token,
      userId: this.userId,
      displayName: this.displayName,
      action,
      data
    };
    
    console.log(`📤 ${this.displayName} enviando:`, { action, data });
    this.send(message);
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

const extensions = [
  new ExtensionSimulator('user123', 'StreamerPro', CLIENT_SECRET),
  new ExtensionSimulator('user456', 'GamerGirl88', CLIENT_SECRET),
  new ExtensionSimulator('user789', 'NoobSlayer', CLIENT_SECRET)
];

extensions.forEach((ext, index) => {
  setTimeout(() => {
    ext.connect();
    
    setTimeout(() => {
      ext.simulateUserActions();
    }, 2000);
  }, index * 1000);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando simuladores de extensão...');
  extensions.forEach(ext => ext.disconnect());
  process.exit(0);
});
