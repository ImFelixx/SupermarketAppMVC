const db = require('../db');

const ProductModel = {
    /**
     * Fetch products with optional search/filter/sort.
     */
    getAllProducts(options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        const { search, stockFilter, sort } = options || {};

        let sql = 'SELECT id, productName, quantity, price, image FROM products';
        const params = [];
        const where = [];

        if (search) {
            where.push('productName LIKE ?');
            params.push(`%${search}%`);
        }

        const stockClause = {
            low: 'quantity < 5',
            medium: 'quantity BETWEEN 5 AND 19',
            high: 'quantity >= 20'
        };

        if (stockFilter && stockClause[stockFilter]) {
            where.push(stockClause[stockFilter]);
        }

        if (where.length) {
            sql += ' WHERE ' + where.join(' AND ');
        }

        const sortMap = {
            name_asc: 'productName ASC',
            name_desc: 'productName DESC',
            stock_asc: 'quantity ASC',
            stock_desc: 'quantity DESC',
            price_asc: 'price ASC',
            price_desc: 'price DESC'
        };

        const orderBy = sortMap[sort] || 'productName ASC';
        sql += ` ORDER BY ${orderBy}`;

        db.query(sql, params, (err, results) => callback(err, results));
    },

    getProductById(id, callback) {
        const sql = 'SELECT id, productName, quantity, price, image FROM products WHERE id = ? LIMIT 1';
        db.query(sql, [id], (err, results) => {
            if (err) return callback(err);
            const product = results && results.length ? results[0] : null;
            return callback(null, product);
        });
    },

    addProduct(product, callback) {
        const sql = 'INSERT INTO products (productName, quantity, price, image) VALUES (?, ?, ?, ?)';
        const params = [product.productName, product.quantity, product.price, product.image];
        db.query(sql, params, (err, result) => {
            if (err) return callback(err);
            return callback(null, { insertId: result.insertId, affectedRows: result.affectedRows });
        });
    },

    updateProduct(id, product, callback) {
        const sql = 'UPDATE products SET productName = ?, quantity = ?, price = ?, image = ? WHERE id = ?';
        const params = [product.productName, product.quantity, product.price, product.image, id];
        db.query(sql, params, (err, result) => {
            if (err) return callback(err);
            return callback(null, { affectedRows: result.affectedRows });
        });
    },

    deleteProduct(id, callback) {
        const sql = 'DELETE FROM products WHERE id = ?';
        db.query(sql, [id], (err, result) => {
            if (err) return callback(err);
            return callback(null, { affectedRows: result.affectedRows });
        });
    },

    /**
     * Decrease stock for a product ensuring it doesn't go negative.
     */
    decrementStock(productId, quantity, callback) {
        const sql = `
            UPDATE products
            SET quantity = quantity - ?
            WHERE id = ? AND quantity >= ?
        `;
        db.query(sql, [quantity, productId, quantity], (err, result) => {
            if (err) return callback(err);
            return callback(null, { affectedRows: result.affectedRows });
        });
    },

    /**
     * Count all products (used in dashboards).
     */
    countAll(callback) {
        const sql = 'SELECT COUNT(*) AS totalProducts FROM products';
        db.query(sql, (err, results) => {
            if (err) return callback(err);
            const total = results && results.length ? results[0].totalProducts : 0;
            return callback(null, total);
        });
    },

    /**
     * Fetch products below a quantity threshold.
     */
    getLowStock(threshold, callback) {
        const sql = `
            SELECT * FROM products
            WHERE quantity < ?
            ORDER BY quantity ASC
        `;
        db.query(sql, [threshold], callback);
    }
};

module.exports = ProductModel;
