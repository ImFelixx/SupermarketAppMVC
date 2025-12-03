const Product = require('../models/supermarket');
const Cart = require('../models/cart');
const Order = require('../models/order');
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
        const deliveryMethod = req.body.delivery_method || 'normal';
        let deliveryAddress = req.body.delivery_address;

        // Address handling: allow pickup without address
        if (deliveryMethod === 'pickup') {
            deliveryAddress = 'Pickup in store';
        } else if (!deliveryAddress) {
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

            const orderItems = cart.map(item => ({
                product_id: item.id,
                quantity: item.quantity,
                price: item.price
            }));

            Order.createOrderWithItems(
                { userId, deliveryAddress, deliveryFee, total, items: orderItems },
                (err, orderId) => {
                    if (err) {
                        console.error('Error creating order:', err);
                        req.flash("error", "Failed to place order.");
                        return res.redirect("/checkout");
                    }

                    const decrementPromises = cart.map(item =>
                        new Promise((resolve, reject) => {
                            Product.decrementStock(item.id, item.quantity, (err3) => {
                                if (err3) return reject(err3);
                                return resolve();
                            });
                        })
                    );

                    Promise.all(decrementPromises)
                        .catch(errDec => {
                            console.error('Error decrementing stock:', errDec);
                            req.flash("error", "Order placed but stock update failed. Please contact support.");
                        })
                        .finally(() => {
                            Cart.clearCart(userId, (clearErr) => {
                                if (clearErr) {
                                    console.error('Error clearing cart after order:', clearErr);
                                }
                                req.flash("success", "Order placed successfully!");
                                res.redirect(`/orders/${orderId}`);
                            });
                        });
                }
            );
        });
    },

    viewUserOrders(req, res) {
        const userId = req.session.user.id;

        Order.getOrdersByUser(userId, (err, orders) => {
            if (err) throw err;
            res.render("orderhistory", { orders, user: req.session.user });
        });
    },

    viewOrderDetails(req, res) {
        const orderId = req.params.id;

        Order.getOrderById(orderId, (err, order) => {
            if (err) throw err;
            if (!order) return res.status(404).send("Order not found.");

            Order.getOrderItems(orderId, (err2, items) => {
                if (err2) throw err2;

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

        Order.getOrderForUser(orderId, userId, (err, order) => {
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
                        name: req.session.user.username,
                        email: req.session.user.email
                    }
                });
            });
        });
    }

};

module.exports = orderController;
