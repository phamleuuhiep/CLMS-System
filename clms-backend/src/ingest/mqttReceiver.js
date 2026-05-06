const mqtt = require('mqtt');
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
        this.setupListeners();
    }

    setupListeners() {
        this.client.on('connect', () => {
            console.log('[MQTT] Connected to Broker successfully.');
            this.client.subscribe('owntracks/clms/#');
            console.log('[MQTT] Listening for CLMS device data...');
        });

        // 3. THÊM TỪ KHÓA 'async' VÀO ĐÂY ĐỂ DÙNG MONGODB
        this.client.on('message', async (topic, message) => {
            try {
                // In ra topic và tin nhắn thô để kiểm tra xem server có nhận được gì không
                console.log(`[MQTT Debug] Nhận tin nhắn từ topic: ${topic}`);
                
                const topicParts = topic.split('/');
                
                // GIẢI QUYẾT LỖI 2: Lấy Device ID chuẩn xác
                // Nếu topic là 'owntracks/clms/device123', thì deviceId nằm ở vị trí số 2
                const deviceId = topicParts[2]; 
                
                if (!deviceId) {
                    console.log('[MQTT Warning] Không tìm thấy Device ID trong topic.');
                    return;
                }

                const payload = JSON.parse(message.toString());
                
                // GIẢI QUYẾT LỖI 1: Lấy đúng biến Kinh độ (Hỗ trợ cả 'lon' và 'lng')
                const deviceLng = payload.lng !== undefined ? payload.lng : payload.lon;

                // 1. Kiểm tra xem payload có chứa tọa độ không
                if (payload.lat !== undefined && deviceLng !== undefined) {
                    
                    // Ép kiểu chuỗi văn bản thành số thập phân
                    const lat = parseFloat(payload.lat);
                    const lng = parseFloat(deviceLng);

                    // ==========================================
                    // BỘ LỌC BẢO VỆ DỮ LIỆU GPS (Filter valid GPS)
                    // ==========================================
                    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                        console.error(`[Ingest] 🔴 Skip [${deviceId}]. lat: ${payload.lat}, lng: ${deviceLng}`);
                        return; // Dừng lại ngay lập tức
                    }

                    console.log(`[Ingest] 🟢 Valid coordinates [${deviceId}]: ${lat}, ${lng}`);

                    // 2. Xử lý cập nhật vị trí
                    // (Nếu dùng OwnTracks, thiết bị sẽ tự gửi _type là 'location')
                    if (payload._type === 'location' || payload._type === undefined) {
                        
                        const currentLocation = { lat: lat, lng: lng }; 
                        
                        // GỬI TỌA ĐỘ REAL-TIME LÊN FRONTEND
                        if (this.io) {
                            this.io.emit('locationUpdate', {
                                deviceId: deviceId,
                                lat: currentLocation.lat,
                                lng: currentLocation.lng
                            });
                        }

                        // =========================================
                        // 4. LOGIC TÌM KIẾM BẰNG MONGODB
                        // =========================================
                        const parent = await User.findOne({ "linkedChildren.childUsername": deviceId });
                        
                        if (parent) {
                            const child = parent.linkedChildren.find(c => c.childUsername === deviceId);
                            
                            if (child && child.safeZone) {
                                let isSafe = true;
                                let alertMessage = '';

                                // --- BỘ MÁY PHÂN TÍCH VÙNG AN TOÀN ĐA GIÁC ---
                                if (child.safeZone.type === 'polygon') {
                                    console.log(`[Geofence Debug] Đang kiểm tra Zone-based. Số lượng đỉnh: ${child.safeZone.polygonPoints ? child.safeZone.polygonPoints.length : 0}`);
                                    
                                    if (child.safeZone.polygonPoints && child.safeZone.polygonPoints.length > 0) {
                                        isSafe = RuleEngine.checkPolygonGeofence(currentLocation, child.safeZone.polygonPoints);
                                        console.log(`[Geofence Debug] Kết quả Zone-based (isSafe): ${isSafe}`);
                                        alertMessage = `Child has left the safe polygon area!`;
                                    } else {
                                        console.log(`[Geofence Debug] ⚠️ Mảng polygon bị rỗng, bỏ qua kiểm tra!`);
                                    }
                                } 
                                // --- BỘ MÁY PHÂN TÍCH VÙNG AN TOÀN HÌNH TRÒN ---
                                else if (child.safeZone.type === 'circle' && child.safeZone.lat && child.safeZone.lng) {
                                    const radius = child.safeZone.radius || 1000;
                                    isSafe = RuleEngine.checkCircleGeofence(currentLocation, child.safeZone, radius);
                                    alertMessage = `Child has left the safe circle area!`;
                                }

                                // KÍCH HOẠT BÁO ĐỘNG NẾU VI PHẠM
                                if (!isSafe) {
                                    console.log(`[ALERT] 🔴 Warning: Child ${child.childName} has left the safe area!`);
                                    
                                    if (this.io) {
                                        this.io.emit('securityAlert', {
                                            deviceId: deviceId,
                                            childName: child.childName,
                                            message: alertMessage,
                                            time: new Date().toLocaleTimeString()
                                        });
                                    }

                                    // 5. GHI LỊCH SỬ BẰNG MONGODB
                                    const newAlert = new Notification({
                                        deviceId: deviceId,
                                        childName: child.childName,
                                        type: 'VIOLATION',
                                        message: alertMessage,
                                        time: new Date().toLocaleTimeString(),
                                        date: new Date().toLocaleDateString(),
                                        status: 'Unread'
                                    });

                                    await newAlert.save(); 
                                    console.log(`[Log] Saved violation alert for ${deviceId} into MongoDB.`);
                                }
                            }
                        }
                        else {
                            console.log(`[Ingest] ⚠️ Device ${deviceId} sent location data but is not linked to any parent.`);
                        }
                    } 
                } else {
                    console.log(`[MQTT Debug] Message from ${deviceId}`);
                }
            } catch (error) {
                console.error('[Ingest] 🔴 Error:', error.message);
            }
        });
    }
}

module.exports = MqttReceiver;