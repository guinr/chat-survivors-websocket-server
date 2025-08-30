import WebSocket from 'ws';

class GameSimulator {
  constructor() {
    this.ws = null;
    this.isConnected = false;
  }

  connect() {
    console.log('🎮 Conectando simulador do jogo...');
    
    this.ws = new WebSocket('ws://localhost:8080');
    
    this.ws.on('open', () => {
      console.log('✅ Jogo conectado!');
      this.isConnected = true;
      
      this.send({
        role: 'game',
        action: 'ready',
        data: { version: '1.0.0' }
      });
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📨 Jogo recebeu:', message);
        
        this.handleGameAction(message);
      } catch (err) {
        console.error('❌ Erro ao processar mensagem:', err);
      }
    });

    this.ws.on('close', () => {
      console.log('🔌 Jogo desconectado');
      this.isConnected = false;
    });

    this.ws.on('error', (err) => {
      console.error('💥 Erro no jogo:', err);
    });
  }

  handleGameAction(message) {
    const { userId, displayName, action } = message;
    
    setTimeout(() => {
      switch (action) {
        case 'str':
          this.sendGameResponse(userId, displayName, 'status_increased', {
            stat: 'strength',
            value: Math.floor(Math.random() * 10) + 1,
            newTotal: Math.floor(Math.random() * 100) + 10
          });
          break;
          
        case 'agi':
          this.sendGameResponse(userId, displayName, 'status_increased', {
            stat: 'agility', 
            value: Math.floor(Math.random() * 10) + 1,
            newTotal: Math.floor(Math.random() * 100) + 10
          });
          break;
          
        case 'buy':
          const success = Math.random() > 0.3;
          if (success) {
            this.sendGameResponse(userId, displayName, 'buyed', {
              item: 'Sword',
              cost: 50,
              newGold: Math.floor(Math.random() * 500)
            });
          } else {
            this.sendGameResponse(userId, displayName, 'cant_join', {
              reason: 'Insufficient gold'
            });
          }
          break;
          
        case 'equip':
          this.sendGameResponse(userId, displayName, 'equipped', {
            item: 'Magic Sword',
            slot: 'weapon',
            stats: { attack: 25 }
          });
          break;
          
        default:
          console.log(`🤷 Ação desconhecida: ${action}`);
      }
    }, Math.random() * 1000 + 500);
  }

  sendGameResponse(userId, displayName, action, data) {
    if (!this.isConnected) return;
    
    const response = {
      user: { id: userId, display_name: displayName },
      action,
      data
    };
    
    console.log('📤 Jogo enviando resposta:', response);
    this.send(response);
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  startRandomEvents() {
    setInterval(() => {
      if (!this.isConnected) return;
      
      const events = [
        () => this.sendGameResponse('user123', 'RandomPlayer', 'level_up', {
          level: Math.floor(Math.random() * 50) + 1,
          exp: Math.floor(Math.random() * 10000)
        }),
        () => this.sendGameResponse('user456', 'AnotherPlayer', 'died', {
          killer: 'Goblin',
          location: 'Dark Forest'
        }),
        () => this.sendGameResponse('user789', 'TestUser', 'health_changed', {
          health: Math.floor(Math.random() * 100),
          maxHealth: 100
        })
      ];
      
      const randomEvent = events[Math.floor(Math.random() * events.length)];
      randomEvent();
    }, 5000);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

const game = new GameSimulator();
game.connect();

setTimeout(() => {
  game.startRandomEvents();
}, 3000);

process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando simulador do jogo...');
  game.disconnect();
  process.exit(0);
});
