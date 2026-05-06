const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ==========================================
// 1. Cấu trúc Vùng an toàn
// ==========================================
const safeZoneSchema = new mongoose.Schema({
    type: { type: String, enum: ['circle', 'polygon'], default: 'circle' },
    lat: { type: Number },
    lng: { type: Number },
    radius: { type: Number },
    // CẢI THIỆN: Thêm type rõ ràng và default: [] để Mongoose luôn khởi tạo mảng này
    polygonPoints: { 
        type: [{ lat: Number, lng: Number }], 
        default: [] 
    }
}, { _id: false }); 

// ==========================================
// 2. Cấu trúc Thông tin Trẻ em / Thiết bị
// ==========================================
const childSchema = new mongoose.Schema({
    childUsername: { type: String, required: true }, // Đóng vai trò là Device ID thực tế
    childName: String,
    childPhone: String,
    safeZone: { type: safeZoneSchema, default: () => ({}) }
}, { _id: false });

// ==========================================
// 3. Cấu trúc Tài khoản Hệ thống
// ==========================================
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: String,
    email: String,
    phone: String,
    role: { type: String, enum: ['admin', 'parent'], required: true }, 
    linkedChildren: [childSchema]
}, { timestamps: true });

// ==========================================
// THUẬT TOÁN BĂM MẬT KHẨU
// ==========================================
// CẢI THIỆN: Bổ sung 'next' để đảm bảo luồng lưu dữ liệu không bao giờ bị treo
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model('User', userSchema);