const connection = require("../db");

const dashboardController = {
    viewDashboard(req, res) {
        const userId = req.session.user.id;

        // ================= TOTAL ORDERS =================
        const totalOrdersSQL = `
            SELECT COUNT(*) AS totalOrders
            FROM orders
            WHERE user_id = ?
        `;

        connection.query(totalOrdersSQL, [userId], (err, result1) => {
            const totalOrders = result1[0].totalOrders;

            // ================= TOTAL SPENT =================
            const totalSpentSQL = `
                SELECT SUM(total) AS totalSpent
                FROM orders
                WHERE user_id = ?
            `;

            connection.query(totalSpentSQL, [userId], (err2, result2) => {
                let totalSpent = Number(result2[0].totalSpent) || 0;  // ⭐ FIXED

                // ================= LAST 5 VIEWED =================
                const lastViewed = req.session.viewedProducts || [];

                const lastViewedConverted = lastViewed.map(v => ({
                    ...v,
                    price: Number(v.price)
                }));

                // ================= LAST 5 BOUGHT =================
                const lastBoughtSQL = `
                    SELECT p.productName, p.image, oi.quantity, oi.price
                    FROM order_items oi
                    JOIN products p ON p.id = oi.product_id
                    JOIN orders o ON o.id = oi.order_id
                    WHERE o.user_id = ?
                    ORDER BY o.created_at DESC
                    LIMIT 5
                `;

                connection.query(lastBoughtSQL, [userId], (err3, lastBought) => {

                    const lastBoughtConverted = lastBought.map(item => ({
                        ...item,
                        price: Number(item.price),   // ⭐ FIXED
                        quantity: Number(item.quantity)
                    }));

                    // ================= TOTAL ITEMS BOUGHT =================
                    const totalItemsBought = lastBoughtConverted.reduce(
                        (sum, item) => sum + item.quantity,
                        0
                    );

                    // ================= RENDER =================
                    res.render("dashboard", {
                        user: req.session.user,
                        totalOrders,
                        totalSpent,
                        lastViewed: lastViewedConverted,
                        lastBought: lastBoughtConverted,
                        totalItemsBought
                    });
                });
            });
        });
    }
};

module.exports = dashboardController;
