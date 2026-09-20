-- Drop and recreate database
DROP DATABASE IF EXISTS printful_db;
CREATE DATABASE printful_db;
USE printful_db;

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    take_in_date DATE NOT NULL,
    print_type VARCHAR(255) NOT NULL, -- Changed from ENUM to allow dynamic items
    quantity INT NOT NULL DEFAULT 1,
    file_path VARCHAR(500),
    special_request TEXT,
    status ENUM('pending', 'in_progress', 'completed', 'received', 'cancelled') DEFAULT 'pending',
    estimated_price DECIMAL(10,2),
    final_price DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Contact messages table
CREATE TABLE contact_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pricing Items table (Renamed from prices to match server.js)
CREATE TABLE pricing_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    single_price DECIMAL(10,2) NOT NULL, -- Renamed from price
    max_price DECIMAL(10,2),
    bulk_price DECIMAL(10,2),
    min_bulk_qty INT DEFAULT 50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert prices
INSERT INTO pricing_items (category, item_name, single_price, max_price, bulk_price) VALUES
('Tshirt printing', 'Heat Press A4', 80.00, 120.00, NULL),
('Tshirt printing', 'Silkscreen 1 color', 100.00, 120.00, NULL),
('Tshirt printing', 'Silkscreen 2-3 color', 150.00, 180.00, NULL),
('Tshirt printing', 'DTF Ready-to-Press A4', 50.00, 70.00, NULL),
('Tshirt printing', 'DTF Print on Shirt', 150.00, 200.00, NULL),
('Sticker', 'Glossy Sticker A4', 60.00, NULL, 50.00),
('Sticker', 'Matte Sticker A4', 80.00, NULL, 70.00),
('Sticker', 'Transparent A4', 40.00, NULL, 35.00),
('Sticker', 'Die-Cut Small', 3.00, 5.00, 2.00),
('Tarpaulin', 'Per sq. ft', 0.00, NULL, 0.00),
('Tarpaulin', '2x3 ft', 90.00, NULL, 80.00),
('Tarpaulin', '3x4 ft', 160.00, NULL, 150.00),
('Tarpaulin', '4x6 ft', 300.00, NULL, 290.00),
('Laminate', 'A4 Lamination', 35.00, NULL, 30.00),
('Laminate', 'A3 Lamination', 65.00, NULL, 60.00),
('Laminate', 'Short Lamination', 30.00, NULL, 25.00),
('Laminate', 'Long Lamination', 40.00, NULL, 35.00),
('Laminate', 'ID Lamination Small', 20.00, NULL, 15.00),
('Laminate', 'ID Lamination Large', 25.00, NULL, 20.00),
('Print/photocopy', 'B&W Short', 1.00, NULL, 0.50),
('Print/photocopy', 'B&W Long', 2.00, NULL, 1.00),
('Print/photocopy', 'Colored Print A4', 10.00, NULL, 7.00),
('Print/photocopy', 'Colored Print Short', 5.00, NULL, 3.00),
('Print/photocopy', 'Document Scan', 5.00, 10.00, 5.00);

-- Insert default admin user (password: admin123)
INSERT INTO users (name, email, password, role) VALUES 
('Administrator', 'admin@printful.com', 'admin123', 'admin');

-- Insert sample user (password: user123)
INSERT INTO users (name, email, password) VALUES 
('John Client', 'user@example.com', 'user123');

-- Sample orders for testing
INSERT INTO orders (user_id, take_in_date, print_type, quantity, special_request, status, estimated_price) VALUES
(2, '2024-03-15', 'tshirt', 10, 'Use cotton material', 'completed', 250.00),
(2, '2024-03-20', 'sticker', 100, 'Glossy finish', 'in_progress', 200.00),
(2, '2024-03-25', 'tarpaulin', 2, '2x3 meters', 'pending', 30.00),
(1, '2024-03-18', 'laminate', 50, 'A4 size', 'completed', 250.00),
(2, '2024-03-22', 'bulk', 500, 'Business cards', 'in_progress', 250.00);

-- Sample contact messages
INSERT INTO contact_messages (name, email, message) VALUES
('Alice Johnson', 'alice@example.com', 'Interested in bulk printing for our company.'),
('Bob Smith', 'bob@example.com', 'Need a quote for banner printing.');

-- Display success message
SELECT 'Database setup completed successfully!' as status;
SELECT 'Admin login: admin@printful.com / admin123' as admin_credentials;
SELECT 'User login: user@example.com / user123' as user_credentials;