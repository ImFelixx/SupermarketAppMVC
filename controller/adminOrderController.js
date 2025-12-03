const Order = require("../models/order");
const { generateInvoicePDF } = require("../utils/invoiceGenerator");
const { toCSV } = require("../utils/csv");

const adminOrderController = {

    viewAllOrders(req, res) {
        const { search = '', status = '', sort = 'id_desc', dateFrom = '', dateTo = '' } = req.query || {};

        Order.getAllOrdersWithUserFiltered({ search, status, sort, dateFrom, dateTo }, (err, orders) => {
            if (err) throw err;
            const filterQuery = new URLSearchParams({ search, status, sort, dateFrom, dateTo }).toString();
            res.render("admin_orders", { orders, filters: { search, status, sort, dateFrom, dateTo }, filterQuery });
        });
    },

    viewOrderPage(req, res) {
        const orderId = req.params.id;

        Order.getOrderWithUser(orderId, (err, order) => {
            if (err) throw err;
            if (!order) return res.status(404).send("Order not found.");

            Order.getOrderItems(orderId, (err2, items) => {
                if (err2) throw err2;
                res.render("admin_order_view", { order, items });
            });
        });
    },

    editOrderPage(req, res) {
        const orderId = req.params.id;

        Order.getOrderById(orderId, (err, order) => {
            if (err) throw err;
            res.render("admin_order_edit", {
                order
            });
        });
    },

    // UPDATE ORDER DETAILS
    updateOrder(req, res) {
        const orderId = req.params.id;
        const { delivery_address, delivery_fee, status } = req.body;

        Order.updateOrderTotals(orderId, { delivery_address, delivery_fee, status }, (err) => {
            if (err) throw err;

            req.flash("success", "Order updated successfully!");
            res.redirect(`/admin/orders/${orderId}`);
        });
    },

    downloadInvoice(req, res) {
        const orderId = req.params.id;

        Order.getOrderWithUser(orderId, (err, order) => {
            if (err) throw err;
            if (!order) {
                return res.status(404).send("Order not found.");
            }

            Order.getOrderItems(orderId, (err2, items) => {
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
    },

    exportOrdersCsv(req, res) {
        const { search = '', status = '', sort = 'id_desc', dateFrom = '', dateTo = '' } = req.query || {};

        Order.getAllOrdersWithUserFiltered({ search, status, sort, dateFrom, dateTo }, (err, orders) => {
            if (err) {
                console.error('Error exporting orders:', err);
                return res.status(500).send("Failed to export orders.");
            }

            const rows = orders.map(o => ({
                id: o.id,
                user: o.username,
                status: o.status,
                total: Number(o.total).toFixed(2),
                delivery_fee: Number(o.delivery_fee).toFixed(2),
                delivery_address: o.delivery_address,
                created_at: o.created_at ? new Date(o.created_at).toISOString() : ''
            }));

            const csv = toCSV(rows, [
                { key: 'id', label: 'Order ID' },
                { key: 'user', label: 'User' },
                { key: 'status', label: 'Status' },
                { key: 'total', label: 'Total' },
                { key: 'delivery_fee', label: 'Delivery Fee' },
                { key: 'delivery_address', label: 'Delivery Address' },
                { key: 'created_at', label: 'Created At' }
            ]);

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
            return res.send(csv);
        });
    }


};

module.exports = adminOrderController;
