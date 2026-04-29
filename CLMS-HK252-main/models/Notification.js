const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    deviceId: String,
    childName: String,
    type: { type: String, default: 'VIOLATION' }, // Có thể là: VIOLATION, SOS, Request
    message: String,
    time: String,
    date: String,
    status: { type: String, default: 'Unread' } // Trạng thái: Chưa đọc (Unread) hoặc Đã xử lý
}, { timestamps: true }); // Tự động sinh ra thời gian tạo

module.exports = mongoose.model('Notification', notificationSchema);