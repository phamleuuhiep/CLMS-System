const mqtt = require('mqtt');
<<<<<<< HEAD

class MqttReceiver {
    constructor(brokerUrl, locationProcessingService) {
        this.client = mqtt.connect(brokerUrl);
        this.locationProcessingService = locationProcessingService;
=======
const mongoose = require('mongoose');
const RuleEngine = require('../engine/ruleEngine');

// 1. IMPORT CÁC MODELS CỦA MONGODB
const User = require('../models/User.js');
const Notification = require('../models/Notification.js');

// 2. KẾT NỐI DATABASE
const DB_URI = 'mongodb://huuhiep2701_db_user:g8FsEU4xOAkvbR3R@ac-vflx34e-shard-00-00.rbu8rbb.mongodb.net:27017,ac-vflx34e-shard-00-01.rbu8rbb.mongodb.net:27017,ac-vflx34e-shard-00-02.rbu8rbb.mongodb.net:27017/clms_db?ssl=true&replicaSet=atlas-xv471f-shard-0&authSource=admin&appName=Cluster0';
mongoose.connect(DB_URI)
    .then(() => console.log('Successfully connected to MongoDB Cloud!'))
    .catch(err => console.error('MongoDB Connection Error:', err));

class MqttReceiver {
    constructor(brokerUrl, io) {
        this.client = mqtt.connect(brokerUrl);
        this.io = io;
>>>>>>> dfefe637f2940579f6eaee372ca3de2a185b62ef
        this.setupListeners();
    }

    setupListeners() {
        this.client.on('connect', () => {
            console.log('[MQTT] Connected to Broker successfully.');
<<<<<<< HEAD
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
=======
            this.client.subscribe('owntracks/clms/#');
            console.log('[MQTT] Listening for CLMS device data...');
        });

        // 3. THÊM TỪ KHÓA 'async' VÀO ĐÂY ĐỂ DÙNG MONGODB
        this.client.on('message', async (topic, message) => {
            try {
                const topicParts = topic.split('/');
                const deviceId = topicParts[2];
                const payload = JSON.parse(message.toString());
                
                if (payload._type === 'location') {
                    const currentLocation = { lat: payload.lat, lng: payload.lon };
                    console.log(`[Ingest] 🟢 Device [${deviceId}] coordinates: ${currentLocation.lat}, ${currentLocation.lng}`);
                    
                    // GỬI TỌA ĐỘ REAL-TIME LÊN FRONTEND
                    if (this.io) {
                        this.io.emit('locationUpdate', {
                            deviceId: deviceId,
                            lat: currentLocation.lat,
                            lng: currentLocation.lng
                        });
                    }

                    // =========================================
                    // 4. LOGIC TÌM KIẾM BẰNG MONGODB (THAY THẾ ĐỌC FILE USERS.JSON)
                    // =========================================
                    // Tìm người phụ huynh nào đang liên kết với thiết bị (deviceId) này
                    const parent = await User.findOne({ "linkedChildren.childUsername": deviceId });
                    
                    if (parent) {
                        const child = parent.linkedChildren.find(c => c.childUsername === deviceId);
                        
                        if (child && child.safeZone) {
                            let isSafe = true;
                            let alertMessage = '';

                            if (child.safeZone.type === 'polygon' && child.safeZone.polygonPoints) {
                                isSafe = RuleEngine.checkPolygonGeofence(currentLocation, child.safeZone.polygonPoints);
                                alertMessage = `Violation detected: Child has left the safe polygon zone.`;
                            } else {
                                const radius = child.safeZone.radius || 1000;
                                isSafe = RuleEngine.checkCircleGeofence(currentLocation, child.safeZone, radius);
                                alertMessage = `Violation detected: Child has left the safe radius (${radius}m).`;
                            }

                            // KÍCH HOẠT BÁO ĐỘNG NẾU VI PHẠM
                            if (!isSafe) {
                                console.log(`[ALERT] 🔴 WARNING: The child ${child.childName} has left the safe zone!`);
                                
                                if (this.io) {
                                    this.io.emit('securityAlert', {
                                        deviceId: deviceId,
                                        childName: child.childName,
                                        message: alertMessage,
                                        time: new Date().toLocaleTimeString()
                                    });
                                }

                                // =========================================
                                // 5. GHI LỊCH SỬ BẰNG MONGODB (THAY THẾ KHỐI TRY..CATCH EPERM CŨ)
                                // =========================================
                                const newAlert = new Notification({
                                    deviceId: deviceId,
                                    childName: child.childName,
                                    type: 'VIOLATION',
                                    message: alertMessage,
                                    time: new Date().toLocaleTimeString(),
                                    date: new Date().toLocaleDateString(),
                                    status: 'Unread'
                                });

                                await newAlert.save(); // Phép màu là đây: Chỉ 1 dòng code, không bao giờ bị khóa file!
                                console.log(`[Log] Đã lưu cảnh báo vi phạm của ${deviceId} vào MongoDB.`);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('[Ingest] 🔴 Error processing data:', error.message);
>>>>>>> dfefe637f2940579f6eaee372ca3de2a185b62ef
            }
        });
    }
}

<<<<<<< HEAD
module.exports = MqttReceiver;
=======
module.exports = MqttReceiver;
>>>>>>> dfefe637f2940579f6eaee372ca3de2a185b62ef
