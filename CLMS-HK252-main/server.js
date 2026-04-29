const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
<<<<<<< HEAD
const fs = require('fs');
const path = require('path');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
const PORT = 3000;

// ==========================================
// 1. CẤU HÌNH & KHỞI TẠO FILE DỮ LIỆU
// ==========================================
app.use(bodyParser.urlencoded({ extended: true }));
=======
const mongoose = require('mongoose'); // Import Mongoose thay cho fs

// Import Models (Đảm bảo bạn đã tạo 2 file này trong thư mục models)
const User = require('./models/User');
const Notification = require('./models/Notification');

const app = express();
app.set('view engine', 'ejs');
// app.set('views', path.join(__dirname, 'views')); 
const PORT = 3000;

// ==========================================
// 1. KẾT NỐI MONGODB CLOUD
// ==========================================
const DB_URI = 'mongodb://huuhiep2701_db_user:g8FsEU4xOAkvbR3R@ac-vflx34e-shard-00-00.rbu8rbb.mongodb.net:27017,ac-vflx34e-shard-00-01.rbu8rbb.mongodb.net:27017,ac-vflx34e-shard-00-02.rbu8rbb.mongodb.net:27017/clms_db?ssl=true&replicaSet=atlas-xv471f-shard-0&authSource=admin&appName=Cluster0';
mongoose.connect(DB_URI)
    .then(() => console.log('✅ [MQTT Backend] Successfully connected to MongoDB Cloud!'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); 
>>>>>>> dfefe637f2940579f6eaee372ca3de2a185b62ef
app.use(session({
    secret: 'ase_hcmut_clms_ultimate',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 }
}));

<<<<<<< HEAD
const USERS_FILE = path.join(__dirname, 'users.json');
const NOTIFICATIONS_FILE = path.join(__dirname, 'notifications.json');

if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));
if (!fs.existsSync(NOTIFICATIONS_FILE)) fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify([]));

function getData(file) { return JSON.parse(fs.readFileSync(file)); }
function saveData(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

// ==========================================
// 2. ROUTES XÁC THỰC (AUTH)
// ==========================================
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = getData(USERS_FILE).find(u => u.username === username && u.password === password);
    if (user) { req.session.user = user; res.redirect('/'); }
    else res.send('<script>alert("Sai tài khoản!"); window.location="/login";</script>');
});

app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'views', 'register.html')));

app.post('/register', (req, res) => {
    const { username, name, role, email, phone, password, confirmPassword } = req.body;
    if (role === 'admin') return res.status(403).send('Bảo mật: Không thể đăng ký Admin công khai.');
    if (password !== confirmPassword) return res.send('Mật khẩu không khớp!');
    const users = getData(USERS_FILE);
    if (users.find(u => u.username === username)) return res.send('Username đã tồn tại!');
    users.push({ username, name, role, email, phone, password, linkedChildren: [] });
    saveData(USERS_FILE, users);
    res.send('<script>alert("Đăng ký thành công!"); window.location="/login";</script>');
=======
// ==========================================
// 2. ROUTES XÁC THỰC (AUTH)
// ==========================================
app.get('/login', (req, res) => res.sendFile(__dirname + '/views/login.html'));

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        // Tìm User trong Database
        const user = await User.findOne({ username: username, password: password });
        
        if (user) { 
            req.session.user = user; 
            res.redirect('/'); 
        } else { 
            res.send('<script>alert("Sai tài khoản!"); window.location="/login";</script>'); 
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Lỗi Server');
    }
});

app.get('/register', (req, res) => res.sendFile(__dirname + '/views/register.html'));

