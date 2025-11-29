const db = require('../db');

const CartModel = {
    /**
     * Fetch cart items for a user including product details.
     */
    getCartItems(userId, callback) {
        const sql = `
            SELECT
                ci.product_id AS id,
                ci.quantity,
                p.productName,
                p.price,
                p.image,
                p.quantity AS stock
            FROM cart_items ci
            JOIN products p ON p.id = ci.product_id
            WHERE ci.user_id = ?
        `;
        db.query(sql, [userId], callback);
    },

    /**
     * Get a single cart line to check existing quantity.
     */
    getCartItem(userId, productId, callback) {
        const sql = 'SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?';
        db.query(sql, [userId, productId], (err, results) => {
            if (err) return callback(err);
            const row = results && results.length ? results[0] : null;
            callback(null, row);
        });
    },

    /**
     * Insert or set quantity for a cart line.
     */
    setItemQuantity(userId, productId, quantity, callback) {
        const sql = `
            INSERT INTO cart_items (user_id, product_id, quantity)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)
        `;
        db.query(sql, [userId, productId, quantity], callback);
    },

    /**
     * Remove a product from the cart.
     */
    removeItem(userId, productId, callback) {
        const sql = 'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?';
        db.query(sql, [userId, productId], callback);
    },

    /**
     * Delete all cart lines for a user.
     */
    clearCart(userId, callback) {
        const sql = 'DELETE FROM cart_items WHERE user_id = ?';
        db.query(sql, [userId], callback);
    }
};

module.exports = CartModel;
