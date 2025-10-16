import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleExtension } from '../../../src/handlers/onExtension.js';
import { messageBus } from '../../../src/server/messageBus.js';
import { userCache } from '../../../src/core/userCache.js';

vi.mock('../../../src/server/messageBus.js');
vi.mock('../../../src/core/userCache.js');

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
      const message = { user: { id: '123' }, action: 'str', value: 10 };
      userCache.get.mockReturnValue('TestUser');

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).toHaveBeenCalledWith('123');
      expect(messageBus.sendToGame).toHaveBeenCalledWith('123', 'TestUser', 'str', 10);
      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: '123', action: 'str' },
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

    it('deve processar ação vit válida', () => {
      const message = { user: { id: '789' }, action: 'vit', value: 5 };
      userCache.get.mockReturnValue('VitUser');

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).toHaveBeenCalledWith('789');
      expect(messageBus.sendToGame).toHaveBeenCalledWith('789', 'VitUser', 'vit', 5);
    });

    it('deve processar ação luc válida', () => {
      const message = { user: { id: '111' }, action: 'luc', value: 7 };
      userCache.get.mockReturnValue('LuckyUser');

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).toHaveBeenCalledWith('111');
      expect(messageBus.sendToGame).toHaveBeenCalledWith('111', 'LuckyUser', 'luc', 7);
    });

    it('deve processar ação equip válida', () => {
      const message = { user: { id: '222' }, action: 'equip', value: 'sword' };
      userCache.get.mockReturnValue('EquipUser');

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).toHaveBeenCalledWith('222');
      expect(messageBus.sendToGame).toHaveBeenCalledWith('222', 'EquipUser', 'equip', 'sword');
    });

    it('deve processar ação buy válida', () => {
      const message = { user: { id: '333' }, action: 'buy', value: 'potion' };
      userCache.get.mockReturnValue('BuyerUser');

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).toHaveBeenCalledWith('333');
      expect(messageBus.sendToGame).toHaveBeenCalledWith('333', 'BuyerUser', 'buy', 'potion');
    });

    it('deve processar ação sell válida', () => {
      const message = { user: { id: '444' }, action: 'sell', value: 'helmet' };
      userCache.get.mockReturnValue('SellerUser');

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).toHaveBeenCalledWith('444');
      expect(messageBus.sendToGame).toHaveBeenCalledWith('444', 'SellerUser', 'sell', 'helmet');
    });

    it('deve falhar quando userId está ausente', () => {
      const message = { action: 'str', value: 10 };

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).not.toHaveBeenCalled();
      expect(messageBus.sendToGame).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Mensagem de extensão recebida sem user.id');
    });

    it('deve falhar quando action está ausente', () => {
      const message = { user: { id: '123' }, value: 10 };

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).not.toHaveBeenCalled();
      expect(messageBus.sendToGame).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Mensagem de extensão recebida sem action');
    });

    it('deve falhar quando action não é permitida', () => {
      const message = { user: { id: '123' }, action: 'invalid', value: 10 };

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).not.toHaveBeenCalled();
      expect(messageBus.sendToGame).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Action invalid não permitida');
    });

    it('deve usar "Desconhecido" quando usuário não está no cache', () => {
      const message = { user: { id: '555' }, action: 'str', value: 1 };
      userCache.get.mockReturnValue(null);

      handleExtension(mockWs, message, mockLogger);

      expect(userCache.get).toHaveBeenCalledWith('555');
      expect(messageBus.sendToGame).toHaveBeenCalledWith('555', 'Desconhecido', 'str', 1);
    });
  });
});
