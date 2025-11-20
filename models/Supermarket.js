const db = require('../db');

const ProductModel = {
    getAllProducts(callback) {
        const sql = 'SELECT id, productName, quantity, price, image FROM products';
        db.query(sql, (err, results) => {
            return callback(err, results);
        });
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
    }
};

module.exports = ProductModel;
