const connection = require('../db');

const orderController = {
    checkoutPage(req, res) {
        if (!req.session.cart || req.session.cart.length === 0) {
            req.flash("error", "Your cart is empty.");
            return res.redirect("/cart");
        }

        res.render("checkout", {
            cart: req.session.cart,
            user: req.session.user
        });
    },

    placeOrder(req, res) {
        const userId = req.session.user.id;
        const cart = req.session.cart || [];
        const deliveryAddress = req.body.delivery_address;
        const deliveryFee = 10;

        if (!cart.length) {
            req.flash("error", "Your cart is empty.");
            return res.redirect("/cart");
        }

        if (!deliveryAddress) {
            req.flash("error", "Delivery address is required.");
            return res.redirect("/checkout");
        }

        // Calculate total
        let total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
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
                    const updateStockSql = `
                        UPDATE products
                        SET quantity = quantity - ?
                        WHERE id = ? AND quantity >= ?
                    `;

                    connection.query(updateStockSql, [item.quantity, item.id, item.quantity], (err3) => {
                        if (err3) throw err3;
                    });
                });

                // Clear cart
                req.session.cart = [];

                req.flash("success", "Order placed successfully!");
                res.redirect(`/orders/${orderId}`);
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
    }

};

module.exports = orderController;