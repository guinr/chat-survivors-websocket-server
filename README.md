# Chat Survivors WebSocket Server

Servidor WebSocket em tempo real para comunicação entre extensões Twitch e o jogo Chat Survivors.

## ✨ O que faz

- 🚀 **Comunicação instantânea** entre extensões Twitch e jogo
- 🔐 **Autenticação segura** via JWT para extensões
- ⚡ **Rate limiting** para proteção contra abuso
- 📊 **Logging estruturado** para monitoramento
- 🧪 **100% testado** com cobertura completa
- 🏥 **Health check** endpoint para monitoramento

## 🛠️ Stack

- **Node.js** 20+ • **WebSocket** • **JWT** • **Vitest**

## ⚡ Quick Start

**Pré-requisitos:** Node.js 20+ e credenciais Twitch

```bash
# Setup
git clone https://github.com/guinr/chat-survivors-websocket-server.git
cd chat-survivors-websocket-server
yarn install

# Configurar .env (copie de .env.example)
cp .env.example .env
# Edite .env com suas credenciais Twitch

# Executar
yarn start              # Produção
yarn dev               # Desenvolvimento
yarn test              # Testes
```

## 📡 Conexão

**WebSocket:** `ws://localhost:8080`  
**Health Check:** `http://localhost:8080/health`  
**API Info:** `http://localhost:8080/`

**Autenticação:**
- `viewer` / `game` → Acesso público
- `extension` → Token JWT obrigatório

## 🚀 Deploy no Render

### Configuração rápida:

1. **Fork** este repositório
2. **Conecte** no [Render Dashboard](https://dashboard.render.com)
3. **Crie** novo Web Service
4. **Configure**:
   - **Build Command**: `yarn install`
   - **Start Command**: `yarn start`
   - **Health Check Path**: `/health`

### Variáveis de ambiente obrigatórias:

```bash
TWITCH_CLIENT_ID=seu_client_id_aqui
TWITCH_CLIENT_SECRET=seu_client_secret_aqui
NODE_ENV=production
LOG_LEVEL=info
```

### URLs após deploy:
- **WebSocket**: `wss://your-app.onrender.com`
- **Health Check**: `https://your-app.onrender.com/health`
- **API Info**: `https://your-app.onrender.com/`

## 📋 Qualidade

**Segurança:** Rate limiting • JWT validation • DDoS protection • Security logging  
**Testes:** 100% coverage • Automated testing • Unit tests  
**Código:** ESM modules • Structured logging • Comprehensive documentation

## 📝 Licença

MIT - veja [LICENSE](LICENSE) para detalhes.

---

**Desenvolvido por [Digi](https://github.com/guinr)**