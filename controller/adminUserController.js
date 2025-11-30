const connection = require("../db");
const crypto = require("crypto");

// Helper to count admins
function countAdmins(cb) {
    connection.query("SELECT COUNT(*) AS adminCount FROM users WHERE role = 'admin'", (err, rows) => {
        if (err) return cb(err);
        cb(null, rows[0].adminCount);
    });
}

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

        // Prevent creating only non-admin users when no admin exists
        countAdmins((err, adminCount) => {
            if (err) throw err;

            if (adminCount === 0 && role !== "admin") {
                req.flash("error", "You must have at least one admin. Create an admin account first.");
                return res.redirect("/admin/users/add");
            }

            const sql = `
                INSERT INTO users (username, email, password, role)
                VALUES (?, ?, ?, ?)
            `;

            connection.query(sql, [username, email, hash, role], (err2) => {
                if (err2) throw err2;

                req.flash("success", "New user added!");
                res.redirect("/admin/users");
            });
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
        const { username, email, role, address, contact } = req.body;

        // Fetch current user and admin count to prevent demoting the last admin
        connection.query("SELECT * FROM users WHERE id = ?", [id], (err, rows) => {
            if (err) throw err;
            const existingUser = rows[0];

            countAdmins((err2, adminCount) => {
                if (err2) throw err2;

                const demotingLastAdmin = existingUser.role === "admin" && role !== "admin" && adminCount <= 1;
                if (demotingLastAdmin) {
                    req.flash("error", "At least one admin must remain. Promote another admin before changing this role.");
                    return res.redirect(`/admin/users/edit/${id}`);
                }

                const sql = `
                    UPDATE users SET username = ?, email = ?, role = ?, address = ?, contact = ?
                    WHERE id = ?
                `;

                connection.query(sql, [username, email, role, address, contact, id], (err3) => {
                    if (err3) throw err3;

                    req.flash("success", "User updated!");
                    res.redirect("/admin/users");
                });
            });
        });
    },

    // 🔹 Delete user (with safeguard against removing last admin)
    deleteUser(req, res) {
        const id = req.params.id;

        // First check role and admin count
        connection.query("SELECT role FROM users WHERE id = ?", [id], (err, rows) => {
            if (err) throw err;
            const userRow = rows[0];
            if (!userRow) {
                req.flash("error", "User not found.");
                return res.redirect("/admin/users");
            }

            countAdmins((err2, adminCount) => {
                if (err2) throw err2;

                if (userRow.role === "admin" && adminCount <= 1) {
                    req.flash("error", "At least one admin must remain. Create another admin before deleting this account.");
                    return res.redirect("/admin/users");
                }

                connection.query("DELETE FROM users WHERE id = ?", [id], (err3) => {
                    if (err3) throw err3;
                    req.flash("success", "User deleted.");
                    res.redirect("/admin/users");
                });
            });
        });
    }
};

module.exports = adminUserController;
