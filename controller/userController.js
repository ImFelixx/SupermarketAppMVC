const connection = require("../db");
const crypto = require("crypto");

const userController = {

    // -------------------------------------------------------
    // 1️⃣ VIEW PROFILE PAGE
    // -------------------------------------------------------
    viewProfile(req, res) {
        const user = req.session.user;

        res.render("profile", {
            user,
            messages: req.flash("success"),
            errors: req.flash("error")
        });
    },

    // -------------------------------------------------------
    // 2️⃣ UPDATE PROFILE (username, email, contact, address)
    // -------------------------------------------------------
    updateProfile(req, res) {
        const userId = req.session.user.id;
        const { username, email, contact, address } = req.body;

        // Validate fields
        if (!username || !email || !contact || !address) {
            req.flash("error", "All fields are required.");
            return res.redirect("/profile");
        }

        // ❗ Check if email already exists for another user
        const checkEmailSQL = `
            SELECT id FROM users WHERE email = ? AND id != ?
        `;

        connection.query(checkEmailSQL, [email, userId], (err, result) => {
            if (err) throw err;

            if (result.length > 0) {
                req.flash("error", "Email already exists. Please use another email.");
                return res.redirect("/profile");
            }

            // Update user details
            const updateSQL = `
                UPDATE users 
                SET username = ?, email = ?, contact = ?, address = ?
                WHERE id = ?
            `;

            connection.query(updateSQL, [username, email, contact, address, userId], (err2) => {
                if (err2) throw err2;

                // Update session user
                req.session.user.username = username;
                req.session.user.email = email;
                req.session.user.contact = contact;
                req.session.user.address = address;

                req.flash("success", "Profile updated successfully.");
                res.redirect("/profile");
            });
        });
    },

    // -------------------------------------------------------
    // 3️⃣ VIEW CHANGE PASSWORD PAGE
    // -------------------------------------------------------
    viewPasswordPage(req, res) {
        res.render("password", {
            user: req.session.user,
            messages: req.flash("success"),
            errors: req.flash("error")
        });
    },

    // -------------------------------------------------------
    // 4️⃣ UPDATE PASSWORD
    // -------------------------------------------------------
    updatePassword(req, res) {
        const userId = req.session.user.id;
        const { old_password, new_password, confirm_password } = req.body;

        if (!old_password || !new_password || !confirm_password) {
            req.flash("error", "All fields are required.");
            return res.redirect("/password");
        }

        if (new_password !== confirm_password) {
            req.flash("error", "New passwords do not match.");
            return res.redirect("/password");
        }

        if (new_password.length < 6) {
            req.flash("error", "New password must be at least 6 characters.");
            return res.redirect("/password");
        }

        // Hash helper function
        const hash = (pw) => crypto.createHash("sha1").update(pw).digest("hex");

        const oldPwHashed = hash(old_password);
        const newPwHashed = hash(new_password);

        // Get user's current password
        const checkSQL = `SELECT password FROM users WHERE id = ?`;

        connection.query(checkSQL, [userId], (err, result) => {
            if (err) throw err;

            const currentPassword = result[0].password;

            // ❗ Validate old password
            if (currentPassword !== oldPwHashed) {
                req.flash("error", "Old password is incorrect.");
                return res.redirect("/password");
            }

            // Do not allow same password
            if (oldPwHashed === newPwHashed) {
                req.flash("error", "New password cannot be the same as old password.");
                return res.redirect("/password");
            }

            // Update password
            const updateSQL = `UPDATE users SET password = ? WHERE id = ?`;

            connection.query(updateSQL, [newPwHashed, userId], (err2) => {
                if (err2) throw err2;

                req.flash("success", "Password updated successfully.");
                res.redirect("/password");
            });
        });
    }
};

module.exports = userController;
