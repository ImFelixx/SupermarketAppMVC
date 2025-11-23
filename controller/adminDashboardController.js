const connection = require("../db");

const adminDashboardController = {

    viewDashboard(req, res) {

        const statsSQL = `
            SELECT 
                (SELECT COUNT(*) FROM products) AS totalProducts,
                (SELECT COUNT(*) FROM orders) AS totalOrders,
                (SELECT IFNULL(SUM(total),0) FROM orders) AS totalRevenue,
                (SELECT COUNT(*) FROM users) AS totalUsers
        `;

        const monthlySalesSQL = `
            SELECT 
                DATE_FORMAT(created_at, '%Y-%m') AS month,
                SUM(total) AS revenue
            FROM orders
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY month ASC;
        `;

        const userBreakdownSQL = `
            SELECT role, COUNT(*) AS count
            FROM users
            GROUP BY role;
        `;

        const recentOrdersSQL = `
            SELECT o.*, u.username
            FROM orders o
            JOIN users u ON o.user_id = u.id
            ORDER BY o.id DESC
            LIMIT 5;
        `;

        const lowStockSQL = `
            SELECT * FROM products
            WHERE quantity < 10
            ORDER BY quantity ASC;
        `;

        connection.query(statsSQL, (err, stats) => {
            if (err) throw err;
            const s = stats[0];

            connection.query(monthlySalesSQL, (err2, monthlySales) => {
                if (err2) throw err2;

                connection.query(userBreakdownSQL, (err3, usersBreakdown) => {
                    if (err3) throw err3;

                    connection.query(recentOrdersSQL, (err4, recentOrders) => {
                        if (err4) throw err4;

                        connection.query(lowStockSQL, (err5, lowStock) => {
                            if (err5) throw err5;

                            res.render("admin_dashboard", {
                                totalProducts: s.totalProducts,
                                totalOrders: s.totalOrders,
                                totalRevenue: s.totalRevenue,
                                totalUsers: s.totalUsers,
                                monthlySales,
                                usersBreakdown,
                                recentOrders,
                                lowStock
                            });

                        });
                    });
                });
            });
        });
    }

};

module.exports = adminDashboardController;
