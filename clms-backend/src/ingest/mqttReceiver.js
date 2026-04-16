const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');
const RuleEngine = require('../engine/ruleEngine');

class MqttReceiver {
    constructor(brokerUrl, io) {
        this.client = mqtt.connect(brokerUrl);
        this.io = io;
        this.setupListeners();
    }

    setupListeners() {
        this.client.on('connect', () => {
            console.log('[MQTT] Connected to Broker successfully.');
            // Listen to all Owntracks topics
            this.client.subscribe('owntracks/clms/#');
            console.log('[MQTT] Listening for CLMS device data...');
        });

        this.client.on('message', (topic, message) => {
            try {
                // Extract device ID from Topic (e.g., owntracks/user/opporeno -> 'opporeno')
                const topicParts = topic.split('/');
                const deviceId = topicParts[2];
                
                // Parse payload to JSON
                const payload = JSON.parse(message.toString());
                
                // Only log if the message is a location update
                if (payload._type === 'location') {
                    const currentLocation = {
                        lat: payload.lat,
                        lng: payload.lon
                    };
                    
                    // Clean, English-only output
                    console.log(`[Ingest] 🟢 Device [${deviceId}] coordinates: ${currentLocation.lat}, ${currentLocation.lng}`);
                    
                    // 1. UPDATE REAL-TIME LOCATION TO FRONTEND
                    if (this.io) {
                        this.io.emit('locationUpdate', {
                            deviceId: deviceId,
                            lat: currentLocation.lat,
                            lng: currentLocation.lng
                        });
                    }

                    // =========================================
                    // 2. RULE ENGINE LOGIC: Dynamic Check (Circle vs Polygon)
                    // =========================================
                    const usersPath = path.join(__dirname, '../../../CLMS-HK252-main/users.json');
                    if (fs.existsSync(usersPath)) {
                        const users = JSON.parse(fs.readFileSync(usersPath));
                        
                        // CHECK IF THIS DEVICE IS LINKED TO ANY CHILDREN IN THE SYSTEM
                        users.forEach(parent => {
                            if (parent.linkedChildren) {
                                const child = parent.linkedChildren.find(c => c.childUsername === deviceId);
                                
                                if (child && child.safeZone) {
                                    let isSafe = true;
                                    let alertMessage = '';

                                    // Phân loại xử lý dựa trên "type" của vùng an toàn
                                    if (child.safeZone.type === 'polygon' && child.safeZone.polygonPoints) {
                                        // A. KIỂM TRA ĐA GIÁC (ZONE-BASED)
                                        isSafe = RuleEngine.checkPolygonGeofence(currentLocation, child.safeZone.polygonPoints);
                                        alertMessage = `Violation detected: Child has left the safe polygon zone.`;
                                    } else {
                                        // B. KIỂM TRA VÒNG TRÒN (POINT-BASED - Mặc định)
                                        const radius = child.safeZone.radius || 1000;
                                        isSafe = RuleEngine.checkCircleGeofence(currentLocation, child.safeZone, radius);
                                        alertMessage = `Violation detected: Child has left the safe radius (${radius}m).`;
                                    }

                                    // Nếu phát hiện vi phạm, kích hoạt báo động!
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
                                        const notificationsPath = path.join(__dirname, '../../../CLMS-HK252-main/notifications.json');
                                        let notifications = [];
                                        if (fs.existsSync(notificationsPath)) {
                                            notifications = JSON.parse(fs.readFileSync(notificationsPath));
                                        }

                                        const newAlert = {
                                            id: Date.now(),
                                            deviceId: deviceId,
                                            childName: child.childName,
                                            message: alertMessage,
                                            time: new Date().toLocaleTimeString(),
                                            date: new Date().toLocaleDateString(),
                                            status: 'Unread'
                                        };

                                        notifications.unshift(newAlert); 
                                        
                                        const saveNotification = (retryCount = 0) => {
                                            try {
                                                fs.writeFileSync(notificationsPath, JSON.stringify(notifications.slice(0, 20), null, 2));
                                                console.log(`[Log] Đã lưu cảnh báo vào lịch sử.`);
                                            } catch (err) {
                                                if (retryCount < 5) { // Cho phép thử lại tối đa 5 lần
                                                    console.log(`[Khóa file] Windows đang bận (Lần ${retryCount + 1}), thử lại sau 200ms...`);
                                                    setTimeout(() => saveNotification(retryCount + 1), 200);
                                                } else {
                                                    console.error(`[Thất bại] Đã thử 5 lần nhưng file vẫn bị khóa:`, err.message);
                                                }
                                            }
                                        };

                                        saveNotification(); // Kích hoạt lệnh lưu
                                    }
                                }
                            }
                        });
                    }
                }
            } catch (error) {
                console.error('[Ingest] 🔴 Error processing data:', error.message);
            }
        });
    }
}

module.exports = MqttReceiver;