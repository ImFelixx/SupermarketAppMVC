const Order = require("../models/order");

const dashboardController = {
    viewDashboard(req, res) {
        const userId = req.session.user.id;

        Order.getTotalOrdersForUser(userId, (err, totalOrders) => {
            if (err) throw err;

            Order.getTotalSpentForUser(userId, (err2, totalSpentRaw) => {
                if (err2) throw err2;

                const totalSpent = Number(totalSpentRaw) || 0;

                // ================= LAST 5 VIEWED =================
                const lastViewed = req.session.viewedProducts || [];

                const lastViewedConverted = lastViewed.map(v => ({
                    ...v,
                    price: Number(v.price)
                }));

                // ================= LAST 15 BOUGHT =================
                Order.getRecentItemsBought(userId, 15, (err3, lastBought) => {
                    if (err3) throw err3;

                    const lastBoughtConverted = lastBought.map(item => ({
                        ...item,
                        price: Number(item.price),
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
