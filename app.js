const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const connection = require('./db');
const app = express();
const Product = require('./models/supermarket');

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

// -------------------- GLOBAL CART + CART COUNT --------------------
app.use((req, res, next) => {
    res.locals.cart = req.session.cart || [];

    res.locals.cartCount = req.session.cart
        ? req.session.cart.reduce((sum, item) => sum + item.quantity, 0)
        : 0;

    next();
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

// Register
app.get("/register", (req, res) => {
    res.render("register", { 
        messages: req.flash("error"), 
        formData: req.flash("formData")[0] 
    });
});

app.post("/register", validateRegistration, (req, res) => {
    const { username, email, password, address, contact, role } = req.body;

    // 1️⃣ CHECK IF EMAIL ALREADY EXISTS
    const checkEmailSql = "SELECT * FROM users WHERE email = ?";
    connection.query(checkEmailSql, [email], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            req.flash("error", "Email already exists, please login.");
            req.flash("formData", req.body);
            return res.redirect("/register");
        }

        // 2️⃣ OTHERWISE PROCEED TO REGISTER
        const insertSql = `
            INSERT INTO users (username, email, password, address, contact, role)
            VALUES (?, ?, SHA1(?), ?, ?, ?)
        `;

        connection.query(
            insertSql,
            [username, email, password, address, contact, role],
            (err2) => {
                if (err2) throw err2;

                req.flash("success", "Registration successful! Please log in.");
                res.redirect("/login");
            }
        );
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

    // 1️⃣ CHECK IF EMAIL EXISTS
    const findEmailSql = "SELECT * FROM users WHERE email = ?";
    connection.query(findEmailSql, [email], (err, results) => {
        if (err) throw err;

        if (results.length === 0) {
            req.flash("error", "Email doesn't exist, please sign up.");
            return res.redirect("/login");
        }

        // 2️⃣ EMAIL EXISTS → CHECK PASSWORD
        const user = results[0];
        const checkPwSql = `
            SELECT * FROM users WHERE email = ? AND password = SHA1(?)
        `;

        connection.query(checkPwSql, [email, password], (err2, pwMatch) => {
            if (err2) throw err2;

            if (pwMatch.length === 0) {
                req.flash("error", "Incorrect password.");
                return res.redirect("/login");
            }

            // 3️⃣ SUCCESS → LOGIN USER
            req.session.user = pwMatch[0];
            req.flash("success", "Login successful!");

            return req.session.user.role === "user"
                ? res.redirect("/shopping")
                : res.redirect("/inventory");
        });
    });
});

// Shopping Page
app.get("/shopping", checkAuthenticated, (req, res) => {
    Product.getAllProducts((err, products) => {
        res.render("shopping", {
            products,
            user: req.session.user,
            messages: req.flash("success"),
            errors: req.flash("error")
        });
    });
});

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

        if (!req.session.cart) req.session.cart = [];

        const existing = req.session.cart.find(p => p.id === product.id);

        if (existing) {
            if (existing.quantity + quantity > product.quantity) {
                req.flash("error", `Cannot exceed stock quantity (${product.quantity}).`);
                return res.redirect("/shopping");
            }

            existing.quantity += quantity;
            existing.stock = product.quantity;   // keep stock updated

        } else {
            req.session.cart.push({
                id: product.id,
                productName: product.productName,
                price: product.price,
                quantity,
                image: product.image,
                stock: product.quantity  // ⭐ add stock info
            });
        }

        req.flash("success", `Added ${quantity} × ${product.productName} to cart`);
        res.redirect("/shopping");
    });
});

app.post("/remove-from-cart/:index", checkAuthenticated, (req, res) => {
    const index = parseInt(req.params.index, 10);

    if (req.session.cart[index]) {
        req.session.cart.splice(index, 1);
    }

    res.redirect('/cart');
});

app.post("/update-cart/:index", checkAuthenticated, (req, res) => {
    const index = parseInt(req.params.index, 10);
    let qty = parseInt(req.body.quantity, 10);

    if (!req.session.cart[index]) return res.redirect("/cart");

    const item = req.session.cart[index];

    // Fetch product from DB to compare stock
    Product.getProductById(item.id, (err, product) => {
        if (err || !product) return res.redirect("/cart");

        if (qty < 1) qty = 1;

        // ❗ Prevent exceeding stock
        if (qty > product.quantity) {
            req.flash("error", `Only ${product.quantity} left in stock.`);
            return res.redirect("/cart");
        }

        req.session.cart[index].quantity = qty;
        req.flash("success", "Quantity updated!");
        res.redirect("/cart");
    });
});

// Cart
app.get("/cart", checkAuthenticated, (req, res) => {
    const cart = req.session.cart || [];
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

// Orders
app.get("/checkout", checkAuthenticated, orderController.checkoutPage);
app.post("/place-order", checkAuthenticated, orderController.placeOrder);
app.get("/orders", checkAuthenticated, orderController.viewUserOrders);
app.get("/orders/:id", checkAuthenticated, orderController.viewOrderDetails);
app.get("/orderhistory", checkAuthenticated, orderController.viewUserOrders);

// -------------------- USER PROFILE --------------------
app.get("/profile", checkAuthenticated, userController.viewProfile);
app.post("/profile/update", checkAuthenticated, userController.updateProfile);

// -------------------- CHANGE PASSWORD --------------------
app.get("/password", checkAuthenticated, userController.viewPasswordPage);
app.post("/change-password", checkAuthenticated, userController.updatePassword);

app.get("/dashboard", checkAuthenticated, dashboardController.viewDashboard);

// -------------------- ADMIN - ORDERS --------------------
app.get("/admin/orders", checkAuthenticated, checkAdmin, adminOrderController.viewAllOrders);

// View single order
app.get("/admin/orders/:id", checkAuthenticated, checkAdmin, adminOrderController.viewOrderPage);

// Edit order
app.get("/admin/orders/edit/:id", checkAuthenticated, checkAdmin, adminOrderController.editOrderPage);
app.post("/admin/orders/edit/:id", checkAuthenticated, checkAdmin, adminOrderController.updateOrder);

// -------------------- ADMIN - USERS --------------------
app.get("/admin/users", checkAuthenticated, checkAdmin, adminUserController.viewAllUsers);
app.get("/admin/users/add", checkAuthenticated, checkAdmin, adminUserController.addUserPage);
app.post("/admin/users/add", checkAuthenticated, checkAdmin, adminUserController.addUser);
app.get("/admin/users/edit/:id", checkAuthenticated, checkAdmin, adminUserController.editUserPage);
app.post("/admin/users/edit/:id", checkAuthenticated, checkAdmin, adminUserController.updateUser);

// ----------------- ADMIN DASHBOARD -----------------
app.get("/admin/dashboard", checkAuthenticated, checkAdmin, adminDashboardController.viewDashboard);

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
