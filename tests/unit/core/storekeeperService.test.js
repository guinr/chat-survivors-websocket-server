import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { storekeeperService } from '../../../src/core/storekeeperService.js';
import { storekeeperCache } from '../../../src/core/storekeeperCache.js';

vi.mock('../../../src/core/storekeeperCache.js', () => ({
  storekeeperCache: {
    set: vi.fn(),
    clear: vi.fn()
  }
}));

describe('StorekeeperService', () => {
  let mockLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    storekeeperService.destroy();
  });

  afterEach(() => {
    vi.useRealTimers();
    storekeeperService.destroy();
  });

  describe('init', () => {
    it('deve inicializar o serviço e agendar atualização diária', () => {
      storekeeperService.init(mockLogger);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Próxima limpeza do cache do storekeeper agendada para:')
      );
    });
  });

  describe('handleGameResponse', () => {
    beforeEach(() => {
      storekeeperService.init(mockLogger);
      vi.clearAllMocks();
    });

    it('deve processar resposta válida do jogo', () => {
      const validData = {
        name: 'Seksal',
        phrases: ['test phrase'],
        common_items: []
      };

      storekeeperService.handleGameResponse(validData);

      expect(storekeeperCache.set).toHaveBeenCalledWith(validData);
      expect(mockLogger.info).toHaveBeenCalledWith('Dados do storekeeper atualizados no cache');
    });

    it('deve processar string JSON válida', () => {
      const validData = {
        name: 'Seksal',
        phrases: ['test phrase'],
        common_items: []
      };

      storekeeperService.handleGameResponse(JSON.stringify(validData));

      expect(storekeeperCache.set).toHaveBeenCalledWith(validData);
      expect(mockLogger.info).toHaveBeenCalledWith('Dados do storekeeper atualizados no cache');
    });

    it('deve rejeitar dados inválidos sem name', () => {
      const invalidData = {
        phrases: ['test phrase']
      };

      storekeeperService.handleGameResponse(invalidData);

      expect(storekeeperCache.set).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Resposta do jogo não contém dados válidos do storekeeper');
    });

    it('deve rejeitar dados inválidos sem phrases', () => {
      const invalidData = {
        name: 'Seksal'
      };

      storekeeperService.handleGameResponse(invalidData);

      expect(storekeeperCache.set).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Resposta do jogo não contém dados válidos do storekeeper');
    });

    it('deve tratar erro de JSON inválido', () => {
      storekeeperService.handleGameResponse('invalid json{');

      expect(storekeeperCache.set).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: expect.any(String) },
        'Erro ao processar resposta do storekeeper do jogo'
      );
    });
  });

  describe('scheduleDailyUpdate', () => {
    beforeEach(() => {
      vi.setSystemTime(new Date('2025-08-28T10:00:00-03:00'));
    });

    it('deve agendar limpeza do cache para meia-noite', () => {
      storekeeperService.init(mockLogger);

      const now = new Date('2025-08-28T10:00:00-03:00');
      const nextMidnight = new Date('2025-08-29T00:00:00-03:00');
      const expectedDelay = nextMidnight.getTime() - now.getTime();

      vi.advanceTimersByTime(expectedDelay);

      expect(storekeeperCache.clear).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Meia-noite - limpando cache do storekeeper');
    });

    it('deve reagendar após executar limpeza', () => {
      storekeeperService.init(mockLogger);

      const now = new Date('2025-08-28T10:00:00-03:00');
      const nextMidnight = new Date('2025-08-29T00:00:00-03:00');
      const expectedDelay = nextMidnight.getTime() - now.getTime();
      const millisecondsInDay = 24 * 60 * 60 * 1000;

      vi.clearAllMocks();

      vi.advanceTimersByTime(expectedDelay);

      expect(storekeeperCache.clear).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(millisecondsInDay);

      expect(storekeeperCache.clear).toHaveBeenCalledTimes(2);
    });
  });

  describe('destroy', () => {
    it('deve limpar timer quando destruído', () => {
      storekeeperService.init(mockLogger);
      
      const timerCountBefore = vi.getTimerCount();
      
      storekeeperService.destroy();
      
      const timerCountAfter = vi.getTimerCount();
      
      expect(timerCountAfter).toBeLessThan(timerCountBefore);
    });

    it('deve permitir múltiplas chamadas de destroy', () => {
      storekeeperService.init(mockLogger);
      
      expect(() => {
        storekeeperService.destroy();
        storekeeperService.destroy();
      }).not.toThrow();
    });
  });
});
