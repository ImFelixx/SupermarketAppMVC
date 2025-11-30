const connection = require("../db");
const { generateInvoicePDF } = require("../utils/invoiceGenerator");

const adminOrderController = {

    viewAllOrders(req, res) {
        const sql = `
            SELECT o.*, u.username
            FROM orders o
            JOIN users u ON o.user_id = u.id
            ORDER BY o.id DESC
        `;

        connection.query(sql, (err, orders) => {
            if (err) throw err;
            res.render("admin_orders", { orders });
        });
    },

    viewOrderPage(req, res) {
        const orderId = req.params.id;

        const orderSQL = `
            SELECT o.*, u.username, u.email
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.id = ?
        `;

        const itemsSQL = `
            SELECT oi.*, p.productName
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `;

        connection.query(orderSQL, [orderId], (err, orderResult) => {
            if (err) throw err;
            const order = orderResult[0];

            connection.query(itemsSQL, [orderId], (err2, items) => {
                if (err2) throw err2;

                res.render("admin_order_view", { order, items });
            });
        });
    },

    editOrderPage(req, res) {
        const orderId = req.params.id;

        connection.query(
            "SELECT * FROM orders WHERE id = ?",
            [orderId],
            (err, results) => {
                if (err) throw err;

                res.render("admin_order_edit", {
                    order: results[0]
                });
            }
        );
    },

    // UPDATE ORDER DETAILS
    updateOrder(req, res) {
        const orderId = req.params.id;
        const { delivery_address, delivery_fee, status } = req.body;

        const subtotalSQL = `
            SELECT SUM(quantity * price) AS subtotal
            FROM order_items
            WHERE order_id = ?
        `;

        connection.query(subtotalSQL, [orderId], (err, result) => {
            if (err) throw err;

            // Force convert MySQL DECIMAL strings → JS numbers
            const subtotal = result[0].subtotal ? Number(result[0].subtotal) : 0;
            const fee = Number(delivery_fee);

            const newTotal = subtotal + fee;

            const updateSQL = `
                UPDATE orders
                SET delivery_address = ?, delivery_fee = ?, total = ?, status = ?
                WHERE id = ?
            `;

            connection.query(
                updateSQL,
                [delivery_address, fee.toFixed(2), newTotal.toFixed(2), status, orderId],
                (err2) => {
                    if (err2) throw err2;

                    req.flash("success", "Order updated successfully!");
                    res.redirect(`/admin/orders/${orderId}`);
                }
            );
        });
    },

    downloadInvoice(req, res) {
        const orderId = req.params.id;

        const orderSQL = `
            SELECT o.*, u.username, u.email
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.id = ?
        `;

        const itemsSQL = `
            SELECT oi.*, p.productName
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `;

        connection.query(orderSQL, [orderId], (err, orderResult) => {
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
                        name: order.username,
                        email: order.email
                    }
                });
            });
        });
    }


};

module.exports = adminOrderController;
