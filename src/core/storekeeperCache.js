class StorekeeperCache {
  constructor() {
    this.cache = null;
    this.cacheDate = null;
  }

  isValidForToday() {
    if (!this.cache || !this.cacheDate) {
      return false;
    }

    const now = new Date();
    const today = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const cacheDay = new Date(this.cacheDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    
    return today.toDateString() === cacheDay.toDateString();
  }

  get() {
    if (this.isValidForToday()) {
      return this.cache;
    }
    return null;
  }

  set(data) {
    this.cache = data;
    this.cacheDate = new Date();
  }

  clear() {
    this.cache = null;
    this.cacheDate = null;
  }
}

export const storekeeperCache = new StorekeeperCache();
