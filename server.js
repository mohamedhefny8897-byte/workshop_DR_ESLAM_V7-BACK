const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// فولدر الإيصالات
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// قاعدة البيانات الخاصة بالورك شوب
const db = new sqlite3.Database(path.join(__dirname, 'workshop.db'), (err) => {
    if (err) console.error(err.message);
    else {
        console.log('✅ Connected to Workshop DB.');
        db.run(`CREATE TABLE IF NOT EXISTS attendees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            phone TEXT UNIQUE,
            payment_method TEXT,
            receipt_path TEXT,
            status TEXT DEFAULT 'قيد المراجعة',
            registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// 1. تسجيل متدرب جديد
app.post('/api/register', upload.single('receipt'), (req, res) => {
    const { name, phone, method } = req.body;
    const receipt_path = req.file ? req.file.path.replace('\\', '/') : null;

    db.run(`INSERT INTO attendees (name, phone, payment_method, receipt_path) VALUES (?, ?, ?, ?)`, 
    [name, phone, method, receipt_path], function(err) {
        if(err) {
            if(err.message.includes('UNIQUE')) return res.status(400).json({success: false, message: 'هذا الرقم مسجل بالفعل!'});
            return res.status(500).json({success: false, message: 'حدث خطأ في السيرفر'});
        }
        res.json({ success: true, id: this.lastID });
    });
});

// 2. جلب كل المسجلين للإدارة
app.get('/api/admin/attendees', (req, res) => {
    db.all(`SELECT * FROM attendees ORDER BY id DESC`, [], (err, rows) => {
        res.json(rows);
    });
});

// 3. تحديث حالة المتدرب (تأكيد الدفع)
app.put('/api/admin/attendees/:id/status', (req, res) => {
    db.run(`UPDATE attendees SET status = ? WHERE id = ?`, [req.body.status, req.params.id], function(err) {
        res.json({ success: true });
    });
});

// 4. إحصائيات سريعة للوحة التحكم
app.get('/api/admin/stats', (req, res) => {
    db.get(`SELECT 
        COUNT(*) as total, 
        SUM(CASE WHEN status = 'مؤكد' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'قيد المراجعة' THEN 1 ELSE 0 END) as pending
        FROM attendees`, [], (err, row) => {
        res.json(row);
    });
});

app.listen(port, () => console.log(`🚀 Workshop Server running on port ${port}`));
