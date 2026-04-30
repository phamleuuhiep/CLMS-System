const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const mongoose = require('mongoose'); // Import Mongoose thay cho fs

// Import Models (Đảm bảo bạn đã tạo 2 file này trong thư mục models)
const User = require('./models/User.js');
const Notification = require('./models/Notification.js');

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
app.use(session({
    secret: 'ase_hcmut_clms_ultimate',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 }
}));

// ==========================================
// 2. ROUTES XÁC THỰC (AUTH)
// ==========================================
app.get('/login', (req, res) => res.sendFile(__dirname + '/views/login.html'));

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Hàm tạo giao diện thông báo xịn xò (dùng lại giống hệt bên Register)
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
                            confirmButtonText: 'Try Again'
                        }).then(() => {
                            window.location = "${redirect}";
                        });
                    </script>
                </body>
                </html>
            `);
        };

        // 1. Tìm User bằng username
        const user = await User.findOne({ username: username });
        
        if (user) { 
            // 2. Dùng bcrypt đối chiếu mật khẩu
            const isMatch = await bcrypt.compare(password, user.password);

            if (isMatch) {
                req.session.user = user; 
                res.redirect('/'); // Đăng nhập thành công thì vào thẳng Dashboard
            } else {
                // UI Báo lỗi sai mật khẩu
                return sendBeautifulAlert('error', 'Login Failed', 'Incorrect password! Please try again.', '/login');
            }
        } else { 
            // UI Báo lỗi không tìm thấy tài khoản (Account does not exist)
            return sendBeautifulAlert('warning', 'Not Found', 'Account does not exist!', '/login');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
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
});

app.get('/add-child', (req, res) => {
    if (req.session.user?.role !== 'parent') return res.redirect('/login');
    res.sendFile(__dirname + '/views/add-child.html');
});

app.get('/logout', (req, res) => { 
    req.session.destroy(); 
    res.redirect('/login'); 
});

// ==========================================
// 3. API DÀNH CHO ADMIN
// ==========================================
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
    }
    res.redirect('/');
});

// ==========================================
// 4. API DÀNH CHO PARENT (PHỤ HUYNH)
// ==========================================
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
            return res.status(200).send('OK');
        }
    }
    res.status(404).send('Cannot find child or parent');
});

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
    
    res.send('<script>alert("Request sent!"); window.location="/";</script>');
});

// ==========================================
// 6. TRANG CHỦ DASHBOARD (GIAO DIỆN CHÍNH)
// ==========================================
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