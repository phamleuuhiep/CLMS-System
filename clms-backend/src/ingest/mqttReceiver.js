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
            // Listen to all Owntracks topics
            this.client.subscribe('owntracks/clms/#');
            console.log('[MQTT] Listening for CLMS device data...');
        });

        this.client.on('message', async (topic, message) => {
            try {
                const topicParts = topic.split('/');
                const deviceId = topicParts[2];
                const payload = JSON.parse(message.toString());

                if (payload._type === 'location') {
                    const currentLocation = {
                        lat: Number(payload.lat),
                        lng: Number(payload.lon)
                    };
                    console.log(`[Ingest] Device [${deviceId}] coordinates: ${currentLocation.lat}, ${currentLocation.lng}`);
                    await this.locationProcessingService.processLocation(deviceId, currentLocation, 'mqtt');
                }
            } catch (error) {
                console.error('[Ingest] Error processing data:', error.message);
            }
        });
    }
}

module.exports = MqttReceiver;
