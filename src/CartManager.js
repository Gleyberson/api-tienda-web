const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');

const oid = (v) => (typeof v === 'string' && mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : null);
const mapProduct = (p) => ({
  id: String(p._id),
  title: p.title,
  description: p.description,
  code: p.code,
  price: p.price,
  status: p.status,
  stock: p.stock,
  category: p.category,
  thumbnails: Array.isArray(p.thumbnails) ? p.thumbnails : []
});

const cartSchema = new mongoose.Schema({
  products: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 }
  }]
}, { timestamps: true, collection: 'carts' });

const Cart = mongoose.models.Cart || mongoose.model('Cart', cartSchema);

class CartManager {
  constructor(productManager) {
    this.productManager = productManager;
  }

  async createCart(initialProducts = []) {
    const input = Array.isArray(initialProducts)
      ? initialProducts
      : (initialProducts && Array.isArray(initialProducts.products) ? initialProducts.products : []);

    const totals = new Map();
    for (const item of input) {
      const pid = String(item && (item.id ?? item.product));
      const _id = oid(pid);
      const qty = Number(item && item.quantity);
      if (!_id) throw new Error('ID de producto inválido en productos iniciales');
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('Cantidad inválida en productos iniciales');

      // validate product existence
      const exists = await this.productManager.getProductById(pid);
      if (!exists) throw new Error(`El producto no existe: ${pid}`);

      totals.set(_id.toString(), (totals.get(_id.toString()) || 0) + qty);
    }

    const products = Array.from(totals.entries()).map(([pid, qty]) => ({ product: new mongoose.Types.ObjectId(pid), quantity: qty }));
    const created = await Cart.create({ products });
    return { id: String(created._id), products: created.products.map(p => ({ product: String(p.product), quantity: p.quantity })) };
  }

  async getCartById(id, { populate = false } = {}) {
    const _id = oid(id);
    if (!_id) throw new Error('ID de carrito inválido');

    if (populate) {
      const doc = await Cart.findById(_id).populate('products.product').lean();
      if (!doc) return null;
      return {
        id: String(doc._id),
        products: (doc.products || []).map(it => ({
          product: mapProduct(it.product),
          quantity: it.quantity
        }))
      };
    } else {
      const doc = await Cart.findById(_id).lean();
      if (!doc) return null;
      return {
        id: String(doc._id),
        products: (doc.products || []).map(it => ({ product: String(it.product), quantity: it.quantity }))
      };
    }
  }

  async addProductToCart(cartId, productId, qty = 1) {
    const _cid = oid(cartId);
    const _pid = oid(productId);
    const quantity = Number(qty);

    if (!_cid) throw new Error('ID de carrito inválido');
    if (!_pid) throw new Error('ID de producto inválido');
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Cantidad inválida');

    const exists = await this.productManager.getProductById(String(_pid));
    if (!exists) throw new Error('El producto no existe');

    const cart = await Cart.findById(_cid);
    if (!cart) return null;

    const idx = cart.products.findIndex(p => String(p.product) === String(_pid));
    if (idx === -1) cart.products.push({ product: _pid, quantity });
    else cart.products[idx].quantity += quantity;

    const saved = await cart.save();
    return { id: String(saved._id), products: saved.products.map(it => ({ product: String(it.product), quantity: it.quantity })) };
  }

  async replaceProducts(cartId, items) {
    const _cid = oid(cartId);
    if (!_cid) throw new Error('ID de carrito inválido');

    const normalized = [];
    for (const it of Array.from(items || [])) {
      const _pid = oid(String(it && (it.product ?? it.id)));
      const qty = Number(it && it.quantity);
      if (!_pid) throw new Error('ID de producto inválido');
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('Cantidad inválida');
      const exists = await this.productManager.getProductById(String(_pid));
      if (!exists) throw new Error(`El producto no existe: ${String(_pid)}`);
      normalized.push({ product: _pid, quantity: qty });
    }

    const cart = await Cart.findById(_cid);
    if (!cart) return null;
    cart.products = normalized;
    const saved = await cart.save();
    return { id: String(saved._id), products: saved.products.map(it => ({ product: String(it.product), quantity: it.quantity })) };
  }

  async updateProductQuantity(cartId, productId, quantity) {
    const _cid = oid(cartId);
    const _pid = oid(productId);
    const qty = Number(quantity);
    if (!_cid) throw new Error('ID de carrito inválido');
    if (!_pid) throw new Error('ID de producto inválido');
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('Cantidad inválida');

    const cart = await Cart.findById(_cid);
    if (!cart) return null;

    const idx = cart.products.findIndex(p => String(p.product) === String(_pid));
    if (idx === -1) return null;

    cart.products[idx].quantity = qty;
    const saved = await cart.save();
    return { id: String(saved._id), products: saved.products.map(it => ({ product: String(it.product), quantity: it.quantity })) };
  }

  async removeProduct(cartId, productId) {
    const _cid = oid(cartId);
    const _pid = oid(productId);
    if (!_cid) throw new Error('ID de carrito inválido');
    if (!_pid) throw new Error('ID de producto inválido');

    const cart = await Cart.findById(_cid);
    if (!cart) return null;

    cart.products = (cart.products || []).filter(p => String(p.product) !== String(_pid));
    const saved = await cart.save();
    return { id: String(saved._id), products: saved.products.map(it => ({ product: String(it.product), quantity: it.quantity })) };
  }

  async emptyCart(cartId) {
    const _cid = oid(cartId);
    if (!_cid) throw new Error('ID de carrito inválido');

    const cart = await Cart.findById(_cid);
    if (!cart) return null;

    cart.products = [];
    await cart.save();
    return true;
  }
}

module.exports = CartManager;
