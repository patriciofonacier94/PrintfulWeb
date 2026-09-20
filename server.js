require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'printful_secret_key_2024';

// Security warning for production
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.error('⚠️  CRITICAL: JWT_SECRET not set in production!');
    process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.', {
    dotfiles: 'deny',
    index: 'index.html'
}));

// Prevent access to uploads directory via static serving
app.use('/uploads', (req, res) => {
    res.status(403).json({ error: 'Access denied' });
});

// Rate limiting
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per windowMs
    message: { error: 'Too many login attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 requests per hour
    message: { error: 'Too many contact submissions, please try again later' }
});

const orderLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour  
    max: 20, // 20 orders per hour
    message: { error: 'Too many order submissions, please try again later' }
});

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Sanitize filename - remove special characters
        const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniqueName = Date.now() + '-' + sanitized;
        cb(null, uniqueName);
    }
});

// Allowed file types
const fileFilter = (req, file, cb) => {
    const allowedMimes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'application/postscript', // .ai files
        'image/vnd.adobe.photoshop' // .psd files
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, JPG, PNG, AI, and PSD files are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
        files: 1
    },
    fileFilter: fileFilter
});

// Database connection
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'printful_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Warn if using default database password
if (!process.env.DB_PASSWORD) {
    console.warn('⚠️  WARNING: Using empty database password. Set DB_PASSWORD environment variable in production!');
}

const pool = mysql.createPool(dbConfig);

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Routes

