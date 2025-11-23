const db = require('../db');

const OrderModel = {

    createOrder(userId, total, deliveryAddress, callback) {
        const sql = `
            INSERT INTO orders (user_id, total, delivery_address)
            VALUES (?, ?, ?)
        `;
        db.query(sql, [userId, total, deliveryAddress], (err, result) => {
            if (err) return callback(err);
            callback(null, result.insertId);
        });
    },

    addOrderItem(orderId, productId, quantity, price, callback) {
        const sql = `
            INSERT INTO order_items (order_id, product_id, quantity, price)
            VALUES (?, ?, ?, ?)
        `;
        db.query(sql, [orderId, productId, quantity, price], callback);
    },

    getOrdersByUser(userId, callback) {
        const sql = `
            SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC
        `;
        db.query(sql, [userId], callback);
    },

    getOrderItems(orderId, callback) {
        const sql = `
            SELECT oi.*, p.productName
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE order_id = ?
        `;
        db.query(sql, [orderId], callback);
    }
};

module.exports = OrderModel;
