import { storekeeperCache } from './storekeeperCache.js';

class StorekeeperService {
  constructor() {
    this.logger = null;
    this.dailyUpdateTimer = null;
  }

  init(logger) {
    this.logger = logger;
    this.scheduleDailyUpdate();
  }

  handleGameResponse(data) {
    try {
      const storekeeperData = typeof data === 'string' ? JSON.parse(data) : data;
      
      if (storekeeperData.name && storekeeperData.phrases) {
        storekeeperCache.set(storekeeperData);
        this.logger?.info('Dados do storekeeper atualizados no cache');
      } else {
        this.logger?.warn('Resposta do jogo não contém dados válidos do storekeeper');
      }
    } catch (error) {
      this.logger?.error({ error: error.message }, 'Erro ao processar resposta do storekeeper do jogo');
    }
  }

  scheduleDailyUpdate() {
    if (this.dailyUpdateTimer) {
      clearTimeout(this.dailyUpdateTimer);
    }

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();

    this.dailyUpdateTimer = setTimeout(() => {
      this.logger?.info('Meia-noite - limpando cache do storekeeper');
      storekeeperCache.clear();
      this.scheduleDailyUpdate();
    }, timeUntilMidnight);

    this.logger?.info(`Próxima limpeza do cache do storekeeper agendada para: ${tomorrow.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  }

  destroy() {
    if (this.dailyUpdateTimer) {
      clearTimeout(this.dailyUpdateTimer);
      this.dailyUpdateTimer = null;
    }
  }
}

export const storekeeperService = new StorekeeperService();
