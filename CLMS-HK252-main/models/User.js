const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 1. Cấu trúc Vùng an toàn (Giữ nguyên)
const safeZoneSchema = new mongoose.Schema({
    type: { type: String, enum: ['circle', 'polygon'], default: 'circle' },
    lat: { type: Number },
    lng: { type: Number },
    radius: { type: Number },
    polygonPoints: [{ lat: Number, lng: Number }]
}, { _id: false }); 

// 2. Cấu trúc Thông tin Trẻ em / Thiết bị
const childSchema = new mongoose.Schema({
    childUsername: { type: String, required: true }, // Đóng vai trò là Device ID thực tế
    childName: String,
    childPhone: String,
    safeZone: { type: safeZoneSchema, default: () => ({}) }
    // Không cần password hay role ở đây nữa vì thiết bị IoT không cần đăng nhập
}, { _id: false });

// 3. Cấu trúc Tài khoản Hệ thống (Chỉ dành cho Admin và Phụ huynh)
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: String,
    email: String,
    phone: String,
    // Đã loại bỏ 'child' ra khỏi hệ thống phân quyền
    role: { type: String, enum: ['admin', 'parent'], required: true }, 
    linkedChildren: [childSchema]
}, { timestamps: true });

// ==========================================
// THUẬT TOÁN BĂM MẬT KHẨU
// ==========================================
userSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('User', userSchema);