const fs = require('fs').promises;
const path = require('path');

class ProductManager {
  constructor(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('ProductManager requires a valid file path string');
    }
    this.path = filePath;
  }

  // Internal: ensures the directory and file exist
  async #ensureStore() {
    const dir = path.dirname(this.path);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.access(this.path);
    } catch {
      await fs.writeFile(this.path, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  // Helpers to normalize data types
  #toNumber(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) throw new Error('Expected a numeric value');
    return num;
  }

  #toBoolean(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
      if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
    }
    throw new Error('Expected a boolean value');
  }

  #toStringArray(arr) {
    if (arr == null) return [];
    if (Array.isArray(arr)) return arr.map((x) => String(x));
    throw new Error('Expected thumbnails to be an array of strings');
  }

  async #readAll() {
    await this.#ensureStore();
    const raw = await fs.readFile(this.path, 'utf-8');
    try {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch {
      // If file is corrupted, reset to empty array to avoid server crash
      return [];
    }
  }

  async #writeAll(products) {
    await this.#ensureStore();
    await fs.writeFile(this.path, JSON.stringify(products, null, 2), 'utf-8');
  }

  async #nextId(products) {
    if (!products.length) return 1;
    const maxId = products.reduce((max, p) => (p.id > max ? p.id : max), 0);
    return maxId + 1;
  }

  // Create
  async addProduct(product) {
    const required = ['title', 'description', 'code', 'price', 'status', 'stock', 'category', 'thumbnails'];
    for (const key of required) {
      if (product[key] === undefined || product[key] === null || product[key] === '') {
        throw new Error(`Missing required field: ${key}`);
      }
    }

    const products = await this.#readAll();

    const newProduct = {
      id: await this.#nextId(products),
      title: String(product.title),
      description: String(product.description),
      code: String(product.code),
      price: this.#toNumber(product.price),
      status: this.#toBoolean(product.status),
      stock: this.#toNumber(product.stock),
      category: String(product.category),
      thumbnails: this.#toStringArray(product.thumbnails),
    };

    products.push(newProduct);
    await this.#writeAll(products);
    return newProduct;
  }

  // Read all
  async getProducts() {
    return await this.#readAll();
  }

  // Read one
  async getProductById(id) {
    const pid = Number(id);
    if (!Number.isFinite(pid)) throw new Error('Invalid product id');
    const products = await this.#readAll();
    return products.find((p) => p.id === pid) || null;
  }

  // Update (optional, not required by endpoints but included for completeness)
  async updateProduct(id, updates) {
    const pid = Number(id);
    if (!Number.isFinite(pid)) throw new Error('Invalid product id');

    const products = await this.#readAll();
    const idx = products.findIndex((p) => p.id === pid);
    if (idx === -1) return null;

    const immutable = ['id'];
    const allowed = ['title', 'description', 'code', 'price', 'status', 'stock', 'category', 'thumbnails', 'thumbnail'];
    const sanitized = {};

    for (const key of Object.keys(updates || {})) {
      if (immutable.includes(key)) continue;
      if (!allowed.includes(key)) continue;
      switch (key) {
        case 'price':
        case 'stock':
          sanitized[key] = this.#toNumber(updates[key]);
          break;
        case 'status':
          sanitized[key] = this.#toBoolean(updates[key]);
          break;
        case 'thumbnails':
          sanitized[key] = this.#toStringArray(updates[key]);
          break;
        default:
          sanitized[key] = String(updates[key]);
      }
    }

    products[idx] = { ...products[idx], ...sanitized };
    await this.#writeAll(products);
    return products[idx];
  }

  // Delete (optional)
  async deleteProduct(id) {
    const pid = Number(id);
    if (!Number.isFinite(pid)) throw new Error('Invalid product id');

    const products = await this.#readAll();
    const idx = products.findIndex((p) => p.id === pid);
    if (idx === -1) return false;

    products.splice(idx, 1);
    await this.#writeAll(products);
    return true;
  }
}

module.exports = ProductManager;
