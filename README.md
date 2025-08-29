# Chat Survivors WebSocket Server

Servidor WebSocket em tempo real para comunicação entre extensões Twitch e o jogo Chat Survivors.

## ✨ O que faz

- 🚀 **Comunicação instantânea** entre extensões Twitch e jogo
- 🔐 **Autenticação segura** via JWT para extensões
- ⚡ **Rate limiting** para proteção contra abuso
- 📊 **Logging estruturado** para monitoramento
- 🧪 **100% testado** com cobertura completa

## 🛠️ Stack

- **Node.js** 18+ • **WebSocket** • **JWT** • **Vitest**

## ⚡ Quick Start

**Pré-requisitos:** Node.js 18+ e credenciais Twitch

```bash
# Setup
git clone https://github.com/guinr/chat-survivors-websocket-server.git
cd chat-survivors-websocket-server
yarn install

# Configurar .env
cat > .env << EOF
PORT=8080
TWITCH_CLIENT_ID=seu_client_id
TWITCH_CLIENT_SECRET=seu_client_secret
LOG_LEVEL=info
EOF

# Executar
yarn start              # Produção
yarn dev               # Desenvolvimento
yarn test              # Testes
```

## 📡 Conexão

**WebSocket:** `ws://localhost:8080`

**Autenticação:**
- `viewer` / `game` → Acesso público
- `extension` → Token JWT obrigatório

## 📋 Qualidade

**Segurança:** Rate limiting • JWT validation • DDoS protection • Security logging  
**Testes:** 100% coverage • Automated testing • Unit tests  
**Código:** ESM modules • Structured logging • Comprehensive documentation

## 📝 Licença

MIT - veja [LICENSE](LICENSE) para detalhes.

---

**Desenvolvido por [Digi](https://github.com/guinr)**