const Product = require('../models/supermarket');
const { toCSV } = require('../utils/csv');

/**
 * Controller for products (renders views / redirects)
 */
const supermarketController = {
	// Render inventory view (admin)
	listInventory(req, res) {
		const { search = '', sort = 'name_asc', stock = '' } = req.query || {};

		Product.getAllProducts({ search, sort, stockFilter: stock }, (err, products) => {
			if (err) {
				console.error('Error fetching products for inventory:', err);
				req.flash('error', 'Failed to load inventory');
				return res.redirect('/');
			}
			const filterQuery = new URLSearchParams({ search, sort, stock }).toString();
			return res.render('inventory', { products, user: req.session.user, filters: { search, sort, stock }, filterQuery });
		});
	},
	// Export inventory as CSV (respects current filters)
	exportInventoryCsv(req, res) {
		const { search = '', sort = 'name_asc', stock = '' } = req.query || {};

		Product.getAllProducts({ search, sort, stockFilter: stock }, (err, products) => {
			if (err) {
				console.error('Error exporting products:', err);
				return res.status(500).send('Failed to export products.');
			}

			const rows = products.map(p => ({
				id: p.id,
				name: p.productName,
				stock: p.quantity,
				price: Number(p.price).toFixed(2),
				image: p.image || ''
			}));

			const csv = toCSV(rows, [
				{ key: 'id', label: 'ID' },
				{ key: 'name', label: 'Name' },
				{ key: 'stock', label: 'Stock' },
				{ key: 'price', label: 'Price' },
				{ key: 'image', label: 'Image' }
			]);

			res.setHeader('Content-Type', 'text/csv');
			res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
			return res.send(csv);
		});
	},

	// Render shopping view (user)
	listShopping(req, res) {
		const { search = '', sort = 'name_asc' } = req.query || {};

		Product.getAllProducts({ search, sort }, (err, products) => {
			if (err) {
				console.error('Error fetching products for shopping:', err);
				req.flash('error', 'Failed to load products');
				return res.redirect('/');
			}
			const filters = { search, sort };
			return res.render('shopping', {
				products,
				user: req.session.user,
				filters,
				messages: req.flash('success'),
				errors: req.flash('error')
			});
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
