const User = require("../models/user");
const { toCSV } = require("../utils/csv");

const adminUserController = {

    // 🔹 View all users
    viewAllUsers(req, res) {
        const { search = '', role = '', sort = 'id_desc' } = req.query || {};

        User.getAllFiltered({ search, role, sort }, (err, users) => {
            if (err) throw err;

            res.render("admin_users", {
                user: req.session.user,
                users,
                filters: { search, role, sort },
                filterQuery: new URLSearchParams({ search, role, sort }).toString()
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

        // Prevent creating only non-admin users when no admin exists
        User.countAdmins((err, adminCount) => {
            if (err) throw err;

            if (adminCount === 0 && role !== "admin") {
                req.flash("error", "You must have at least one admin. Create an admin account first.");
                return res.redirect("/admin/users/add");
            }

            User.create({ username, email, password, role }, (err2) => {
                if (err2) throw err2;
                req.flash("success", "New user added!");
                res.redirect("/admin/users");
            });
        });
    },

    // 🔹 Edit user page
    editUserPage(req, res) {
        const id = req.params.id;

        User.getById(id, (err, user) => {
            if (err) throw err;

            res.render("admin_edit_user", {
                user: req.session.user,
                editUser: user,
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
        User.getById(id, (err, existingUser) => {
            if (err) throw err;

            User.countAdmins((err2, adminCount) => {
                if (err2) throw err2;

                const demotingLastAdmin = existingUser.role === "admin" && role !== "admin" && adminCount <= 1;
                if (demotingLastAdmin) {
                    req.flash("error", "At least one admin must remain. Promote another admin before changing this role.");
                    return res.redirect(`/admin/users/edit/${id}`);
                }

                User.updateUser(id, { username, email, role, address, contact }, (err3) => {
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
        User.getById(id, (err, userRow) => {
            if (err) throw err;
            if (!userRow) {
                req.flash("error", "User not found.");
                return res.redirect("/admin/users");
            }

            User.countAdmins((err2, adminCount) => {
                if (err2) throw err2;

                if (userRow.role === "admin" && adminCount <= 1) {
                    req.flash("error", "At least one admin must remain. Create another admin before deleting this account.");
                    return res.redirect("/admin/users");
                }

                User.deleteUser(id, (err3) => {
                    if (err3) throw err3;
                    req.flash("success", "User deleted.");
                    res.redirect("/admin/users");
                });
            });
        });
    },

    exportUsersCsv(req, res) {
        const { search = '', role = '', sort = 'id_desc' } = req.query || {};

        User.getAllFiltered({ search, role, sort }, (err, users) => {
            if (err) {
                console.error('Error exporting users:', err);
                return res.status(500).send("Failed to export users.");
            }

            const rows = users.map(u => ({
                id: u.id,
                username: u.username,
                email: u.email,
                role: u.role,
                contact: u.contact || '',
                address: u.address || ''
            }));

            const csv = toCSV(rows, [
                { key: 'id', label: 'User ID' },
                { key: 'username', label: 'Username' },
                { key: 'email', label: 'Email' },
                { key: 'role', label: 'Role' },
                { key: 'contact', label: 'Contact' },
                { key: 'address', label: 'Address' }
            ]);

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
            return res.send(csv);
        });
    }
};

module.exports = adminUserController;
