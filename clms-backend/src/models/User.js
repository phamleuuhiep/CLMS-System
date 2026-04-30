const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 1. Cấu trúc Vùng an toàn
const safeZoneSchema = new mongoose.Schema({
    type: { type: String, enum: ['circle', 'polygon'], default: 'circle' },
    lat: { type: Number },
    lng: { type: Number },
    radius: { type: Number },
    polygonPoints: [{ lat: Number, lng: Number }]
}, { _id: false }); 

// 2. Cấu trúc Trẻ em
const childSchema = new mongoose.Schema({
    childUsername: { type: String, required: true },
    childName: String,
    childPhone: String,
    safeZone: { type: safeZoneSchema, default: () => ({}) }
}, { _id: false });

// 3. Cấu trúc Tài khoản Chính
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: String,
    email: String,
    phone: String,
    role: { type: String, enum: ['admin', 'parent', 'child'], required: true },
    linkedChildren: [childSchema]
}, { timestamps: true });

// ==========================================
// THUẬT TOÁN BĂM MẬT KHẨU NẰM Ở ĐÂY (TRƯỚC MODULE.EXPORTS)
// ==========================================
userSchema.pre('save', async function(next) {
    // Nếu mật khẩu không bị thay đổi hoặc không phải mới tạo -> bỏ qua
    if (!this.isModified('password')) return next();

    try {
        // Tạo muối (salt) độ phức tạp 10 và băm mật khẩu
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model('User', userSchema);