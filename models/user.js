const db = require('../db');
const crypto = require('crypto');

const hashPassword = (pw) => crypto.createHash('sha1').update(pw).digest('hex');

const UserModel = {
    getAll(callback) {
        db.query('SELECT * FROM users', callback);
    },

    getAllFiltered(options, callback) {
        const { search, role, sort } = options || {};
        let sql = 'SELECT * FROM users';
        const where = [];
        const params = [];

        if (search) {
            where.push('(username LIKE ? OR email LIKE ?)');
            const like = `%${search}%`;
            params.push(like, like);
        }

        if (role) {
            where.push('role = ?');
            params.push(role);
        }

        if (where.length) {
            sql += ' WHERE ' + where.join(' AND ');
        }

        const sortMap = {
            id_desc: 'id DESC',
            id_asc: 'id ASC',
            name_asc: 'username ASC',
            name_desc: 'username DESC',
            email_asc: 'email ASC',
            email_desc: 'email DESC'
        };
        sql += ' ORDER BY ' + (sortMap[sort] || sortMap.id_desc);

        db.query(sql, params, callback);
    },

    getById(id, callback) {
        db.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id], (err, rows) => {
            if (err) return callback(err);
            const user = rows && rows.length ? rows[0] : null;
            callback(null, user);
        });
    },

    getByEmail(email, callback) {
        db.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email], (err, rows) => {
            if (err) return callback(err);
            const user = rows && rows.length ? rows[0] : null;
            callback(null, user);
        });
    },

    create({ username, email, password, address, contact, role }, callback) {
        const sql = `
            INSERT INTO users (username, email, password, address, contact, role)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const hashedPassword = hashPassword(password);
        const addressValue = typeof address === "undefined" ? '' : address;
        const contactValue = typeof contact === "undefined" ? '' : contact;
        db.query(sql, [username, email, hashedPassword, addressValue, contactValue, role], callback);
    },

    validateCredentials(email, password, callback) {
        const hashed = hashPassword(password);
        const sql = `
            SELECT * FROM users WHERE email = ? AND password = ? LIMIT 1
        `;
        db.query(sql, [email, hashed], (err, rows) => {
            if (err) return callback(err);
            const user = rows && rows.length ? rows[0] : null;
            callback(null, user);
        });
    },

    emailExistsForOtherUser(email, userId, callback) {
        const sql = `
            SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1
        `;
        db.query(sql, [email, userId], (err, rows) => {
            if (err) return callback(err);
            callback(null, rows && rows.length > 0);
        });
    },

    updateProfile(id, { username, email, contact, address }, callback) {
        const sql = `
            UPDATE users 
            SET username = ?, email = ?, contact = ?, address = ?
            WHERE id = ?
        `;
        db.query(sql, [username, email, contact, address, id], callback);
    },

    getPasswordHash(id, callback) {
        db.query('SELECT password FROM users WHERE id = ? LIMIT 1', [id], (err, rows) => {
            if (err) return callback(err);
            const password = rows && rows.length ? rows[0].password : null;
            callback(null, password);
        });
    },

    updatePassword(id, newPassword, callback) {
        const hashed = hashPassword(newPassword);
        db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, id], callback);
    },

    updateUser(id, { username, email, role, address, contact }, callback) {
        const sql = `
            UPDATE users SET username = ?, email = ?, role = ?, address = ?, contact = ?
            WHERE id = ?
        `;
        db.query(sql, [username, email, role, address, contact, id], callback);
    },

    deleteUser(id, callback) {
        db.query('DELETE FROM users WHERE id = ?', [id], callback);
    },

    countAdmins(callback) {
        db.query("SELECT COUNT(*) AS adminCount FROM users WHERE role = 'admin'", (err, rows) => {
            if (err) return callback(err);
            const count = rows && rows.length ? rows[0].adminCount : 0;
            callback(null, count);
        });
    },

    getUserRoleBreakdown(callback) {
        const sql = `
            SELECT role, COUNT(*) AS count
            FROM users
            GROUP BY role
        `;
        db.query(sql, callback);
    },

    getTotalUsers(callback) {
        db.query('SELECT COUNT(*) AS totalUsers FROM users', (err, rows) => {
            if (err) return callback(err);
            const totalUsers = rows && rows.length ? rows[0].totalUsers : 0;
            callback(null, totalUsers);
        });
    }
};

module.exports = UserModel;
