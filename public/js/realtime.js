/* global io */
const socket = io();

// Render list
const listEl = document.getElementById('productList');
function render(products) {
  if (!listEl) return;
  listEl.innerHTML = products.map(p => `
    <li data-id="${p.id}">
      <strong>${p.title ?? '(sin título)'}</strong>
      <small>ID: ${p.id ?? ''}</small>
      ${p.price != null ? ` - $${p.price}` : ''}
      <button class="btn-delete" data-id="${p.id}">Eliminar</button>
    </li>
  `).join('');
}

// Listen for updates
socket.on('products', (products) => render(products));

// Handle create
const form = document.getElementById('createForm');
const msg = document.getElementById('createMsg');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());

    // Normalizar miniaturas a arreglo `thumbnails`
    if (typeof data.thumbnails === 'string' && data.thumbnails.trim() !== '') {
      data.thumbnails = data.thumbnails
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    } else if (typeof data.thumbnail === 'string' && data.thumbnail.trim() !== '') {
      // compat: si el input fuera "thumbnail", conviértelo
      data.thumbnails = [data.thumbnail.trim()];
      delete data.thumbnail;
    } else {
      // si no hay miniaturas, borrar para que el PM decida o marque error
      delete data.thumbnails;
    }

    // coerce tipos
    if (data.price !== undefined && data.price !== '') data.price = Number(data.price);
    if (data.stock !== undefined && data.stock !== '') data.stock = Number(data.stock);
    if (data.status === 'true') data.status = true;
    else if (data.status === 'false') data.status = false;
    else delete data.status;

    socket.emit('product:create', data, (resp) => {
      console.log('Create response:', resp);
      if (resp?.ok) {
        msg.textContent = 'Creado';
        form.reset();
      } else {
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
    if (!resp?.ok) alert(`Error al eliminar: ${resp?.error || 'desconocido'}`);
  });
});