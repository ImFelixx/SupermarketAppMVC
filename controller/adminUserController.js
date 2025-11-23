const connection = require("../db");
const crypto = require("crypto");

const adminUserController = {

    // 🔹 View all users
    viewAllUsers(req, res) {
        connection.query("SELECT * FROM users", (err, users) => {
            if (err) throw err;

            res.render("admin_users", {
                user: req.session.user,
                users
            });
        });
    },

    // 🔹 Add User Page
    addUserPage(req, res) {
        res.render("admin_add_user", {
            user: req.session.user,
            errors: req.flash("error"),
            messages: req.flash("success")
        });
    },

    // 🔹 Add User (POST)
    addUser(req, res) {
        const { username, email, password, role } = req.body;

        if (!username || !email || !password) {
            req.flash("error", "All fields required.");
            return res.redirect("/admin/users/add");
        }

        const hash = crypto.createHash("sha1").update(password).digest("hex");

        const sql = `
            INSERT INTO users (username, email, password, role)
            VALUES (?, ?, ?, ?)
        `;

        connection.query(sql, [username, email, hash, role], (err) => {
            if (err) throw err;

            req.flash("success", "New user added!");
            res.redirect("/admin/users");
        });
    },

    // 🔹 Edit user page
    editUserPage(req, res) {
        const id = req.params.id;

        connection.query("SELECT * FROM users WHERE id = ?", [id], (err, rows) => {
            if (err) throw err;

            res.render("admin_edit_user", {
                user: req.session.user,
                editUser: rows[0],
                errors: req.flash("error"),
                messages: req.flash("success")
            });
        });
    },

    // 🔹 Save updated user
    updateUser(req, res) {
        const id = req.params.id;
        const { username, email, role } = req.body;

        const sql = `
            UPDATE users SET username = ?, email = ?, role = ?
            WHERE id = ?
        `;

        connection.query(sql, [username, email, role, id], (err) => {
            if (err) throw err;

            req.flash("success", "User updated!");
            res.redirect("/admin/users");
        });
    }
};

module.exports = adminUserController;
