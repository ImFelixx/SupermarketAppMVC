const Product = require('../models/supermarket');

/**
 * Controller for products (renders views / redirects)
 */
const supermarketController = {
	// Render inventory view (admin)
	listInventory(req, res) {
		Product.getAllProducts((err, products) => {
			if (err) {
				console.error('Error fetching products for inventory:', err);
				req.flash('error', 'Failed to load inventory');
				return res.redirect('/');
			}
			return res.render('inventory', { products, user: req.session.user });
		});
	},

	// Render shopping view (user)
	listShopping(req, res) {
		Product.getAllProducts((err, products) => {
			if (err) {
				console.error('Error fetching products for shopping:', err);
				req.flash('error', 'Failed to load products');
				return res.redirect('/');
			}
			return res.render('shopping', { products, user: req.session.user });
		});
	},

	// Show a single product page
	viewProduct(req, res) {
		const id = parseInt(req.params.id, 10);
		if (Number.isNaN(id)) return res.status(400).send('Invalid product id');

		Product.getProductById(id, (err, product) => {
			if (err) {
				console.error('Error fetching product:', err);
				return res.status(500).send('Failed to fetch product');
			}
			if (!product) return res.status(404).send('Product not found');
			return res.render('product', { product, user: req.session.user });
		});
	},

	// Show add product form
	showAddProduct(req, res) {
		return res.render('addProduct', { user: req.session.user });
	},

	// Handle add product (expects multer middleware before this handler)
	addProduct(req, res) {
		const { name, quantity, price } = req.body || {};
		if (!name) {
			req.flash('error', 'productName is required');
			req.flash('formData', req.body);
			return res.redirect('/addProduct');
		}

		const product = {
			productName: name,
			quantity: parseInt(quantity, 10) || 0,
			price: parseFloat(price) || 0,
			image: req.file ? req.file.filename : null
		};

		Product.addProduct(product, (err /*, info */) => {
			if (err) {
				console.error('Error adding product:', err);
				req.flash('error', 'Failed to add product');
				return res.redirect('/addProduct');
			}
			return res.redirect('/inventory');
		});
	},

	// Show update product form
	showUpdateProduct(req, res) {
		const id = parseInt(req.params.id, 10);
		if (Number.isNaN(id)) return res.status(400).send('Invalid product id');

		Product.getProductById(id, (err, product) => {
			if (err) {
				console.error('Error fetching product for update:', err);
				req.flash('error', 'Failed to load product');
				return res.redirect('/inventory');
			}
			if (!product) return res.status(404).send('Product not found');
			return res.render('updateProduct', { product, user: req.session.user });
		});
	},

	// Handle update product (expects multer middleware before this handler)
	updateProduct(req, res) {
		const id = parseInt(req.params.id, 10);
		if (Number.isNaN(id)) return res.status(400).send('Invalid product id');

		const { name, quantity, price, currentImage } = req.body || {};
		if (!name) {
			req.flash('error', 'productName is required');
			return res.redirect(`/updateProduct/${id}`);
		}

		const image = req.file ? req.file.filename : (currentImage || null);

		const product = {
			productName: name,
			quantity: parseInt(quantity, 10) || 0,
			price: parseFloat(price) || 0,
			image
		};

		Product.updateProduct(id, product, (err, info) => {
			if (err) {
				console.error('Error updating product:', err);
				req.flash('error', 'Failed to update product');
				return res.redirect(`/updateProduct/${id}`);
			}
			if (info.affectedRows === 0) {
				req.flash('error', 'Product not found');
				return res.redirect('/inventory');
			}
			return res.redirect('/inventory');
		});
	},

	// Delete product and redirect
	deleteProduct(req, res) {
		const id = parseInt(req.params.id, 10);
		if (Number.isNaN(id)) return res.status(400).send('Invalid product id');

		Product.deleteProduct(id, (err, info) => {
			if (err) {
				console.error('Error deleting product:', err);
				req.flash('error', 'Failed to delete product');
				return res.redirect('/inventory');
			}
			if (info.affectedRows === 0) {
				req.flash('error', 'Product not found');
			}
			return res.redirect('/inventory');
		});
	}
};

module.exports = supermarketController;