app.post('/register', async (req, res) => {
    try {
        const { username, name, role, email, phone, password, confirmPassword } = req.body;
        
        // Hàm tiện ích tạo giao diện thông báo xịn xò bằng SweetAlert2
        const sendBeautifulAlert = (icon, title, text, redirect) => {
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
                    <style>body { font-family: 'Inter', sans-serif; background: #f4f7f6; }</style>
                </head>
                <body>
                    <script>
                        Swal.fire({
                            icon: '${icon}',
                            title: '${title}',
                            text: '${text}',
                            confirmButtonColor: '#635BFF',
                            confirmButtonText: 'OK'
                        }).then(() => {
                            window.location = "${redirect}";
                        });
                    </script>
                </body>
                </html>
            `);
        };

        // Kiểm tra các lỗi và hiển thị popup tương ứng
        if (role === 'admin') {
            return sendBeautifulAlert('error', 'Invalid Role', 'Cannot register as Admin publicly.', '/register');
        }
        if (password !== confirmPassword) {
            return sendBeautifulAlert('warning', 'Wrong Password', 'Confirm password does not match.', '/register');
        }
        
        // Kiểm tra trùng username
        const existingUser = await User.findOne({ username: username });
        if (existingUser) {
            return sendBeautifulAlert('error', 'Registration Failed', 'This username is already taken!', '/register');
        }
        
        // Tạo User mới
        const newUser = new User({ username, name, role, email, phone, password, linkedChildren: [] });
        await newUser.save(); // Lưu vào Database
        sendBeautifulAlert('success', 'Excellent!', 'Your account has been created successfully.', '/login');
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
>>>>>>> dfefe637f2940579f6eaee372ca3de2a185b62ef
});

app.get('/add-child', (req, res) => {
    if (req.session.user?.role !== 'parent') return res.redirect('/login');
<<<<<<< HEAD
    res.sendFile(path.join(__dirname, 'views', 'add-child.html'));
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });
=======
    res.sendFile(__dirname + '/views/add-child.html');
});

app.get('/logout', (req, res) => { 
    req.session.destroy(); 
    res.redirect('/login'); 
});
>>>>>>> dfefe637f2940579f6eaee372ca3de2a185b62ef

// ==========================================
// 3. API DÀNH CHO ADMIN
// ==========================================
<<<<<<< HEAD
app.post('/admin/delete-user', (req, res) => {
    if (req.session.user?.role !== 'admin') return res.status(403).send('Từ chối.');
    let users = getData(USERS_FILE);
    users = users.filter(u => u.username !== req.body.targetUsername);
    users.forEach(u => { if (u.linkedChildren) u.linkedChildren = u.linkedChildren.filter(c => c.childUsername !== req.body.targetUsername); });
    saveData(USERS_FILE, users);
    res.redirect('/');
});

app.post('/admin/link-pair', (req, res) => {
    if (req.session.user?.role !== 'admin') return res.status(403).send('Từ chối.');
    const { parentUser, childUser } = req.body;
    const users = getData(USERS_FILE);
    const parent = users.find(u => u.username === parentUser && u.role === 'parent');
    const child = users.find(u => u.username === childUser && u.role === 'child');
    if (parent && child && !parent.linkedChildren.find(c => c.childUsername === child.username)) {
        parent.linkedChildren.push({ childUsername: child.username, childName: child.name, childPhone: child.phone, safeZone: { lat: 10.772393, lng: 106.658145, radius: 1000 } });
        saveData(USERS_FILE, users);
=======
app.post('/admin/delete-user', async (req, res) => {
    if (req.session.user?.role !== 'admin') return res.status(403).send('Từ chối.');
    
    // Xóa user đó
    await User.deleteOne({ username: req.body.targetUsername });
    
    // Gỡ liên kết của user đó khỏi tất cả phụ huynh (nếu là trẻ em)
    await User.updateMany(
        { role: 'parent' }, 
        { $pull: { linkedChildren: { childUsername: req.body.targetUsername } } }
    );
    
    res.redirect('/');
});

app.post('/admin/link-pair', async (req, res) => {
    if (req.session.user?.role !== 'admin') return res.status(403).send('Từ chối.');
    const { parentUser, childUser } = req.body;
    
    const parent = await User.findOne({ username: parentUser, role: 'parent' });
    const child = await User.findOne({ username: childUser, role: 'child' });
    
    if (parent && child && !parent.linkedChildren.find(c => c.childUsername === child.username)) {
        parent.linkedChildren.push({ 
            childUsername: child.username, 
            childName: child.name, 
            childPhone: child.phone, 
            safeZone: { type: 'circle', lat: 10.772393, lng: 106.658145, radius: 1000 } 
        });
        await parent.save();
>>>>>>> dfefe637f2940579f6eaee372ca3de2a185b62ef
    }
    res.redirect('/');
});

// ==========================================
// 4. API DÀNH CHO PARENT (PHỤ HUYNH)
// ==========================================
<<<<<<< HEAD
// app.post('/parent/add-child', (req, res) => {
//     if (req.session.user?.role !== 'parent') return res.status(403).send('Từ chối.');
//     const { childUsername } = req.body;
//     const users = getData(USERS_FILE);
//     const child = users.find(u => u.username === childUsername && u.role === 'child');
//     if (!child) return res.send('<script>alert("Lỗi: Không tìm thấy tài khoản Trẻ em này!"); window.location="/";</script>');
//     const parentIndex = users.findIndex(u => u.username === req.session.user.username);
//     if (users[parentIndex].linkedChildren.find(c => c.childUsername === childUsername)) {
//         return res.send('<script>alert("Trẻ này đã được liên kết rồi!"); window.location="/";</script>');
//     }
//     users[parentIndex].linkedChildren.push({ childUsername: child.username, childName: child.name, childPhone: child.phone, safeZone: { lat: 10.772393, lng: 106.658145, radius: 1000 } });
//     saveData(USERS_FILE, users);
//     req.session.user = users[parentIndex];
//     res.redirect('/');
// });
app.post('/parent/add-child', (req, res) => {
    if (req.session.user?.role !== 'parent') return res.status(403).send('Từ chối.');
    
    // Lấy đúng các biến từ form giao diện add-child.html mới
    const { childName, childPhone, deviceId } = req.body; 
    
    const users = getData(USERS_FILE);
    const parentIndex = users.findIndex(u => u.username === req.session.user.username);
    
    // Kiểm tra xem phụ huynh đã liên kết thiết bị này chưa
    if (users[parentIndex].linkedChildren.find(c => c.childUsername === deviceId)) {
        return res.send('<script>alert("Thiết bị này đã được liên kết rồi!"); window.location="/";</script>');
    }
    
    // Thêm trẻ vào danh sách (Sử dụng deviceId làm mỏ neo để bắt tọa độ MQTT)
    users[parentIndex].linkedChildren.push({ 
        childUsername: deviceId, // Mấu chốt: Tên device trên OwnTracks (VD: oppo)
        childName: childName, 
        childPhone: childPhone, 
        safeZone: { lat: 10.772393, lng: 106.658145, radius: 1000 } 
    });
    
    saveData(USERS_FILE, users);
    req.session.user = users[parentIndex]; // Cập nhật lại session
    res.redirect('/');
});

app.post('/parent/remove-child', (req, res) => {
    if (req.session.user?.role !== 'parent') return res.status(403).send('Từ chối.');
    const users = getData(USERS_FILE);
    const parentIndex = users.findIndex(u => u.username === req.session.user.username);
    users[parentIndex].linkedChildren = users[parentIndex].linkedChildren.filter(c => c.childUsername !== req.body.childUsername);
    saveData(USERS_FILE, users);
    req.session.user = users[parentIndex];
    res.redirect('/');
});

app.post('/parent/set-geofence-radius', (req, res) => {
    if (req.session.user?.role !== 'parent') return res.status(403).send('Từ chối.');
    const { childUsername, radius } = req.body;
    const users = getData(USERS_FILE);
    const parentIndex = users.findIndex(u => u.username === req.session.user.username);
    const childIndex = users[parentIndex].linkedChildren.findIndex(c => c.childUsername === childUsername);
    if (childIndex !== -1) {
        users[parentIndex].linkedChildren[childIndex].safeZone.radius = parseInt(radius);
        saveData(USERS_FILE, users);
        req.session.user = users[parentIndex];
    }
    res.redirect('/');
});

app.post('/parent/respond-request', (req, res) => {
    const { requestId, status } = req.body;
    let notifications = getData(NOTIFICATIONS_FILE);
    const normalizedRequestId = Number(requestId);
    if (Number.isNaN(normalizedRequestId)) {
        return res.status(400).send('Invalid request id');
    }
    const idx = notifications.findIndex(n => n.id === normalizedRequestId);
    if (idx !== -1) { notifications[idx].status = status; saveData(NOTIFICATIONS_FILE, notifications); }
    res.redirect('/');
});

app.post('/parent/set-geofence', express.json(), (req, res) => {
    if (req.session.user?.role !== 'parent') return res.status(403).send('Từ chối.');
    
    // Nhận type (circle hoặc polygon) và data tương ứng
    const { childUsername, type, lat, lng, radius, polygonPoints } = req.body; 
    
    const users = getData(USERS_FILE);
    const parentIndex = users.findIndex(u => u.username === req.session.user.username);
    
    if (parentIndex !== -1) {
        const childIndex = users[parentIndex].linkedChildren.findIndex(c => c.childUsername === childUsername);
        if (childIndex !== -1) {
            
            // Xóa vùng an toàn cũ và thiết lập mới
            users[parentIndex].linkedChildren[childIndex].safeZone = { type: type };

            if (type === 'circle') {
                users[parentIndex].linkedChildren[childIndex].safeZone.lat = parseFloat(lat);
                users[parentIndex].linkedChildren[childIndex].safeZone.lng = parseFloat(lng);
                users[parentIndex].linkedChildren[childIndex].safeZone.radius = parseInt(radius);
            } else if (type === 'polygon') {
                // Lưu mảng các điểm của đa giác
                users[parentIndex].linkedChildren[childIndex].safeZone.polygonPoints = polygonPoints;
            }
            
            saveData(USERS_FILE, users);
            req.session.user = users[parentIndex];
=======
app.post('/parent/add-child', async (req, res) => {
    if (req.session.user?.role !== 'parent') return res.status(403).send('Từ chối.');
    const { childName, childPhone, deviceId } = req.body; 
    
    const parent = await User.findOne({ username: req.session.user.username });
    if (!parent) return res.status(404).send('Không tìm thấy phụ huynh');

    if (parent.linkedChildren.find(c => c.childUsername === deviceId)) {
        return res.send('<script>alert("Thiết bị này đã được liên kết rồi!"); window.location="/";</script>');
    }
    
    parent.linkedChildren.push({ 
        childUsername: deviceId, 
        childName: childName, 
        childPhone: childPhone, 
        safeZone: { type: 'circle', lat: 10.772393, lng: 106.658145, radius: 1000 } 
    });
    
    await parent.save();
    req.session.user = parent; // Cập nhật session
    res.redirect('/');
});

app.post('/parent/remove-child', async (req, res) => {
    if (req.session.user?.role !== 'parent') return res.status(403).send('Từ chối.');
    const parent = await User.findOne({ username: req.session.user.username });
    
    parent.linkedChildren = parent.linkedChildren.filter(c => c.childUsername !== req.body.childUsername);
    await parent.save();
    
    req.session.user = parent;
    res.redirect('/');
});

app.post('/parent/respond-request', async (req, res) => {
    // Với Mongoose, requestId sẽ là _id do MongoDB tự cấp
    const { requestId, status } = req.body;
    await Notification.findByIdAndUpdate(requestId, { status: status });
    res.redirect('/');
});

// Route vẽ Polygon và Circle hoàn chỉnh
app.post('/parent/set-geofence', async (req, res) => {
    if (req.session.user?.role !== 'parent') return res.status(403).send('Từ chối.');
    const { childUsername, type, lat, lng, radius, polygonPoints } = req.body; 
    
    const parent = await User.findOne({ username: req.session.user.username });
    if (parent) {
        const childIndex = parent.linkedChildren.findIndex(c => c.childUsername === childUsername);
        if (childIndex !== -1) {
            parent.linkedChildren[childIndex].safeZone = { type: type };

            if (type === 'circle') {
                parent.linkedChildren[childIndex].safeZone.lat = parseFloat(lat);
                parent.linkedChildren[childIndex].safeZone.lng = parseFloat(lng);
                parent.linkedChildren[childIndex].safeZone.radius = parseInt(radius);
            } else if (type === 'polygon') {
                parent.linkedChildren[childIndex].safeZone.polygonPoints = polygonPoints;
            }
            
            await parent.save();
            req.session.user = parent;
>>>>>>> dfefe637f2940579f6eaee372ca3de2a185b62ef
            return res.status(200).send('OK');
        }
    }
    res.status(404).send('Cannot find child or parent');
});

<<<<<<< HEAD
// Compatibility endpoint for older UI builds.
app.post('/parent/set-geofence-center', express.json(), (req, res) => {
    if (req.session.user?.role !== 'parent') return res.status(403).send('Từ chối.');

    const { childUsername, lat, lng, radius } = req.body;
    const users = getData(USERS_FILE);
    const parentIndex = users.findIndex(u => u.username === req.session.user.username);

    if (parentIndex !== -1) {
        const childIndex = users[parentIndex].linkedChildren.findIndex(c => c.childUsername === childUsername);
        if (childIndex !== -1) {
            users[parentIndex].linkedChildren[childIndex].safeZone = {
                type: 'circle',
                lat: parseFloat(lat),
                lng: parseFloat(lng),
                radius: parseInt(radius)
            };
            saveData(USERS_FILE, users);
            req.session.user = users[parentIndex];
            return res.status(200).send('OK');
        }
    }
    res.status(404).send('Cannot find child or parent');
});
// ==========================================
// 5. API DÀNH CHO CHILD (TRẺ EM)
// ==========================================
app.post('/child/sos', (req, res) => {
    if (req.session.user?.role !== 'child') return res.status(403).send('Từ chối.');
    const notifications = getData(NOTIFICATIONS_FILE);
    notifications.push({ id: Date.now(), type: 'SOS', from: req.session.user.username, name: req.session.user.name, time: new Date().toLocaleString(), status: 'Critical' });
    saveData(NOTIFICATIONS_FILE, notifications);
    res.send('<script>alert("SOS signal sent to parents!"); window.location="/";</script>');
});

app.post('/child/request-move', (req, res) => {
    const { destination } = req.body;
    const notifications = getData(NOTIFICATIONS_FILE);
    notifications.push({ id: Date.now(), type: 'Request', from: req.session.user.username, name: req.session.user.name, destination: destination, time: new Date().toLocaleString(), status: 'Pending' });
    saveData(NOTIFICATIONS_FILE, notifications);
=======
// ==========================================
// 5. API DÀNH CHO CHILD (TRẺ EM)
// ==========================================
app.post('/child/sos', async (req, res) => {
    if (req.session.user?.role !== 'child') return res.status(403).send('Từ chối.');
    
    const newAlert = new Notification({
        type: 'SOS',
        childName: req.session.user.name,
        message: 'Trẻ đang gặp nguy hiểm (SOS)',
        time: new Date().toLocaleString(),
        status: 'Critical'
    });
    await newAlert.save();
    
    res.send('<script>alert("SOS signal sent to parents!"); window.location="/";</script>');
});

app.post('/child/request-move', async (req, res) => {
    const { destination } = req.body;
    
    const newReq = new Notification({
        type: 'Request',
        childName: req.session.user.name,
        message: `Request to move to: ${destination}`,
        time: new Date().toLocaleString(),
        status: 'Pending'
    });
    await newReq.save();
    
>>>>>>> dfefe637f2940579f6eaee372ca3de2a185b62ef
    res.send('<script>alert("Request sent!"); window.location="/";</script>');
});

// ==========================================
// 6. TRANG CHỦ DASHBOARD (GIAO DIỆN CHÍNH)
// ==========================================
<<<<<<< HEAD
app.get('/', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const users = getData(USERS_FILE);
    const notifications = getData(NOTIFICATIONS_FILE);
    const user = users.find(u => u.username === req.session.user.username);

    if (!user) {
        req.session.destroy();
        return res.redirect('/login');
    }

    req.session.user = user;

    res.render('index', { 
        user: user, 
        notifications: notifications,
        users: users 
    });
});
app.listen(PORT, () => console.log(`[Frontend] CLMS Web UI Running: http://localhost:${PORT}`));
=======
app.get('/', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    try {
        // Luôn lấy dữ liệu User mới nhất từ MongoDB
        const user = await User.findOne({ username: req.session.user.username });
        if (user) req.session.user = user; 

        // Lấy danh sách toàn bộ User (cho Admin)
        const users = await User.find({});
        
        // Lấy danh sách thông báo, sắp xếp mới nhất lên đầu
        const notifications = await Notification.find({}).sort({ createdAt: -1 });

        res.render('index', { 
            user: req.session.user, 
            notifications: notifications,
            users: users 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Lỗi tải Dashboard");
    }
});

app.listen(PORT, () => console.log(`[Frontend] CLMS Web UI Running: http://localhost:${PORT}`));
>>>>>>> dfefe637f2940579f6eaee372ca3de2a185b62ef
