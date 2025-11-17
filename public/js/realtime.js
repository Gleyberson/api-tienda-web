/* global io */
const socket = io();

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 10;

const fmtBytes = (b) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

const pesos = (n) =>
  typeof n === 'number' ? n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }) : '';

const listEl = document.getElementById('productList');

function card(product) {
  const imgs = Array.isArray(product.thumbnails) ? product.thumbnails : [];
  const img = imgs[0] || 'https://via.placeholder.com/800x450?text=Sin+imagen';
  return `
    <div class="col-12 col-md-6">
      <div class="card h-100 shadow-sm" data-id="${product.id}">
        <img src="${img}" class="card-img-top" style="aspect-ratio: 16/9; object-fit: cover;" alt="Producto">
        <div class="card-body">
          <h5 class="card-title mb-1">${product.title ?? '(sin título)'}</h5>
          <p class="text-muted small mb-2">ID: ${product.id ?? ''} ${product.code ? '• Código: ' + product.code : ''}</p>
          <p class="card-text">${product.description ?? ''}</p>
        </div>
        <div class="card-footer bg-white d-flex justify-content-between align-items-center">
          <strong class="text-primary">${product.price != null ? pesos(product.price) : ''}</strong>
          <button class="btn btn-outline-danger btn-sm btn-delete" data-id="${product.id}">Eliminar</button>
        </div>
      </div>
    </div>
  `;
}

function render(products) {
  if (!listEl) return;
  listEl.innerHTML = (products || []).map(card).join('');
}

socket.on('products', (products) => render(products));

// Handle create
const form = document.getElementById('createForm');
const msg = document.getElementById('createMsg');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.className = 'mt-3 small';
    msg.textContent = '';

    const data = Object.fromEntries(new FormData(form).entries());
    if (data.price !== undefined && data.price !== '') data.price = Number(data.price);
    if (data.stock !== undefined && data.stock !== '') data.stock = Number(data.stock);
    if (data.status === 'true') data.status = true;
    else if (data.status === 'false') data.status = false;
    else delete data.status;

    // Validación previa en cliente: tamaños y cantidad
    const fileInput = form.querySelector('input[name="thumbnails"]');
    const files = fileInput?.files;
    if (files && files.length > 0) {
      if (files.length > MAX_FILES) {
        msg.classList.add('text-danger');
        msg.textContent = `Máximo ${MAX_FILES} archivos permitidos. Intentaste subir ${files.length}.`;
        return;
      }
      const tooBig = Array.from(files).filter(f => f.size > MAX_FILE_SIZE);
      if (tooBig.length) {
        const detalle = tooBig.map(f => `${f.name} (${fmtBytes(f.size)})`).join(', ');
        msg.classList.add('text-danger');
        msg.innerHTML = `Cada archivo debe pesar ≤ ${fmtBytes(MAX_FILE_SIZE)}. Archivos demasiado grandes: ${detalle}`;
        return;
      }
    }

    // Subir imágenes
    if (files && files.length > 0) {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append('thumbnails', f));
      try {
        const res = await fetch('/api/uploads', { method: 'POST', body: fd });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          // Usar datos del servidor si existen (límite, código, etc.)
          const limitTxt = payload?.limit ? ` (límite: ${fmtBytes(payload.limit)})` : '';
          const serverMsg = payload?.error || 'No se pudo subir la(s) imagen(es)';
          msg.classList.add('text-danger');
          msg.textContent = `Error al subir imágenes: ${serverMsg}${limitTxt}`;
          return;
        }
        if (Array.isArray(payload.thumbnails)) data.thumbnails = payload.thumbnails;
      } catch (err) {
        msg.classList.add('text-danger');
        msg.textContent = `Error al subir imágenes: ${err.message}`;
        return;
      }
    }

    // Crear producto por WS
    socket.emit('product:create', data, (resp) => {
      if (resp?.ok) {
        msg.classList.add('text-success');
        msg.textContent = 'Producto creado';
        form.reset();
      } else {
        msg.classList.add('text-danger');
        msg.textContent = `Error: ${resp?.error || 'desconocido'}`;
      }
    });
  });
}

// Handle delete
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  const id = btn.getAttribute('data-id');
  socket.emit('product:delete', id, (resp) => {
    if (!resp?.ok) {
      alert(`No se pudo eliminar: ${resp?.error || 'desconocido'}`);
    }
  });
});