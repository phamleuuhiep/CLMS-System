const mongoose = require('mongoose');

// 1. Định nghĩa cấu trúc Vùng an toàn (Safe Zone)
const safeZoneSchema = new mongoose.Schema({
    type: { 
        type: String, 
        enum: ['circle', 'polygon'], 
        default: 'circle' 
    },
    lat: { type: Number },
    lng: { type: Number },
    radius: { type: Number },
    // Mảng các điểm nếu là vùng Đa giác
    polygonPoints: [{ 
        lat: Number, 
        lng: Number 
    }]
}, { _id: false }); // _id: false để không tạo ID riêng cho object này

// 2. Định nghĩa cấu trúc Trẻ em (Dùng để lồng vào tài khoản Phụ huynh)
const childSchema = new mongoose.Schema({
    childUsername: { type: String, required: true },
    childName: String,
    childPhone: String,
    safeZone: { 
        type: safeZoneSchema, 
        default: () => ({}) 
    }
}, { _id: false });

// 3. Định nghĩa cấu trúc Người dùng chính
const userSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true // Đảm bảo không trùng tên đăng nhập
    },
    password: { type: String, required: true },
    name: String,
    email: String,
    phone: String,
    role: { 
        type: String, 
        enum: ['admin', 'parent', 'child'], 
        required: true 
    },
    // Danh sách trẻ em được liên kết (chỉ dành cho role: 'parent')
    linkedChildren: [childSchema]
}, { 
    timestamps: true // Tự động thêm createdAt và updatedAt
});

// Xuất Model để sử dụng ở các file khác
module.exports = mongoose.model('User', userSchema);