import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleExtension } from '../../../src/handlers/onExtension.js';
import { messageBus } from '../../../src/server/messageBus.js';
import { userCache } from '../../../src/core/userCache.js';
import { connectionManager } from '../../../src/server/connectionManager.js';

vi.mock('../../../src/server/messageBus.js');
vi.mock('../../../src/core/userCache.js');
vi.mock('../../../src/server/connectionManager.js');

describe('onExtension', () => {
  let mockWs;
  let mockLogger;

  beforeEach(() => {
    mockWs = {};
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleExtension', () => {
    it('deve processar ação str válida com usuário no cache', () => {
      const message = { user: { id: '123' }, action: 'str', data: 10 };
      userCache.get.mockReturnValue('TestUser');

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).toHaveBeenCalledWith('123');
      expect(messageBus.sendToGame).toHaveBeenCalledWith('123', 'TestUser', 'str', 10);
      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: '123', action: 'str', data: 10 },
        'Handler extension chamado'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Ação str enviada para jogo: usuário 123 (TestUser)'
      );
    });

    it('deve processar ação agi válida sem usuário no cache', () => {
      const message = { user: { id: '456' }, action: 'agi' };
      userCache.get.mockReturnValue(null);

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).toHaveBeenCalledWith('456');
      expect(messageBus.sendToGame).toHaveBeenCalledWith('456', 'Desconhecido', 'agi', undefined);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Ação agi enviada para jogo: usuário 456 (Desconhecido)'
      );
    });

    it('deve processar ação agi válida', () => {
      const message = { user: { id: '456' }, action: 'agi', data: 8 };
      userCache.get.mockReturnValue('AgiUser');

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).toHaveBeenCalledWith('456');
      expect(messageBus.sendToGame).toHaveBeenCalledWith('456', 'AgiUser', 'agi', 8);
    });

    it('deve processar ação luc válida', () => {
      const message = { user: { id: '111' }, action: 'luc', data: 7 };
      userCache.get.mockReturnValue('LuckyUser');

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).toHaveBeenCalledWith('111');
      expect(messageBus.sendToGame).toHaveBeenCalledWith('111', 'LuckyUser', 'luc', 7);
    });

    it('deve processar ação equip válida', () => {
      const message = { user: { id: '222' }, action: 'equip', data: 'sword' };
      userCache.get.mockReturnValue('EquipUser');

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).toHaveBeenCalledWith('222');
      expect(messageBus.sendToGame).toHaveBeenCalledWith('222', 'EquipUser', 'equip', 'sword');
    });

    it('deve processar ação buy válida', () => {
      const message = { user: { id: '333' }, action: 'buy', data: 'potion' };
      userCache.get.mockReturnValue('BuyerUser');

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).toHaveBeenCalledWith('333');
      expect(messageBus.sendToGame).toHaveBeenCalledWith('333', 'BuyerUser', 'buy', 'potion');
    });

    it('deve processar ação sell válida', () => {
      const message = { user: { id: '444' }, action: 'sell', data: 'helmet' };
      userCache.get.mockReturnValue('SellerUser');

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).toHaveBeenCalledWith('444');
      expect(messageBus.sendToGame).toHaveBeenCalledWith('444', 'SellerUser', 'sell', 'helmet');
    });

    it('deve processar ação shop válida', () => {
      const message = { user: { id: '555' }, action: 'shop', data: null };
      userCache.get.mockReturnValue('ShopUser');

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).toHaveBeenCalledWith('555');
      expect(messageBus.sendToGame).toHaveBeenCalledWith('555', 'ShopUser', 'shop', null);
    });

    it('deve falhar quando userId está ausente', () => {
      const message = { action: 'str', data: 10 };

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).not.toHaveBeenCalled();
      expect(messageBus.sendToGame).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Mensagem de extensão recebida sem user.id');
    });

    it('deve falhar quando action está ausente', () => {
      const message = { user: { id: '123' }, data: 10 };

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).not.toHaveBeenCalled();
      expect(messageBus.sendToGame).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Mensagem de extensão recebida sem action');
    });

    it('deve falhar quando action não é permitida', () => {
      const message = { user: { id: '123' }, action: 'invalid', data: 10 };

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).not.toHaveBeenCalled();
      expect(messageBus.sendToGame).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Action invalid não permitida');
    });

    it('deve usar "Desconhecido" quando usuário não está no cache', () => {
      const message = { user: { id: '555' }, action: 'str', data: 1 };
      userCache.get.mockReturnValue(null);

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).toHaveBeenCalledWith('555');
      expect(messageBus.sendToGame).toHaveBeenCalledWith('555', 'Desconhecido', 'str', 1);
    });

    it('deve usar display_name da mensagem quando fornecido', () => {
      const message = { user: { id: '666', display_name: 'JoãoDaMensagem' }, action: 'shop', data: null };
      userCache.get.mockReturnValue('JoãoDoCache');

      handleExtension(mockWs, message, mockLogger);

      // display_name da mensagem tem prioridade, mas ainda consulta o cache como fallback
      expect(messageBus.sendToGame).toHaveBeenCalledWith('666', 'JoãoDaMensagem', 'shop', null);
    });

    it('deve usar cache quando display_name não está na mensagem', () => {
      const message = { user: { id: '777' }, action: 'buy', data: 'potion' };
      userCache.get.mockReturnValue('JoãoDoCache');

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).toHaveBeenCalledWith('777');
      expect(messageBus.sendToGame).toHaveBeenCalledWith('777', 'JoãoDoCache', 'buy', 'potion');
    });

    it('deve registrar extensão quando ação é shop', () => {
      const message = { user: { id: '888', display_name: 'ShopUser' }, action: 'shop', data: null };
      userCache.get.mockReturnValue('CachedUser');

      handleExtension(mockWs, message, mockLogger);

      expect(connectionManager.addExtension).toHaveBeenCalledWith('888', mockWs);
      expect(messageBus.sendToGame).toHaveBeenCalledWith('888', 'ShopUser', 'shop', null);
      expect(mockLogger.info).toHaveBeenCalledWith('Extensão registrada para usuário 888 devido à ação shop');
    });

    it('não deve registrar extensão para outras ações', () => {
      const message = { user: { id: '999', display_name: 'OtherUser' }, action: 'str', data: 5 };
      userCache.get.mockReturnValue('CachedUser');

      handleExtension(mockWs, message, mockLogger);

      expect(connectionManager.addExtension).not.toHaveBeenCalled();
      expect(messageBus.sendToGame).toHaveBeenCalledWith('999', 'OtherUser', 'str', 5);
    });

    it('deve cachear display_name quando fornecido na mensagem', () => {
      const message = { user: { id: '101', display_name: 'NovoNome' }, action: 'equip', data: 'sword' };
      userCache.get.mockReturnValue('NomeAntigo');

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.set).toHaveBeenCalledWith('101', 'NovoNome');
      expect(messageBus.sendToGame).toHaveBeenCalledWith('101', 'NovoNome', 'equip', 'sword');
    });
  });
});
