# Instruções Personalizadas do Repositório

## Visão Geral do Projeto

Este projeto é um servidor WebSocket para um chat de sobreviventes em tempo real. Ele é construído com Node.js e WebSocket para comunicação bidirecional entre cliente e servidor, permitindo que usuários se conectem, enviem mensagens e recebam atualizações em tempo real.

## Estrutura de Pastas

- `/src`: Contém o código-fonte principal do servidor
  - `/core`: Configurações e utilitários centrais (config.js, logger.js)
  - `/server`: Componentes do servidor WebSocket (wsServer.js, connectionManager.js, eventRouter.js, heartbeat.js, messageBus.js)
  - `/handlers`: Manipuladores de eventos específicos (onJoin.js)
  - `/middlewares`: Middlewares de autenticação e rate limiting (auth.js, rateLimit.js)
- `/tests/unit`: Testes unitários espelhando a estrutura do src
- `/coverage`: Relatórios de cobertura de testes gerados pelo Vitest

## Padrões de Codificação e Convenções

- Use ponto e vírgula no final de cada statement
- Use aspas simples para strings
- Use camelCase para variáveis e funções
- Use PascalCase para classes e construtores
- Use arrow functions para callbacks quando apropriado
- Prefira `const` e `let` ao invés de `var`
- Não adicione comentários no código - o código deve ser auto-explicativo
- Mantenha funções pequenas e com responsabilidade única
- Não usar classes do ES6

## Ferramentas e Frameworks

- **Node.js**: Runtime JavaScript para o servidor
- **WebSocket (ws)**: Biblioteca para comunicação WebSocket
- **Vitest**: Framework de testes unitários
- **ESM**: Módulos ES6 (import/export)

## Padrões de Testes

- Cada módulo deve ter testes unitários correspondentes
- Use mocks para dependências externas
- Mantenha 100% de cobertura de código (statements, branches, functions, lines)
- Testes devem estar em `/tests/unit` espelhando a estrutura de `/src`
- Use `describe` e `it` para organizar testes de forma hierárquica
- Sempre limpe mocks e timers após cada teste com `afterEach`

## Padrões de Arquitetura

- Use EventEmitter para comunicação entre componentes
- Implemente middlewares para funcionalidades transversais (auth, rate limiting)
- Separe responsabilidades: connectionManager para conexões, eventRouter para roteamento, messageBus para mensagens
- Use heartbeat para manter conexões vivas e detectar conexões mortas
- Implemente logging estruturado para debugging e monitoramento

## Tratamento de Erros

- Sempre trate erros de forma adequada
- Use try/catch para operações que podem falhar
- Log erros com contexto suficiente para debugging
- Retorne respostas de erro estruturadas para o cliente

## Padrões de Performance

- Evite memory leaks removendo listeners quando não necessários
- Use `setMaxListeners` se necessário para EventEmitters
- Implemente rate limiting para prevenir abuso
- Use heartbeat para cleanup de conexões mortas

## Segurança

- Sempre valide entrada do usuário
- Implemente autenticação adequada
- Use rate limiting para prevenir ataques DDoS
- Não exponha informações sensíveis em logs

## Comandos de Desenvolvimento

- `yarn test`: Executa testes uma vez
- `yarn test:coverage`: Executa testes com relatório de cobertura
- `yarn start`: Inicia o servidor
- `yarn dev`: Modo de desenvolvimento com watch
