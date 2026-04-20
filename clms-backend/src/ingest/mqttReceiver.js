const mqtt = require('mqtt');

class MqttReceiver {
    constructor(brokerUrl, locationProcessingService) {
        this.client = mqtt.connect(brokerUrl);
        this.locationProcessingService = locationProcessingService;
        this.setupListeners();
    }

    setupListeners() {
        this.client.on('connect', () => {
            console.log('[MQTT] Connected to Broker successfully.');
            this.client.subscribe('owntracks/clms/#', (error) => {
                if (error) {
                    console.error('[MQTT] Failed to subscribe to owntracks/clms/#:', error.message);
                    return;
                }

                console.log('[MQTT] Listening for CLMS device data...');
            });
        });

        this.client.on('error', (error) => {
            console.error('[MQTT] Client error:', error.message);
        });

        this.client.on('reconnect', () => {
            console.warn('[MQTT] Reconnecting to broker...');
        });

        this.client.on('offline', () => {
            console.warn('[MQTT] Client is offline.');
        });

        this.client.on('close', () => {
            console.warn('[MQTT] Connection closed.');
        });

        this.client.on('message', async (topic, message) => {
            const topicParts = topic.split('/');
            const deviceId = topicParts[2];

            if (!deviceId) {
                console.warn(`[Ingest] Ignored message with invalid topic: ${topic}`);
                return;
            }

            let payload;

            try {
                payload = JSON.parse(message.toString());
            } catch (error) {
                console.error('[Ingest] Invalid JSON payload:', error.message);
                return;
            }

            if (payload._type !== 'location') {
                return;
            }

            const currentLocation = {
                lat: Number(payload.lat),
                lng: Number(payload.lon)
            };

            if (!Number.isFinite(currentLocation.lat) || !Number.isFinite(currentLocation.lng)) {
                console.warn(`[Ingest] Ignored invalid coordinates for device ${deviceId}.`);
                return;
            }

            try {
                console.log(`[Ingest] Device [${deviceId}] coordinates: ${currentLocation.lat}, ${currentLocation.lng}`);
                await this.locationProcessingService.processLocation(deviceId, currentLocation, 'mqtt');
            } catch (error) {
                console.error('[Ingest] Error processing data:', error.message);
            }
        });
    }
}

module.exports = MqttReceiver;
