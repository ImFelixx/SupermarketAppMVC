const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();
const Product = require('./models/supermarket');
const Cart = require('./models/cart');
const User = require('./models/user');

// -------------------- MULTER (IMAGE UPLOAD) --------------------
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/images'),
    filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// -------------------- EXPRESS SETUP --------------------
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

// -------------------- SESSION --------------------
app.use(
    session({
        secret: 'secret',
        resave: false,
        saveUninitialized: true,
        cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
    })
);

app.use(flash());

// -------------------- GLOBAL USER --------------------
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// -------------------- GLOBAL CART + CART COUNT (DB-BACKED) --------------------
app.use((req, res, next) => {
    if (!req.session.user) {
        req.cart = [];
        res.locals.cart = [];
        res.locals.cartCount = 0;
        return next();
    }

    const userId = req.session.user.id;
    Cart.getCartItems(userId, (err, items) => {
        if (err) {
            console.error('Error loading cart for user', userId, err);
            req.cart = [];
            res.locals.cart = [];
            res.locals.cartCount = 0;
            return next();
        }
        req.cart = items || [];
        res.locals.cart = req.cart;
        res.locals.cartCount = req.cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        return next();
    });
});

// -------------------- AUTH MIDDLEWARE --------------------
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    req.flash('error', 'Please log in to view this page.');
    res.redirect('/login');
};

const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') return next();
    req.flash('error', 'Access denied.');
    res.redirect('/shopping');
};

const checkAdminOrLogistics = (req, res, next) => {
    if (req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'logistics')) {
        return next();
    }
    req.flash('error', 'Access denied.');
    res.redirect('/shopping');
};

// -------------------- VALIDATION --------------------
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact, role } = req.body;

    if (!username || !email || !password || !address || !contact || !role) {
        return res.status(400).send("All fields are required.");
    }

    if (password.length < 6) {
        req.flash("error", "Password must be at least 6 characters.");
        req.flash("formData", req.body);
        return res.redirect("/register");
    }
    next();
};

// -------------------- CONTROLLERS --------------------
const supermarketController = require("./controller/supermarketController");
const orderController = require("./controller/orderController");
const userController = require("./controller/userController");
const dashboardController = require("./controller/dashboardController");
const adminOrderController = require("./controller/adminOrderController");
const adminUserController = require("./controller/adminUserController");
const adminDashboardController = require("./controller/adminDashboardController");

// -------------------- HEADER --------------------

app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    next();
});

// -------------------- ROUTES --------------------

// Home
app.get("/", (req, res) => {
    res.render("index", { user: req.session.user });
});

// Inventory (Admin)
app.get("/inventory", checkAuthenticated, checkAdmin, supermarketController.listInventory);
app.get("/admin/export/products", checkAuthenticated, checkAdmin, supermarketController.exportInventoryCsv);

// Register
app.get("/register", (req, res) => {
    res.render("register", { 
        messages: req.flash("error"), 
        formData: req.flash("formData")[0] 
    });
});

app.post("/register", validateRegistration, (req, res) => {
    const { username, email, password, address, contact, role } = req.body;

    User.getByEmail(email, (err, existingUser) => {
        if (err) throw err;

        if (existingUser) {
            req.flash("error", "Email already exists, please login.");
            req.flash("formData", req.body);
            return res.redirect("/register");
        }

        User.create({ username, email, password, address, contact, role }, (err2) => {
            if (err2) throw err2;

            req.flash("success", "Registration successful! Please log in.");
            res.redirect("/login");
        });
    });
});

// Login
app.get("/login", (req, res) => {
    res.render("login", {
        messages: req.flash("success"),
        errors: req.flash("error")
    });
});

app.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        req.flash("error", "All fields are required.");
        return res.redirect("/login");
    }

    User.validateCredentials(email, password, (err, user) => {
        if (err) throw err;

        if (!user) {
            req.flash("error", "Invalid email or password.");
            return res.redirect("/login");
        }

        req.session.user = user;
        req.flash("success", "Login successful!");

        if (req.session.user.role === "user") {
            return res.redirect("/shopping");
        }
        if (req.session.user.role === "logistics") {
            return res.redirect("/admin/orders");
        }
        return res.redirect("/inventory");
    });
});

// Shopping Page
app.get("/shopping", checkAuthenticated, supermarketController.listShopping);

// Add to Cart
app.post("/add-to-cart/:id", checkAuthenticated, (req, res) => {
    const productId = Number(req.params.id);
    const quantity = Number(req.body.quantity);

    Product.getProductById(productId, (err, product) => {
        if (!product) {
            req.flash("error", "Item not found.");
            return res.redirect("/shopping");
        }

        if (quantity > product.quantity) {
            req.flash("error", `Only ${product.quantity} left in stock.`);
            return res.redirect("/shopping");
        }

        const existing = (req.cart || []).find(p => p.id === product.id);
        const newQty = (existing ? existing.quantity : 0) + quantity;

        if (newQty > product.quantity) {
            req.flash("error", `Cannot exceed stock quantity (${product.quantity}).`);
            return res.redirect("/shopping");
        }

        Cart.setItemQuantity(req.session.user.id, product.id, newQty, (err4) => {
            if (err4) {
                console.error('Error saving cart item:', err4);
                req.flash("error", "Failed to add to cart.");
                return res.redirect("/shopping");
            }

            req.flash("success", `Added ${quantity} × ${product.productName} to cart`);
            return res.redirect("/shopping");
        });
    });
});

