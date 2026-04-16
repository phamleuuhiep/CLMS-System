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

const app = express();
app.use(cors()); 

const server = http.createServer(app);

// Turn on CORS for Socket.IO to allow connections from the web app at port 3000
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});


// Initialize MQTT listener
const mqttBrokerUrl = 'mqtt://broker.emqx.io';
new MqttReceiver(mqttBrokerUrl, io);

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`[Backend] Core API & Real-time Server running on http://localhost:${PORT}`);
});