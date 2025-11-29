const connection = require('../db');
const Product = require('../models/supermarket');
const Cart = require('../models/cart');
const { generateInvoicePDF } = require("../utils/invoiceGenerator");

const orderController = {
    checkoutPage(req, res) {
        Cart.getCartItems(req.session.user.id, (err, cart) => {
            if (err || !cart || cart.length === 0) {
                req.flash("error", "Your cart is empty.");
                return res.redirect("/cart");
            }

            res.render("checkout", {
                cart,
                user: req.session.user
            });
        });
    },

    placeOrder(req, res) {
        const userId = req.session.user.id;
        const deliveryAddress = req.body.delivery_address;
        const deliveryMethod = req.body.delivery_method || 'normal';

        if (!deliveryAddress) {
            req.flash("error", "Delivery address is required.");
            return res.redirect("/checkout");
        }

        Cart.getCartItems(userId, (cartErr, cart) => {
            if (cartErr || !cart || !cart.length) {
                req.flash("error", "Your cart is empty.");
                return res.redirect("/cart");
            }

            // Calculate total
            let total = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

            // Map delivery method to fee
            const deliveryFeeMap = {
                pickup: 0,
                normal: 10,
                express: 15
            };

            const deliveryFee = deliveryFeeMap[deliveryMethod] ?? deliveryFeeMap.normal;
            total += deliveryFee;

            // Insert order
            const orderSql = `
                INSERT INTO orders (user_id, delivery_address, delivery_fee, total)
                VALUES (?, ?, ?, ?)
            `;

            connection.query(orderSql, [userId, deliveryAddress, deliveryFee, total], (err, result) => {
                if (err) throw err;

                const orderId = result.insertId;

                const itemsSql = `
                    INSERT INTO order_items (order_id, product_id, quantity, price)
                    VALUES ?
                `;

                const values = cart.map(item => [
                    orderId,
                    item.id,
                    item.quantity,
                    item.price
                ]);

                connection.query(itemsSql, [values], (err2) => {
                    if (err2) throw err2;

                    // --------------------------------
                    // UPDATE PRODUCT STOCK HERE
                    // --------------------------------
                    cart.forEach(item => {
                        Product.decrementStock(item.id, item.quantity, (err3) => {
                            if (err3) throw err3;
                        });
                    });

                    // Clear cart in DB
                    Cart.clearCart(userId, (clearErr) => {
                        if (clearErr) {
                            console.error('Error clearing cart after order:', clearErr);
                        }
                        req.flash("success", "Order placed successfully!");
                        res.redirect(`/orders/${orderId}`);
                    });
                });
            });
        });
    },

    viewUserOrders(req, res) {
        const userId = req.session.user.id;

        connection.query(
            "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
            [userId],
            (err, orders) => {
                if (err) throw err;
                res.render("orderhistory", { orders, user: req.session.user });
            }
        );
    },

    viewOrderDetails(req, res) {
        const orderId = req.params.id;

        // Fetch order info
        connection.query("SELECT * FROM orders WHERE id = ?", [orderId], (err, orderResult) => {
            if (err) throw err;

            const order = orderResult[0];

            connection.query(`
                SELECT oi.*, p.productName 
                FROM order_items oi 
                JOIN products p ON oi.product_id = p.id 
                WHERE oi.order_id = ?
            `, [orderId], (err2, items) => {

                res.render("orders", {
                    order,
                    items,
                    user: req.session.user
                });
            });
        });
    },

    downloadInvoice(req, res) {
        const orderId = req.params.id;
        const userId = req.session.user.id;

        const orderSQL = `
            SELECT * FROM orders
            WHERE id = ? AND user_id = ?
        `;

        const itemsSQL = `
            SELECT oi.*, p.productName
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `;

        connection.query(orderSQL, [orderId, userId], (err, orderResult) => {
            if (err) throw err;
            const order = orderResult[0];

            if (!order) {
                return res.status(404).send("Order not found.");
            }

            connection.query(itemsSQL, [orderId], (err2, items) => {
                if (err2) throw err2;

                generateInvoicePDF(res, {
                    order,
                    items,
                    customer: {
                        name: req.session.user.username,
                        email: req.session.user.email
                    }
                });
            });
        });
    }

};

module.exports = orderController;