app.post("/remove-from-cart/:productId", checkAuthenticated, (req, res) => {
    const productId = parseInt(req.params.productId, 10);
    if (Number.isNaN(productId)) return res.redirect('/cart');

    Cart.removeItem(req.session.user.id, productId, (err) => {
        if (err) {
            console.error('Error removing cart item:', err);
            req.flash("error", "Failed to remove item.");
        }
        res.redirect('/cart');
    });
});

app.post("/clear-cart", checkAuthenticated, (req, res) => {
    Cart.clearCart(req.session.user.id, (err) => {
        if (err) {
            console.error('Error clearing cart:', err);
            req.flash("error", "Failed to clear your cart.");
        } else {
            req.flash("success", "All items removed from your cart.");
        }
        res.redirect("/cart");
    });
});

app.post("/update-cart/:productId", checkAuthenticated, (req, res) => {
    const productId = parseInt(req.params.productId, 10);
    let qty = parseInt(req.body.quantity, 10);

    if (Number.isNaN(productId)) return res.redirect("/cart");

    if (Number.isNaN(qty) || qty < 1) qty = 1;

    Product.getProductById(productId, (err, product) => {
        if (err || !product) return res.redirect("/cart");

        if (qty > product.quantity) {
            req.flash("error", `Only ${product.quantity} left in stock.`);
            return res.redirect("/cart");
        }

        Cart.setItemQuantity(req.session.user.id, productId, qty, (err2) => {
            if (err2) {
                console.error('Error updating cart quantity:', err2);
                req.flash("error", "Failed to update quantity.");
            } else {
                req.flash("success", "Quantity updated!");
            }
            res.redirect("/cart");
        });
    });
});

// Cart
app.get("/cart", checkAuthenticated, (req, res) => {
    const cart = req.cart || [];
    res.render("cart", {
        cart,
        user: req.session.user
    });
});

// Logout
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

// Product Page
app.get("/product/:id", checkAuthenticated, supermarketController.viewProduct);

// Admin Product CRUD
app.get("/addProduct", checkAuthenticated, checkAdmin, supermarketController.showAddProduct);
app.post("/addProduct", checkAuthenticated, checkAdmin, upload.single("image"), supermarketController.addProduct);

app.get("/updateProduct/:id", checkAuthenticated, checkAdmin, supermarketController.showUpdateProduct);
app.post("/updateProduct/:id", checkAuthenticated, checkAdmin, upload.single("image"), supermarketController.updateProduct);

app.get("/deleteProduct/:id", checkAuthenticated, checkAdmin, supermarketController.deleteProduct);
app.post("/deleteProduct/:id", checkAuthenticated, checkAdmin, supermarketController.deleteProduct);

// Orders
app.get("/checkout", checkAuthenticated, orderController.checkoutPage);
app.post("/place-order", checkAuthenticated, orderController.placeOrder);
app.get("/orders", checkAuthenticated, orderController.viewUserOrders);
app.get("/orders/:id", checkAuthenticated, orderController.viewOrderDetails);
app.get("/orders/:id/invoice", checkAuthenticated, orderController.downloadInvoice);
app.get("/orderhistory", checkAuthenticated, orderController.viewUserOrders);

// -------------------- USER PROFILE --------------------
app.get("/profile", checkAuthenticated, userController.viewProfile);
app.post("/profile/update", checkAuthenticated, userController.updateProfile);

// -------------------- CHANGE PASSWORD --------------------
app.get("/password", checkAuthenticated, userController.viewPasswordPage);
app.post("/change-password", checkAuthenticated, userController.updatePassword);

app.get("/dashboard", checkAuthenticated, dashboardController.viewDashboard);

// -------------------- ADMIN/LOGISTICS - ORDERS --------------------
app.get("/admin/orders", checkAuthenticated, checkAdminOrLogistics, adminOrderController.viewAllOrders);
app.get("/admin/export/orders", checkAuthenticated, checkAdminOrLogistics, adminOrderController.exportOrdersCsv);

// View single order
app.get("/admin/orders/:id", checkAuthenticated, checkAdminOrLogistics, adminOrderController.viewOrderPage);
app.get("/admin/orders/:id/invoice", checkAuthenticated, checkAdminOrLogistics, adminOrderController.downloadInvoice);

// Edit order
app.get("/admin/orders/edit/:id", checkAuthenticated, checkAdminOrLogistics, adminOrderController.editOrderPage);
app.post("/admin/orders/edit/:id", checkAuthenticated, checkAdminOrLogistics, adminOrderController.updateOrder);

// -------------------- ADMIN - USERS --------------------
app.get("/admin/users", checkAuthenticated, checkAdmin, adminUserController.viewAllUsers);
app.get("/admin/export/users", checkAuthenticated, checkAdmin, adminUserController.exportUsersCsv);
app.get("/admin/users/add", checkAuthenticated, checkAdmin, adminUserController.addUserPage);
app.post("/admin/users/add", checkAuthenticated, checkAdmin, adminUserController.addUser);
app.get("/admin/users/edit/:id", checkAuthenticated, checkAdmin, adminUserController.editUserPage);
app.post("/admin/users/edit/:id", checkAuthenticated, checkAdmin, adminUserController.updateUser);
app.post("/admin/users/delete/:id", checkAuthenticated, checkAdmin, adminUserController.deleteUser);

// ----------------- ADMIN/LOGISTICS DASHBOARD -----------------
app.get("/admin/dashboard", checkAuthenticated, checkAdminOrLogistics, adminDashboardController.viewDashboard);

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
