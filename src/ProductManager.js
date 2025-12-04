const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'title requerido'] },
  description: { type: String, required: [true, 'description requerido'] },
  code: { type: String, required: [true, 'code requerido'], unique: true, index: true },
  price: { type: Number, required: [true, 'price requerido'], min: 0 },
  status: { type: Boolean, required: [true, 'status requerido'], default: true },
  stock: { type: Number, required: [true, 'stock requerido'], min: 0 },
  category: { type: String, required: [true, 'category requerido'] },
  thumbnails: { type: [String], default: [] }
}, { timestamps: true, collection: 'products' }); // use requested collection name

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

const oid = (v) => (typeof v === 'string' && mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : null);
const mapDoc = (doc) => {
  if (!doc) return null;
  const d = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(d._id),
    title: d.title,
    description: d.description,
    code: d.code,
    price: d.price,
    status: d.status,
    stock: d.stock,
    category: d.category,
    thumbnails: Array.isArray(d.thumbnails) ? d.thumbnails : []
  };
};

class ProductManager {
  constructor() {}

  async addProduct(product) {
    const required = ['title', 'description', 'code', 'price', 'status', 'stock', 'category', 'thumbnails'];
    for (const key of required) {
      if (product[key] === undefined || product[key] === null || product[key] === '') {
        throw new Error(`Falta el campo requerido: ${key}`);
      }
    }
    try {
      const created = await Product.create({
        title: String(product.title),
        description: String(product.description),
        code: String(product.code),
        price: Number(product.price),
        status: Boolean(product.status),
        stock: Number(product.stock),
        category: String(product.category),
        thumbnails: Array.isArray(product.thumbnails) ? product.thumbnails.map(String) : []
      });
      return mapDoc(created);
    } catch (e) {
      if (e && e.code === 11000) throw new Error('El código de producto ya existe');
      throw e;
    }
  }

  async getProducts() {
    const docs = await Product.find({}).sort({ createdAt: -1 }).lean();
    return docs.map(mapDoc);
  }

  async getProductById(id) {
    const _id = oid(id);
    if (!_id) throw new Error('ID de producto inválido');
    const doc = await Product.findById(_id).lean();
    return mapDoc(doc);
  }

  async updateProduct(id, updates) {
    const _id = oid(id);
    if (!_id) throw new Error('ID de producto inválido');

    const allowed = ['title', 'description', 'code', 'price', 'status', 'stock', 'category', 'thumbnails'];
    const sanitized = {};
    for (const k of Object.keys(updates || {})) {
      if (!allowed.includes(k)) continue;
      switch (k) {
        case 'price':
        case 'stock':
          sanitized[k] = Number(updates[k]);
          break;
        case 'status':
          sanitized[k] = Boolean(updates[k]);
          break;
        case 'thumbnails':
          sanitized[k] = Array.isArray(updates[k]) ? updates[k].map(String) : [];
          break;
        default:
          sanitized[k] = String(updates[k]);
      }
    }

    const doc = await Product.findByIdAndUpdate(_id, sanitized, { new: true, runValidators: true }).lean();
    return mapDoc(doc);
  }

  async deleteProduct(id) {
    const _id = oid(id);
    if (!_id) throw new Error('ID de producto inválido');
    const res = await Product.findByIdAndDelete(_id).lean();
    return Boolean(res);
  }

  // Pagination + filter + sort for /api/products
  async paginate({ limit = '10', page = '1', sort, query, basePath = '/api/products' } = {}) {
    const nLimit = Math.max(1, Number(limit) || 10);
    const nPage = Math.max(1, Number(page) || 1);

    const filter = {};
    if (query) {
      const [key, rawVal] = String(query).split(':');
      if (key === 'category' && rawVal) filter.category = String(rawVal);
      else if (key === 'status' && rawVal) {
        const val = String(rawVal).toLowerCase();
        filter.status = val === 'true' || val === '1' || val === 'yes';
      }
    }

    const sortOpt = {};
    if (sort === 'asc' || sort === 'desc') sortOpt.price = sort === 'asc' ? 1 : -1;

    const total = await Product.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / nLimit));
    const currPage = Math.min(nPage, totalPages);
    const skip = (currPage - 1) * nLimit;

    const docs = await Product.find(filter).sort(sortOpt).skip(skip).limit(nLimit).lean();
    const payload = docs.map(mapDoc);

    const hasPrevPage = currPage > 1;
    const hasNextPage = currPage < totalPages;
    const mkLink = (p) =>
      `${basePath}?limit=${nLimit}&page=${p}${sort ? `&sort=${sort}` : ''}${query ? `&query=${encodeURIComponent(query)}` : ''}`;

    return {
      status: 'success',
      payload,
      totalPages,
      prevPage: hasPrevPage ? currPage - 1 : null,
      nextPage: hasNextPage ? currPage + 1 : null,
      page: currPage,
      hasPrevPage,
      hasNextPage,
      prevLink: hasPrevPage ? mkLink(currPage - 1) : null,
      nextLink: hasNextPage ? mkLink(currPage + 1) : null
    };
  }
}

module.exports = ProductManager;
