// app.js test gh_4
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { engine } = require('express-handlebars');
const ProductManager = require('./src/ProductManager');
const CartManager = require('./src/CartManager');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 8080;

// Connect MongoDB (test_coder)
mongoose.set('strictQuery', true);
mongoose.connect('mongodb://127.0.0.1:27017/test_coder')
  .then(() => console.log('MongoDB connected (test_coder)'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// + ensure img dir and configure multer
const imgDir = path.join(__dirname, 'public', 'img');
fs.mkdirSync(imgDir, { recursive: true });

// Definir límites en una constante para reusarlos y exponerlos en errores
const uploadLimits = { fileSize: 5 * 1024 * 1024, files: 10 }; // 5MB por archivo, máx 10

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, imgDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '-').toLowerCase();
    cb(null, `${Date.now()}-${base}${ext}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Solo se permiten archivos de imagen'));
  },
  limits: uploadLimits
});

// + uploads endpoint con manejo explícito de errores de Multer
app.post('/api/uploads', (req, res) => {
  upload.array('thumbnails', uploadLimits.files)(req, res, (err) => {
    if (err) {
      // Mapear códigos de Multer a mensajes claros
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'Archivo demasiado grande',
          code: err.code,
          limit: uploadLimits.fileSize // bytes
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(413).json({
          error: 'Demasiados archivos',
          code: err.code,
          maxFiles: uploadLimits.files
        });
      }
      // Otros errores (tipo MIME, etc.)
      return res.status(400).json({
        error: 'Error en la carga',
        code: err.code || 'UPLOAD_ERROR',
        details: err.message
      });
    }
    const files = req.files || [];
    const thumbnails = files.map(f => `/img/${f.filename}`);
    res.json({ thumbnails });
  });
});

// Handlebars setup
app.engine('handlebars', engine({
  helpers: {
    gt: (a, b) => Number(a) > Number(b),
    eq: (a, b) => a === b
  }
}));
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// Managers
const pm = new ProductManager();
const cm = new CartManager(pm);

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
    res.status(500).send('Error al renderizar la página de inicio');
  }
});

app.get('/realtimeproducts', async (_req, res) => {
  try {
    // Paginar también en la vista realtime (usa los defaults)
    const { payload: products, page, totalPages, hasPrevPage, hasNextPage, prevLink, nextLink } = await pm.paginate({ basePath: '/realtimeproducts' });
    res.render('realTimeProducts', { products, page, totalPages, hasPrevPage, hasNextPage, prevLink, nextLink });
  } catch (err) {
    res.status(500).send('Error al renderizar la página de productos en tiempo real');
  }
});

// Products view with pagination
app.get('/products', async (req, res) => {
  try {
    const { limit = '10', page = '1', sort, query } = req.query;
    const result = await pm.paginate({ limit, page, sort, query, basePath: '/products' });
    res.render('products', { 
      products: result.payload,
      page: result.page,
      totalPages: result.totalPages,
      hasPrevPage: result.hasPrevPage,
      hasNextPage: result.hasNextPage,
      prevLink: result.prevLink,
      nextLink: result.nextLink,
      query,
      sort,
      limit
    });
  } catch (err) {
    res.status(500).send('Error al renderizar productos');
  }
});

// Product detail
app.get('/products/:pid', async (req, res) => {
  try {
    const { pid } = req.params;
    const product = await pm.getProductById(pid);
    if (!product) return res.status(404).send('Producto no encontrado');
    res.render('productDetail', { product });
  } catch (err) {
    res.status(500).send('Error al renderizar detalle de producto');
  }
});

// Cart detail view (populate)
app.get('/carts/:cid/view', async (req, res) => {
  try {
    const { cid } = req.params;
    const cart = await cm.getCartById(cid, { populate: true });
    if (!cart) return res.status(404).send('Carrito no encontrado');
    res.render('cart', { cart });
  } catch (err) {
    res.status(500).send('Error al renderizar carrito');
  }
});

// Products API (/api/products)
const productsBase = '/api/products';

// GET /api/products with pagination, filter, sort (Mongo)
app.get(productsBase, async (req, res) => {
  try {
    const { limit = '10', page = '1', sort, query } = req.query;
    const result = await pm.paginate({ limit, page, sort, query, basePath: productsBase });
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'error', error: 'Error al leer productos', details: err.message });
  }
});

// POST /api/products => create new product
app.post(productsBase, async (req, res) => {
  try {
    const created = await pm.addProduct(req.body || {});
    io.emit('products', await pm.getProducts());
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: 'Error al crear producto', details: err.message });
  }
});

// GET /api/products/:pid => product object or 404
app.get(`${productsBase}/:pid`, async (req, res) => {
  try {
    const { pid } = req.params;
    const product = await pm.getProductById(pid);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: 'Solicitud inválida', details: err.message });
  }
});

// PUT /api/products/:pid => update fields except id
app.put(`${productsBase}/:pid`, async (req, res) => {
  try {
    const { pid } = req.params;
    const updated = await pm.updateProduct(pid, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Producto no encontrado' });
    io.emit('products', await pm.getProducts());
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: 'Error al actualizar producto', details: err.message });
  }
});

// DELETE /api/products/:pid => delete product
app.delete(`${productsBase}/:pid`, async (req, res) => {
  try {
    const { pid } = req.params;
    const ok = await pm.deleteProduct(pid);
    if (!ok) return res.status(404).json({ error: 'Producto no encontrado' });
    io.emit('products', await pm.getProducts());
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Error al eliminar producto', details: err.message });
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
    res.status(400).json({ error: 'Error al crear carrito', details: err.message });
  }
});

// GET /api/carts/:cid -> populated products
app.get(`${cartsBase}/:cid`, async (req, res) => {
  try {
    const { cid } = req.params;
    const cart = await cm.getCartById(cid, { populate: true });
    if (!cart) return res.status(404).json({ error: 'Carrito no encontrado' });
    res.json(cart.products);
  } catch (err) {
    res.status(400).json({ error: 'Solicitud inválida', details: err.message });
  }
});

// POST /api/carts/:cid/product/:pid -> add product (increments quantity)
app.post(`${cartsBase}/:cid/product/:pid`, async (req, res) => {
  try {
    const { cid, pid } = req.params;
    const qty = req.body && req.body.quantity ? Number(req.body.quantity) : 1;
    const updated = await cm.addProductToCart(cid, pid, qty);
    if (!updated) return res.status(404).json({ error: 'Carrito no encontrado' });
    res.status(200).json(updated);
  } catch (err) {
    res.status(400).json({ error: 'Error al agregar producto al carrito', details: err.message });
  }
});

// DELETE api/carts/:cid/products/:pid -> remove one product from cart
app.delete(`${cartsBase}/:cid/products/:pid`, async (req, res) => {
  try {
    const { cid, pid } = req.params;
    const cart = await cm.removeProduct(cid, pid);
    if (!cart) return res.status(404).json({ error: 'Carrito o producto no encontrado' });
    res.json(cart);
  } catch (err) {
    res.status(400).json({ error: 'Error al eliminar producto del carrito', details: err.message });
  }
});

// PUT api/carts/:cid -> replace all products with provided array
app.put(`${cartsBase}/:cid`, async (req, res) => {
  try {
    const { cid } = req.params;
    const items = Array.isArray(req.body?.products) ? req.body.products : [];
    const updated = await cm.replaceProducts(cid, items);
    if (!updated) return res.status(404).json({ error: 'Carrito no encontrado' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: 'Error al actualizar carrito', details: err.message });
  }
});

// PUT api/carts/:cid/products/:pid -> update quantity only
app.put(`${cartsBase}/:cid/products/:pid`, async (req, res) => {
  try {
    const { cid, pid } = req.params;
    const quantity = Number(req.body?.quantity);
    const updated = await cm.updateProductQuantity(cid, pid, quantity);
    if (!updated) return res.status(404).json({ error: 'Carrito o producto no encontrado' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: 'Error al actualizar cantidad', details: err.message });
  }
});

// DELETE api/carts/:cid -> empty cart
app.delete(`${cartsBase}/:cid`, async (req, res) => {
  try {
    const { cid } = req.params;
    const emptied = await cm.emptyCart(cid);
    if (!emptied) return res.status(404).json({ error: 'Carrito no encontrado' });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Error al vaciar carrito', details: err.message });
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
      if (!ok) throw new Error('Producto no encontrado');
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
