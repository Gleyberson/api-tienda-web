// app.js test gh_4
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { engine } = require('express-handlebars');
const ProductManager = require('./src/ProductManager');
const CartManager = require('./src/CartManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 8080;

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Handlebars setup
app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// Data store path
const productsPath = path.join(__dirname, 'data', 'products.json');
const cartsPath = path.join(__dirname, 'data', 'carts.json');
const pm = new ProductManager(productsPath);
const cm = new CartManager(cartsPath, pm);

// Health
app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'api-tienda-web' });
});

// Views
app.get('/home', async (_req, res) => {
  try {
    const products = await pm.getProducts();
    res.render('home', { products });
  } catch (err) {
    res.status(500).send('Failed to render home');
  }
});

app.get('/realtimeproducts', async (_req, res) => {
  try {
    const products = await pm.getProducts();
    res.render('realTimeProducts', { products });
  } catch (err) {
    res.status(500).send('Failed to render realtimeproducts');
  }
});

// Products API (/api/products)
const productsBase = '/api/products';
// GET /api/products
app.get(productsBase, async (_req, res) => {
  try {
    const products = await pm.getProducts();
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read products', details: err.message });
  }
});

// POST /api/products => create new product
app.post(productsBase, async (req, res) => {
  try {
    const created = await pm.addProduct(req.body || {});
    // broadcast latest products to all sockets
    io.emit('products', await pm.getProducts());
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create product', details: err.message });
  }
});

// GET /api/products/:pid => product object or 404
app.get(`${productsBase}/:pid`, async (req, res) => {
  try {
    const { pid } = req.params;
    const product = await pm.getProductById(pid);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: 'Invalid request', details: err.message });
  }
});

// PUT /api/products/:pid => update fields except id
app.put(`${productsBase}/:pid`, async (req, res) => {
  try {
    const { pid } = req.params;
    const updated = await pm.updateProduct(pid, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Product not found' });
    // broadcast latest products to all sockets
    io.emit('products', await pm.getProducts());
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update product', details: err.message });
  }
});

// DELETE /api/products/:pid => delete product
app.delete(`${productsBase}/:pid`, async (req, res) => {
  try {
    const { pid } = req.params;
    const ok = await pm.deleteProduct(pid);
    if (!ok) return res.status(404).json({ error: 'Product not found' });
    // broadcast latest products to all sockets
    io.emit('products', await pm.getProducts());
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete product', details: err.message });
  }
});

// Carts API (/api/carts)
const cartsBase = '/api/carts';

// POST /api/carts -> create new cart
app.post(cartsBase, async (req, res) => {
  try {
    const products = req.body && req.body.products ? req.body.products : [];
    const cart = await cm.createCart(products);
    res.status(201).json(cart);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create cart', details: err.message });
  }
});

// GET /api/carts/:cid -> list products in cart
app.get(`${cartsBase}/:cid`, async (req, res) => {
  try {
    const { cid } = req.params;
    const cart = await cm.getCartById(cid);
    if (!cart) return res.status(404).json({ error: 'Cart not found' });
    res.json(cart.products);
  } catch (err) {
    res.status(400).json({ error: 'Invalid request', details: err.message });
  }
});

// POST /api/carts/:cid/product/:pid -> add product to cart (increments quantity)
app.post(`${cartsBase}/:cid/product/:pid`, async (req, res) => {
  try {
    const { cid, pid } = req.params;
    // By default increment by 1; allow optional body.quantity
    const qty = req.body && req.body.quantity ? Number(req.body.quantity) : 1;
    const updated = await cm.addProductToCart(cid, pid, qty);
    if (!updated) return res.status(404).json({ error: 'Cart not found' });
    res.status(200).json(updated);
  } catch (err) {
    res.status(400).json({ error: 'Failed to add product to cart', details: err.message });
  }
});

// Socket.IO
io.on('connection', async (socket) => {
  // send current products on connect
  socket.emit('products', await pm.getProducts());

  // create via WS
  socket.on('product:create', async (payload, cb) => {
    try {
      const created = await pm.addProduct(payload || {});
      io.emit('products', await pm.getProducts());
      cb && cb({ ok: true, product: created });
    } catch (e) {
      cb && cb({ ok: false, error: e.message });
    }
  });

  // delete via WS
  socket.on('product:delete', async (id, cb) => {
    try {
      const ok = await pm.deleteProduct(id);
      if (!ok) throw new Error('Product not found');
      io.emit('products', await pm.getProducts());
      cb && cb({ ok: true });
    } catch (e) {
      cb && cb({ ok: false, error: e.message });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
