# chat-survivors-websocket-server

Servidor WebSocket para chat de sobreviventes em tempo real, integrando extensões Twitch e jogo. Permite comunicação bidirecional entre clientes (extensões, jogo) e servidor, com autenticação JWT, rate limiting, cache de nomes de usuário e logging estruturado.

## Funcionalidades

- Comunicação WebSocket entre extensões Twitch, jogo e servidor
- Autenticação JWT para roles sensíveis (admin, extension)
- Rate limiting por usuário para evitar abuso/DDoS
- Cache de display_name de usuários Twitch
- Heartbeat para detecção e encerramento de conexões mortas
- Logging estruturado com pino/pino-pretty
- Testes unitários com 100% de cobertura usando Vitest

## Estrutura de Pastas

```
src/
  core/
    config.js         # Configurações do servidor e credenciais Twitch
    logger.js         # Logger estruturado
    userCache.js      # Cache de display_name dos usuários
  handlers/
    onJoin.js         # Manipulador do evento 'join'
  middlewares/
    auth.js           # Middleware de autenticação JWT
    rateLimit.js      # Middleware de rate limiting por usuário
  server/
    connectionManager.js # Gerencia conexões (game, extensões)
    eventRouter.js       # Roteia mensagens recebidas
    heartbeat.js         # Heartbeat para conexões vivas
    messageBus.js        # Envio/broadcast de mensagens
    wsServer.js          # Inicialização do WebSocketServer
index.js             # Entry point do servidor
tests/unit/          # Testes unitários espelhando src/
```

## Requisitos

- Node.js >= 18
- Twitch Client ID e Secret configurados em variáveis de ambiente

## Instalação

```sh
yarn install
```

## Configuração

Crie um arquivo `.env` com as variáveis:

```
PORT=8080
TWITCH_CLIENT_ID=seu_client_id
TWITCH_CLIENT_SECRET=seu_client_secret
LOG_LEVEL=info
```

## Uso

### Iniciar servidor

```sh
yarn start
```

### Desenvolvimento com hot reload

```sh
yarn dev
```

### Testes

```sh
yarn test
```

### Cobertura de testes

```sh
yarn test:coverage
```

## Endpoints WebSocket

- Extensões e jogo conectam via WebSocket na porta configurada (`ws://localhost:PORT`)
- Mensagens aceitas:
  - `join`: Usuário entra no chat (requer `userId`)
- Autenticação:
  - Roles `game` e `viewer` não exigem token
  - Roles `admin`, `moderator`, `extension` exigem JWT válido (verificado via `auth.js`)

## Segurança

- Rate limiting por usuário (configurável)
- Autenticação JWT para roles sensíveis
- Validação de entrada e logging de erros

## Testes

- Cobertura 100% garantida por Vitest
- Testes unitários para todos módulos em `tests/unit/`

## Licença

MIT

---

Desenvolvido por Digi.