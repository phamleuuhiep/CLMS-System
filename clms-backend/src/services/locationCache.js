class LocationCache {
    constructor() {
        this.memoryCache = new Map();
        this.redisClient = null;
        this.mode = 'memory';
    }

    async connect() {
        const redisUrl = process.env.REDIS_URL;

        if (!redisUrl) {
            return;
        }

        try {
            const { createClient } = require('redis');
            this.redisClient = createClient({ url: redisUrl });
            this.redisClient.on('error', (error) => {
                console.error('[Cache] Redis error:', error.message);
            });
            await this.redisClient.connect();
            this.mode = 'redis';
            console.log('[Cache] Redis recent-location cache is enabled.');
        } catch (error) {
            this.redisClient = null;
            this.mode = 'memory';
            console.warn('[Cache] Redis is unavailable. Falling back to in-memory cache.');
        }
    }

    getKey(deviceId) {
        return `recent-location:${deviceId}`;
    }

    async setLatest(deviceId, location) {
        this.memoryCache.set(deviceId, location);

        if (this.redisClient) {
            await this.redisClient.set(this.getKey(deviceId), JSON.stringify(location));
        }
    }

    async getLatest(deviceId) {
        if (this.redisClient) {
            const value = await this.redisClient.get(this.getKey(deviceId));
            return value ? JSON.parse(value) : null;
        }

        return this.memoryCache.get(deviceId) || null;
    }
}

module.exports = LocationCache;
