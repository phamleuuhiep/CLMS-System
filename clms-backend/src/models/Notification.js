const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    deviceId: String,
    childName: String,
    type: String, // SOS hoặc VIOLATION
    message: String,
    time: String,
    status: { type: String, default: 'Unread' }
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);