const fs = require('fs').promises;
const path = require('path');

class CartManager {
  constructor(filePath, productManager) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('CartManager requires a valid file path string');
    }
    this.path = filePath;
    this.productManager = productManager;
  }

  async #ensureStore() {
    const dir = path.dirname(this.path);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.access(this.path);
    } catch {
      await fs.writeFile(this.path, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  async #readAll() {
    await this.#ensureStore();
    const raw = await fs.readFile(this.path, 'utf-8');
    try {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async #writeAll(carts) {
    await this.#ensureStore();
    await fs.writeFile(this.path, JSON.stringify(carts, null, 2), 'utf-8');
  }

  async #nextId(carts) {
    if (!carts.length) return 1;
    const maxId = carts.reduce((max, c) => (c.id > max ? c.id : max), 0);
    return maxId + 1;
  }

  async createCart(initialProducts = []) {
    const carts = await this.#readAll();

    // Allow passing either an array or an object with { products: [...] }
    const input = Array.isArray(initialProducts)
      ? initialProducts
      : (initialProducts && Array.isArray(initialProducts.products) ? initialProducts.products : []);

    // Normalize and validate
    const totals = new Map();
    for (const item of input) {
      const pid = Number(item && (item.id ?? item.product));
      const qty = Number(item && item.quantity);
      if (!Number.isFinite(pid)) throw new Error('Invalid product id in initial products');
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('Invalid quantity in initial products');

      if (this.productManager) {
        const exists = await this.productManager.getProductById(pid);
        if (!exists) throw new Error(`Product does not exist: ${pid}`);
      }
      totals.set(pid, (totals.get(pid) || 0) + qty);
    }

    const products = Array.from(totals.entries()).map(([pid, qty]) => ({ product: pid, quantity: qty }));

    const newCart = { id: await this.#nextId(carts), products };
    carts.push(newCart);
    await this.#writeAll(carts);
    return newCart;
  }

  async getCartById(id) {
    const cid = Number(id);
    if (!Number.isFinite(cid)) throw new Error('Invalid cart id');
    const carts = await this.#readAll();
    return carts.find((c) => c.id === cid) || null;
  }

  async addProductToCart(cartId, productId, qty = 1) {
    const cid = Number(cartId);
    const pid = Number(productId);
    const quantity = Number(qty);

    if (!Number.isFinite(cid)) throw new Error('Invalid cart id');
    if (!Number.isFinite(pid)) throw new Error('Invalid product id');
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Invalid quantity');

    // Validate product existence using ProductManager
    if (this.productManager) {
      const exists = await this.productManager.getProductById(pid);
      if (!exists) throw new Error('Product does not exist');
    }

    const carts = await this.#readAll();
    const idx = carts.findIndex((c) => c.id === cid);
    if (idx === -1) return null;

    const cart = carts[idx];
    const pidx = cart.products.findIndex((p) => Number(p.product) === pid);
    if (pidx === -1) {
      cart.products.push({ product: pid, quantity });
    } else {
      cart.products[pidx].quantity += quantity;
    }

    carts[idx] = cart;
    await this.#writeAll(carts);
    return cart;
  }
}

module.exports = CartManager;
