const db = require('../db');

const OrderModel = {
    /**
     * Create an order and insert its items in bulk.
     */
    createOrderWithItems({ userId, deliveryAddress, deliveryFee = 0, total, items }, callback) {
        const orderSql = `
            INSERT INTO orders (user_id, delivery_address, delivery_fee, total)
            VALUES (?, ?, ?, ?)
        `;

        db.query(orderSql, [userId, deliveryAddress, deliveryFee, total], (err, result) => {
            if (err) return callback(err);

            const orderId = result.insertId;

            if (!items || items.length === 0) {
                return callback(null, orderId);
            }

            const itemsSql = `
                INSERT INTO order_items (order_id, product_id, quantity, price)
                VALUES ?
            `;

            const values = items.map(item => [
                orderId,
                item.product_id,
                item.quantity,
                item.price
            ]);

            db.query(itemsSql, [values], (err2) => {
                if (err2) return callback(err2);
                return callback(null, orderId);
            });
        });
    },

    /**
     * Fetch all orders for a user.
     */
    getOrdersByUser(userId, callback) {
        const sql = `
            SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC
        `;
        db.query(sql, [userId], callback);
    },

    /**
     * Fetch one order for a specific user (used for user invoices).
     */
    getOrderForUser(orderId, userId, callback) {
        const sql = `
            SELECT *
            FROM orders
            WHERE id = ? AND user_id = ?
            LIMIT 1
        `;
        db.query(sql, [orderId, userId], (err, rows) => {
            if (err) return callback(err);
            const order = rows && rows.length ? rows[0] : null;
            callback(null, order);
        });
    },

    /**
     * Fetch a single order without user restriction (admin/logistics).
     */
    getOrderById(orderId, callback) {
        const sql = `
            SELECT * FROM orders WHERE id = ? LIMIT 1
        `;
        db.query(sql, [orderId], (err, rows) => {
            if (err) return callback(err);
            const order = rows && rows.length ? rows[0] : null;
            callback(null, order);
        });
    },

    /**
     * Fetch items for an order.
     */
    getOrderItems(orderId, callback) {
        const sql = `
            SELECT oi.*, p.productName
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE order_id = ?
        `;
        db.query(sql, [orderId], callback);
    },

    /**
     * All orders with the associated username (admin orders page).
     */
    getAllOrdersWithUser(callback) {
        const sql = `
            SELECT o.*, u.username
            FROM orders o
            JOIN users u ON o.user_id = u.id
            ORDER BY o.id DESC
        `;
        db.query(sql, callback);
    },

    /**
     * Fetch all orders with user info and optional filters/sorting.
     */
    getAllOrdersWithUserFiltered(options, callback) {
        const { search, status, sort, dateFrom, dateTo } = options || {};

        let sql = `
            SELECT o.*, u.username
            FROM orders o
            JOIN users u ON o.user_id = u.id
        `;

        const where = [];
        const params = [];

        if (search) {
            where.push('(u.username LIKE ? OR o.id LIKE ?)');
            const like = `%${search}%`;
            params.push(like, like);
        }

        if (status) {
            where.push('o.status = ?');
            params.push(status);
        }

        if (dateFrom) {
            where.push('DATE(o.created_at) >= ?');
            params.push(dateFrom);
        }

        if (dateTo) {
            where.push('DATE(o.created_at) <= ?');
            params.push(dateTo);
        }

        if (where.length) {
            sql += ' WHERE ' + where.join(' AND ');
        }

        const sortMap = {
            id_desc: 'o.id DESC',
            id_asc: 'o.id ASC',
            date_desc: 'o.created_at DESC',
            date_asc: 'o.created_at ASC',
            total_desc: 'o.total DESC',
            total_asc: 'o.total ASC'
        };
        const orderBy = sortMap[sort] || sortMap.id_desc;
        sql += ` ORDER BY ${orderBy}`;

        db.query(sql, params, callback);
    },

    /**
     * Single order with user details (admin view/invoice).
     */
    getOrderWithUser(orderId, callback) {
        const sql = `
            SELECT o.*, u.username, u.email
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.id = ?
            LIMIT 1
        `;
        db.query(sql, [orderId], (err, rows) => {
            if (err) return callback(err);
            const order = rows && rows.length ? rows[0] : null;
            callback(null, order);
        });
    },

    /**
     * Subtotal for an order (quantity * price per line).
     */
    getOrderSubtotal(orderId, callback) {
        const sql = `
            SELECT SUM(quantity * price) AS subtotal
            FROM order_items
            WHERE order_id = ?
        `;
        db.query(sql, [orderId], (err, rows) => {
            if (err) return callback(err);
            const subtotal = rows && rows.length ? Number(rows[0].subtotal || 0) : 0;
            callback(null, subtotal);
        });
    },

    /**
     * Update order delivery info and status while recalculating total.
     */
    updateOrderTotals(orderId, { delivery_address, delivery_fee, status }, callback) {
        this.getOrderSubtotal(orderId, (err, subtotal) => {
            if (err) return callback(err);

            const fee = Number(delivery_fee || 0);
            const newTotal = subtotal + fee;

            const updateSQL = `
                UPDATE orders
                SET delivery_address = ?, delivery_fee = ?, total = ?, status = ?
                WHERE id = ?
            `;

            db.query(
                updateSQL,
                [delivery_address, fee.toFixed(2), newTotal.toFixed(2), status, orderId],
                (err2) => {
                    if (err2) return callback(err2);
                    callback(null, { subtotal, total: newTotal });
                }
            );
        });
    },

    /**
     * Aggregate counts/revenue for dashboards.
     */
    getTotalOrdersCount(callback) {
        db.query('SELECT COUNT(*) AS totalOrders FROM orders', (err, rows) => {
            if (err) return callback(err);
            const totalOrders = rows && rows.length ? rows[0].totalOrders : 0;
            callback(null, totalOrders);
        });
    },

    getTotalRevenue(callback) {
        db.query('SELECT IFNULL(SUM(total), 0) AS totalRevenue FROM orders', (err, rows) => {
            if (err) return callback(err);
            const totalRevenue = rows && rows.length ? rows[0].totalRevenue : 0;
            callback(null, totalRevenue);
        });
    },

    getMonthlySales(callback) {
        const sql = `
            SELECT 
                DATE_FORMAT(created_at, '%Y-%m') AS month,
                SUM(total) AS revenue
            FROM orders
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY month ASC
        `;
        db.query(sql, callback);
    },

    getRecentOrders(limit, callback) {
        const sql = `
            SELECT o.*, u.username
            FROM orders o
            JOIN users u ON o.user_id = u.id
            ORDER BY o.id DESC
            LIMIT ?
        `;
        db.query(sql, [limit || 5], callback);
    },

    /**
     * User-facing stats.
     */
    getTotalOrdersForUser(userId, callback) {
        const sql = `
            SELECT COUNT(*) AS totalOrders
            FROM orders
            WHERE user_id = ?
        `;
        db.query(sql, [userId], (err, rows) => {
            if (err) return callback(err);
            const totalOrders = rows && rows.length ? rows[0].totalOrders : 0;
            callback(null, totalOrders);
        });
    },

    getTotalSpentForUser(userId, callback) {
        const sql = `
            SELECT SUM(total) AS totalSpent
            FROM orders
            WHERE user_id = ?
        `;
        db.query(sql, [userId], (err, rows) => {
            if (err) return callback(err);
            const totalSpent = rows && rows.length ? Number(rows[0].totalSpent || 0) : 0;
            callback(null, totalSpent);
        });
    },

    getRecentItemsBought(userId, limit, callback) {
        const sql = `
            SELECT p.productName, p.image, oi.quantity, oi.price
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            JOIN orders o ON o.id = oi.order_id
            WHERE o.user_id = ?
            ORDER BY o.created_at DESC
            LIMIT ?
        `;
        db.query(sql, [userId, limit || 15], callback);
    }
};

module.exports = OrderModel;
