import WebSocket from 'ws';

class ViewerSimulator {
  constructor(userId, displayName) {
    this.userId = userId;
    this.displayName = displayName;
    this.ws = null;
    this.isConnected = false;
  }

  connect() {
    console.log(`👥 Conectando viewer ${this.displayName}...`);
    
    this.ws = new WebSocket('ws://localhost:8080');
    
    this.ws.on('open', () => {
      console.log(`✅ Viewer ${this.displayName} conectado!`);
      this.isConnected = true;
      
      setTimeout(() => {
        this.joinGame();
      }, 1000);
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
      console.log(`🔌 Viewer ${this.displayName} desconectado`);
      this.isConnected = false;
    });

    this.ws.on('error', (err) => {
      console.error(`💥 Erro no viewer ${this.displayName}:`, err);
    });
  }

  joinGame() {
    if (!this.isConnected) return;
    
    const message = {
      role: 'viewer',
      userId: this.userId,
      action: 'join'
    };
    
    console.log(`📤 ${this.displayName} fazendo join...`);
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

const viewers = [
  new ViewerSimulator('viewer001', 'ChatLurker'),
  new ViewerSimulator('viewer002', 'MemeLord420'),
  new ViewerSimulator('viewer003', 'FirstTimeViewer'),
  new ViewerSimulator('viewer004', 'RegularFan'),
  new ViewerSimulator('viewer005', 'SubFollower')
];

viewers.forEach((viewer, index) => {
  setTimeout(() => {
    viewer.connect();
  }, index * 2000);
});

setInterval(() => {
  const randomNames = ['NewViewer', 'RandomGuy', 'JustArrived', 'CuriousWatcher'];
  const randomName = randomNames[Math.floor(Math.random() * randomNames.length)] + Math.floor(Math.random() * 1000);
  const randomId = 'viewer' + Math.floor(Math.random() * 10000);
  
  const newViewer = new ViewerSimulator(randomId, randomName);
  newViewer.connect();
  
  setTimeout(() => {
    newViewer.disconnect();
  }, Math.random() * 30000 + 30000);
}, 15000);

process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando simuladores de viewers...');
  viewers.forEach(viewer => viewer.disconnect());
  process.exit(0);
});
