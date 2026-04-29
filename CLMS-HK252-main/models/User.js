const mongoose = require('mongoose');

// 1. Cấu trúc Vùng an toàn
const safeZoneSchema = new mongoose.Schema({
    type: { type: String, enum: ['circle', 'polygon'], default: 'circle' },
    lat: { type: Number },
    lng: { type: Number },
    radius: { type: Number },
    polygonPoints: [{ lat: Number, lng: Number }]
}, { _id: false }); 

// 2. Cấu trúc Trẻ em (Nằm bên trong tài khoản Phụ huynh)
const childSchema = new mongoose.Schema({
    childUsername: { type: String, required: true }, // Chính là deviceId (VD: oppo)
    childName: String,
    childPhone: String,
    safeZone: { type: safeZoneSchema, default: () => ({}) }
}, { _id: false });

// 3. Cấu trúc Tài khoản Chính
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true }, // unique: Không cho phép trùng tài khoản
    password: { type: String, required: true },
    name: String,
    email: String,
    phone: String,
    role: { type: String, enum: ['admin', 'parent', 'child'], required: true },
    linkedChildren: [childSchema] // Một phụ huynh có thể có một mảng nhiều trẻ em
}, { timestamps: true }); // Tự động sinh ra thời gian tạo (createdAt)

module.exports = mongoose.model('User', userSchema);