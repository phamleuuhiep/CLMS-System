// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const MqttReceiver = require('./ingest/mqttReceiver');

// const app = express();
// const PORT = process.env.PORT || 3000;

// // Middleware configurations
// app.use(cors());
// app.use(express.json()); // Allows the API to understand JSON requests

// // A simple Health Check API route
// app.get('/api/health', (req, res) => {
//     res.status(200).json({ 
//         status: 'success', 
//         message: 'CLMS API Gateway is running smoothly.' 
//     });
// });

// // API receive Arduino Cloud Webhook
// // app.post('/api/webhook', (req, res) => {
// //     const data = req.body;
    
// //     console.log('\n[Webhook] Received data from Arduino Cloud!');
    
// //     // Arduino usually sends an array of changed variables
// //     if (data.values && data.values.length > 0) {
// //         data.values.forEach(item => {
// //             if (item.name === 'gps') {
// //                 console.log(`[Webhook - GPS] Device ${data.thing_id} is at location:`, item.value);
// //                 // At this point, we will pass the location to the Rule Engine (CLMS)
// //             }
// //         });
// //     }

// //     // Send a 200 OK response to Arduino to indicate successful receipt
// //     res.status(200).send('OK');
// // });



// // Initialize the MQTT Device Ingest
// // const mqttBrokerUrl = process.env.MQTT_BROKER_URL;
// // const mqttReceiver = new MqttReceiver(mqttBrokerUrl);

// const mqttBrokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://test.mosquitto.org';
// const mqttReceiver = new MqttReceiver(mqttBrokerUrl);

// // Start the Express server
// app.listen(PORT, () => {
//     console.log(`[Server] API Gateway listening on port ${PORT}`);
// });











const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const MqttReceiver = require('./ingest/mqttReceiver');
const eventBus = require('./events/eventBus');
const LocationCache = require('./services/locationCache');
const LocationStore = require('./services/locationStore');
const RuleRepository = require('./services/ruleRepository');
const LocationProcessingService = require('./services/locationProcessingService');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Turn on CORS for Socket.IO to allow connections from the web app at port 3000
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

const locationCache = new LocationCache();
const locationStore = new LocationStore();
const ruleRepository = new RuleRepository();
const locationProcessingService = new LocationProcessingService({
    io,
    cache: locationCache,
    store: locationStore,
    ruleRepository,
    eventBus
});

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        mqtt: 'connected_via_runtime_logs',
        cacheMode: locationCache.mode
    });
});

app.get('/api/devices/:deviceId/location', async (req, res) => {
    const latestLocation = await locationCache.getLatest(req.params.deviceId);

    if (!latestLocation) {
        return res.status(404).json({ message: 'No location found for this device.' });
    }

    return res.status(200).json(latestLocation);
});

app.get('/api/devices/:deviceId/history', (req, res) => {
    const limit = Number(req.query.limit) || 50;
    const history = locationStore.getDeviceHistory(req.params.deviceId, Math.min(limit, 200));
    res.status(200).json(history);
});

app.get('/api/violations', (req, res) => {
    const limit = Number(req.query.limit) || 50;
    const violations = locationStore.getViolations(Math.min(limit, 200));
    res.status(200).json(violations);
});

eventBus.on('ruleViolation', (event) => {
    console.log(`[EventBus] Queued violation event ${event.id} for notification service.`);
});

// Initialize MQTT listener
const mqttBrokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io';
locationCache.connect().catch((error) => {
    console.error('[Cache] Failed to initialize cache:', error.message);
});
new MqttReceiver(mqttBrokerUrl, locationProcessingService);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`[Backend] Core API & Real-time Server running on http://localhost:${PORT}`);
});
