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
<<<<<<< HEAD
//     res.status(200).json({
//         status: 'success',
//         message: 'CLMS API Gateway is running smoothly.'
=======
//     res.status(200).json({ 
//         status: 'success', 
//         message: 'CLMS API Gateway is running smoothly.' 
>>>>>>> dfefe637f2940579f6eaee372ca3de2a185b62ef
//     });
// });

// // API receive Arduino Cloud Webhook
// // app.post('/api/webhook', (req, res) => {
// //     const data = req.body;
<<<<<<< HEAD

// //     console.log('\n[Webhook] Received data from Arduino Cloud!');

=======
    
// //     console.log('\n[Webhook] Received data from Arduino Cloud!');
    
>>>>>>> dfefe637f2940579f6eaee372ca3de2a185b62ef
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


<<<<<<< HEAD
=======









>>>>>>> dfefe637f2940579f6eaee372ca3de2a185b62ef
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
<<<<<<< HEAD
const MqttReceiver = require('./ingest/mqttReceiver');
const eventBus = require('./events/eventBus');
const LocationCache = require('./services/locationCache');
const LocationStore = require('./services/locationStore');
const RuleRepository = require('./services/ruleRepository');
const LocationProcessingService = require('./services/locationProcessingService');

const app = express();
app.use(cors());
app.use(express.json());
=======
const MqttReceiver = require('./ingest/mqttReceiver'); 

const app = express();
app.use(cors()); 
>>>>>>> dfefe637f2940579f6eaee372ca3de2a185b62ef

const server = http.createServer(app);

// Turn on CORS for Socket.IO to allow connections from the web app at port 3000
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

<<<<<<< HEAD
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

app.locals.locationProcessingService = locationProcessingService;

const NON_DEVICE_LOCATION_SOURCES = new Set(['ui-safe-zone-update', 'rule-recheck']);
const IGNORED_LATEST_LOCATION_SOURCES = new Set(['rule-recheck']);

function isDeviceDetectedLocation(location) {
    return location
        && Number.isFinite(Number(location.lat))
        && Number.isFinite(Number(location.lng))
        && !NON_DEVICE_LOCATION_SOURCES.has(location.source);
}

function isLatestKnownLocation(location) {
    return location
        && Number.isFinite(Number(location.lat))
        && Number.isFinite(Number(location.lng))
        && !IGNORED_LATEST_LOCATION_SOURCES.has(location.source);
}

async function getLatestKnownLocation(deviceId) {
    const cachedLocation = await locationCache.getLatest(deviceId);
    if (isLatestKnownLocation(cachedLocation)) {
        return cachedLocation;
    }

    return locationStore
        .getDeviceHistory(deviceId, 200)
        .find((entry) => isLatestKnownLocation(entry)) || null;
}

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        mqtt: 'connected_via_runtime_logs',
        cacheMode: locationCache.mode
    });
});

app.get('/api/devices/:deviceId/location', async (req, res) => {
    const latestLocation = await getLatestKnownLocation(req.params.deviceId);

    if (!latestLocation) {
        return res.status(404).json({ message: 'No location found for this device.' });
    }

    return res.status(200).json({
        ...latestLocation,
        isDeviceDetected: isDeviceDetectedLocation(latestLocation)
    });
});

app.post('/api/devices/:deviceId/recheck', async (req, res) => {
    const latestLocation = await getLatestKnownLocation(req.params.deviceId);

    if (!latestLocation) {
        return res.status(404).json({
            message: 'No known location found for this device.'
        });
    }

    const result = await locationProcessingService.processLocation(
        req.params.deviceId,
        { lat: Number(latestLocation.lat), lng: Number(latestLocation.lng) },
        'rule-recheck'
    );

    return res.status(202).json({
        message: 'Latest device location rechecked successfully.',
        locationSource: latestLocation.source || null,
        isDeviceDetected: isDeviceDetectedLocation(latestLocation),
        violations: result.violations.length,
        evaluations: result.evaluations
    });
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

app.post('/api/location-data', async (req, res) => {
    const { deviceId, lat, lng, source = 'http' } = req.body || {};

    if (!deviceId || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
        return res.status(400).json({
            message: 'deviceId, lat, and lng are required.'
        });
    }

    const result = await locationProcessingService.processLocation(
        deviceId,
        { lat: Number(lat), lng: Number(lng) },
        source
    );

    return res.status(202).json({
        message: 'Location processed successfully.',
        violations: result.violations.length,
        evaluations: result.evaluations
    });
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
=======

// Initialize MQTT listener
const mqttBrokerUrl = 'mqtt://broker.emqx.io';
new MqttReceiver(mqttBrokerUrl, io);

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`[Backend] Core API & Real-time Server running on http://localhost:${PORT}`);
});
>>>>>>> dfefe637f2940579f6eaee372ca3de2a185b62ef
