const Product = require("../models/supermarket");
const Order = require("../models/order");
const User = require("../models/user");

const adminDashboardController = {

    viewDashboard(req, res) {

        Product.countAll((err, totalProducts) => {
            if (err) throw err;

            Order.getTotalOrdersCount((errStats, totalOrders) => {
                if (errStats) throw errStats;

                Order.getTotalRevenue((err2, totalRevenue) => {
                    if (err2) throw err2;

                    User.getTotalUsers((err3, totalUsers) => {
                        if (err3) throw err3;

                        Order.getMonthlySales((err4, monthlySales) => {
                            if (err4) throw err4;

                            User.getUserRoleBreakdown((err5, usersBreakdown) => {
                                if (err5) throw err5;

                                Order.getRecentOrders(5, (err6, recentOrders) => {
                                    if (err6) throw err6;

                                    Product.getLowStock(10, (err7, lowStock) => {
                                        if (err7) throw err7;

                                        res.render("admin_dashboard", {
                                            totalProducts,
                                            totalOrders,
                                            totalRevenue,
                                            totalUsers,
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
                });
            });
        });
    }

};

module.exports = adminDashboardController;
