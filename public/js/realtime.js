/* global io */
const socket = io();

// Render list
const listEl = document.getElementById('productList');
function render(products) {
  if (!listEl) return;
  listEl.innerHTML = products.map(p => {
    const thumb = Array.isArray(p.thumbnails) && p.thumbnails.length ? p.thumbnails[0] : '';
    return `
      <li data-id="${p.id}">
        <strong>${p.title ?? '(sin título)'}</strong>
         ${thumb ? `<img src="${thumb}" alt="Miniatura" width="50" height="50" onerror="this.style.display='none'" />` : ''}
        <small>ID: ${p.id ?? ''}</small>
        ${p.price != null ? ` - $${p.price}` : ''}
        <button class="btn-delete" data-id="${p.id}">Eliminar</button>
      </li>
    `;
  }).join('');
}

// Listen for updates
socket.on('products', (products) => render(products));

// Handle create
const form = document.getElementById('createForm');
const msg = document.getElementById('createMsg');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';

    const data = Object.fromEntries(new FormData(form).entries());
    // coerce basic types
    if (data.price !== undefined && data.price !== '') data.price = Number(data.price);
    if (data.stock !== undefined && data.stock !== '') data.stock = Number(data.stock);
    if (data.status === 'true') data.status = true;
    else if (data.status === 'false') data.status = false;
    else delete data.status;

    // upload images first (if any)
    const fileInput = form.querySelector('input[name="thumbnails"]');
    const files = fileInput?.files;
    if (files && files.length > 0) {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append('thumbnails', f));
      try {
        const res = await fetch('/api/uploads', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('Upload failed');
        const json = await res.json();
        if (Array.isArray(json.thumbnails)) data.thumbnails = json.thumbnails;
      } catch (err) {
        msg.textContent = `Upload error: ${err.message}`;
        return;
      }
    }

    socket.emit('product:create', data, (resp) => {
      if (resp?.ok) {
        msg.textContent = 'Created';
        form.reset();
      } else {
        msg.textContent = `Error: ${resp?.error || 'unknown'}`;
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
    if (!resp?.ok) alert(`Delete failed: ${resp?.error || 'unknown'}`);
  });
});