const userCacheMap = new Map();

export const userCache = {
  set(userId, displayName) {
    userCacheMap.set(userId, displayName);
  },

  get(userId) {
    return userCacheMap.get(userId) || null;
  },

  has(userId) {
    return userCacheMap.has(userId);
  },

  clear() {
    userCacheMap.clear();
  },

  size() {
    return userCacheMap.size;
  }
};