// User registration (public)
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role = 'user' } = req.body;

        // Prevent creating admin accounts via public registration
        // (Optional safety: force role='user' if not authenticated as admin, 
        // but for now we'll just respect the input if we trust the frontend 
        // OR better: default to 'user' if not admin token present. 
        // Given the prompt, let's keep it simple: public signup = user role)

        const finalRole = 'user'; // Force user role for public signup

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Validate password length
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const connection = await pool.getConnection();

        try {
            const [result] = await connection.execute(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                [name, email, hashedPassword, finalRole]
            );

            res.json({
                message: 'User account created successfully',
                user: { id: result.insertId, name: name, email: email, role: role }
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'Email already registered' });
        } else {
            console.error('Registration error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// User login
app.post('/api/login',
    loginLimiter,
    [
        body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        try {
            const { email, password } = req.body;
            const connection = await pool.getConnection();

            try {
                const [users] = await connection.execute(
                    'SELECT * FROM users WHERE email = ?',
                    [email]
                );

                if (users.length === 0) {
                    return res.status(401).json({ error: 'Invalid email or password' });
                }

                const user = users[0];
                const isValidPassword = await bcrypt.compare(password, user.password);

                if (!isValidPassword) {
                    return res.status(401).json({ error: 'Invalid email or password' });
                }

                const token = jwt.sign(
                    {
                        userId: user.id,
                        email: user.email,
                        name: user.name,
                        role: user.role
                    },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );

                res.json({
                    message: 'Login successful',
                    token: token,
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role
                    }
                });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// Submit print order (REQUIRES AUTHENTICATION)
app.post('/api/orders',
    authenticateToken,
    orderLimiter,
    upload.single('print_file'),
    [
        body('take_in_date').isDate().withMessage('Valid date required'),
        // Remove strict print_type enum check since it's now dynamic
        body('print_type').notEmpty().withMessage('Print type is required'),
        body('quantity').isInt({ min: 1, max: 10000 }).withMessage('Quantity must be between 1 and 10000')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        try {
            const {
                take_in_date,
                print_type,
                quantity,
                special_request
            } = req.body;

            const userId = req.user.userId;

            if (!req.file) {
                return res.status(400).json({ error: 'Print file is required' });
            }

            const filePath = req.file.path;
            const connection = await pool.getConnection();

            try {
                // Parse print_type to get item details (Expected format: "Category - Item Name")
                // OR we can just lookup by matching the string if we store unique names
                // Better approach: Let's assume the frontend sends "Category - Item Name"
                // We will try to find the item in the DB to get the price.

                let estimatedPrice = 0.00;

                // Flexible matching:
                // 1. Try exact match on 'item_name' (if frontend sends just name)
                // 2. Try match on 'Category - Item Name' (common display format)

                const parts = print_type.split(' - ');
                const itemName = parts.length > 1 ? parts[1].trim() : print_type.trim();
                const category = parts.length > 1 ? parts[0].trim() : null;

                let query = 'SELECT * FROM pricing_items WHERE item_name = ?';
                let params = [itemName];

                if (category) {
                    query += ' AND category = ?';
                    params.push(category);
                }

                const [items] = await connection.execute(query, params);

                if (items.length > 0) {
                    const item = items[0];
                    let unitPrice = parseFloat(item.single_price);

                    // Check for bulk pricing
                    if (item.bulk_price && parseInt(quantity) >= (item.min_bulk_qty || 50)) {
                        unitPrice = parseFloat(item.bulk_price);
                    }

                    estimatedPrice = (unitPrice * parseInt(quantity)).toFixed(2);
                } else {
                    // Fallback for custom or unfound items (legacy support)
                    estimatedPrice = 0.00;
                }

                const [result] = await connection.execute(
                    `INSERT INTO orders (user_id, take_in_date, print_type, quantity, file_path, special_request, status, estimated_price) 
                     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
                    [userId, take_in_date, print_type, quantity, filePath, special_request, estimatedPrice]
                );

                res.json({
                    message: 'Order submitted successfully',
                    orderId: result.insertId,
                    estimatedPrice: estimatedPrice
                });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Order submission error:', error);
            res.status(500).json({ error: 'Failed to submit order' });
        }
    }
);

// Get user orders
app.get('/api/orders', authenticateToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();

        try {
            const [orders] = await connection.execute(
                `SELECT o.*, u.name as customer_name, u.email 
                 FROM orders o 
                 LEFT JOIN users u ON o.user_id = u.id 
                 WHERE o.user_id = ? 
                 ORDER BY o.created_at DESC`,
                [req.user.userId]
            );

            res.json(orders);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Get all orders (admin only)
app.get('/api/admin/orders', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const connection = await pool.getConnection();

        try {
            const [orders] = await connection.execute(
                `SELECT o.*, u.name as customer_name, u.email 
                 FROM orders o 
                 LEFT JOIN users u ON o.user_id = u.id 
                 ORDER BY o.created_at DESC`
            );

            res.json(orders);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Get admin orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Update order status
app.put('/api/orders/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Validate status
        const validStatuses = ['pending', 'in_progress', 'completed', 'received', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const connection = await pool.getConnection();

        try {
            await connection.execute(
                'UPDATE orders SET status = ? WHERE id = ?',
                [status, id]
            );

            res.json({ message: 'Order status updated successfully' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

// Delete order (admin only)
app.delete('/api/orders/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { id } = req.params;
        const connection = await pool.getConnection();

        try {
            const [result] = await connection.execute(
                'DELETE FROM orders WHERE id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Order not found' });
            }

            res.json({ message: 'Order deleted successfully' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({ error: 'Failed to delete order' });
    }
});

// Submit contact message
app.post('/api/contact',
    contactLimiter,
    [
        body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
        body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
        body('message').trim().isLength({ min: 10, max: 1000 }).withMessage('Message must be between 10 and 1000 characters')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        try {
            const { name, email, message } = req.body;

            const connection = await pool.getConnection();

            try {
                await connection.execute(
                    'INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)',
                    [name, email, message]
                );

                res.json({ message: 'Message sent successfully' });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Contact submission error:', error);
            res.status(500).json({ error: 'Failed to send message' });
        }
    }
);

// Get contact messages (admin only)
app.get('/api/admin/messages', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const connection = await pool.getConnection();

        try {
            const [messages] = await connection.execute(
                'SELECT * FROM contact_messages ORDER BY created_at DESC'
            );

            res.json(messages);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Get all users (admin only)
app.get('/api/admin/users', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const connection = await pool.getConnection();

        try {
            const [users] = await connection.execute(
                'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
            );

            res.json(users);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Update user role (admin only)
app.put('/api/admin/users/:id/role', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const userId = req.params.id;
        const { role } = req.body;

        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const connection = await pool.getConnection();
        try {
            await connection.execute(
                'UPDATE users SET role = ? WHERE id = ?',
                [role, userId]
            );
            res.json({ message: 'User role updated successfully' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete user (admin only) - Prevent deleting own account
app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { id } = req.params;

        // Prevent admin from deleting their own account
        if (parseInt(id) === req.user.userId) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        const connection = await pool.getConnection();

        try {
            const [result] = await connection.execute(
                'DELETE FROM users WHERE id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({ message: 'User deleted successfully' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Global error handler for multer
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
        return res.status(400).json({ error: error.message });
    } else if (error) {
        return res.status(400).json({ error: error.message });
    }
    next();
});

// ---------------------- Pricing API ----------------------

// Get all pricing items (Public)
app.get('/api/pricing', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.execute('SELECT * FROM pricing_items ORDER BY category, id');
        res.json(rows);
    } catch (error) {
        console.error('Get pricing error:', error);
        res.status(500).json({ error: 'Failed to fetch pricing' });
    } finally {
        connection.release();
    }
});

// Add new pricing item (Admin)
app.post('/api/pricing', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const { category, item_name, single_price, bulk_price } = req.body;
    if (!category || !item_name || !single_price) {
        return res.status(400).json({ error: 'Category, Item Name, and Single Price are required' });
    }

    const connection = await pool.getConnection();
    try {
        const [result] = await connection.execute(
            'INSERT INTO pricing_items (category, item_name, single_price, bulk_price) VALUES (?, ?, ?, ?)',
            [category, item_name, single_price, bulk_price || '']
        );
        res.json({ message: 'Item added', id: result.insertId });
    } catch (error) {
        console.error('Add pricing error:', error);
        res.status(500).json({ error: 'Failed to add item' });
    } finally {
        connection.release();
    }
});

// Update pricing item (Admin)
app.put('/api/pricing/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { category, item_name, single_price, bulk_price } = req.body;

    const connection = await pool.getConnection();
    try {
        await connection.execute(
            'UPDATE pricing_items SET category = ?, item_name = ?, single_price = ?, bulk_price = ? WHERE id = ?',
            [category, item_name, single_price, bulk_price || '', id]
        );
        res.json({ message: 'Item updated' });
    } catch (error) {
        console.error('Update pricing error:', error);
        res.status(500).json({ error: 'Failed to update item' });
    } finally {
        connection.release();
    }
});

// Delete pricing item (Admin)
app.delete('/api/pricing/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const connection = await pool.getConnection();
    try {
        await connection.execute('DELETE FROM pricing_items WHERE id = ?', [id]);
        res.json({ message: 'Item deleted' });
    } catch (error) {
        console.error('Delete pricing error:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    } finally {
        connection.release();
    }
});

app.listen(PORT, () => {
    console.log(`🖨️  Printful server running on port ${PORT}`);
    console.log(`🌐 Visit: http://localhost:${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});