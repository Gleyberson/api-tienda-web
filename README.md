# API Tienda Web

Servidor Express con persistencia en archivos para gestionar productos y carritos usando `ProductManager` y `CartManager`. Render de vistas con Handlebars, actualizaciones en tiempo real con Socket.IO y carga de imágenes con Multer hacia `public/img`.

## Tecnologías
- Node.js + Express
- Handlebars (`express-handlebars`)
- Socket.IO
- Multer (subida de imágenes)
- Bootstrap 5 (estilos)
- Almacenamiento en archivos JSON (productos y carritos)

## Requisitos
- Node.js 16+

## Instalación
```sh
npm install
```

## Ejecutar
```sh
npm start
# o
node app.js
```
Deberías ver:
```
Server running on http://localhost:8080
```

## Estructura relevante
- `app.js` → servidor, vistas, APIs, Socket.IO, endpoint de uploads (Multer).
- `src/ProductManager.js` → CRUD de productos en `data/products.json`.
- `src/CartManager.js` → gestión de carritos en `data/carts.json`.
- `views/` → Handlebars (`home.handlebars`, `realTimeProducts.handlebars`, `layouts/main.handlebars`).
- `public/` → estáticos; las imágenes se guardan en `public/img`.
- `public/js/realtime.js` → cliente WebSocket + subida de imágenes.

## Vistas
- GET `/home` (http://localhost:8080/home)
  - Lista estática de productos en tarjetas Bootstrap.
  - Si un producto tiene múltiples imágenes (`thumbnails`), se muestra un carrusel.
- GET `/realtimeproducts` (http://localhost:8080/realtimeproducts)
  - Formulario Bootstrap para crear productos (con carga de múltiples imágenes).
  - Grilla Bootstrap de productos que se actualiza en tiempo real.

Helpers de Handlebars registrados:
- `gt(a, b)` y `eq(a, b)`.

## Subida de imágenes (Multer)
- Endpoint: `POST /api/uploads`
- Campo: `thumbnails` (multipart/form-data, múltiples archivos).
- Restricciones:
  - Máximo 10 archivos.
  - Máximo 5 MB por archivo.
  - Solo `image/*`.
- Respuesta exitosa:
```json
{ "thumbnails": ["/img/archivo1.png", "/img/archivo2.jpg"] }
```
- Posibles errores:
```json
{ "error": "Archivo demasiado grande", "code": "LIMIT_FILE_SIZE", "limit": 5242880 }
{ "error": "Demasiados archivos", "code": "LIMIT_FILE_COUNT", "maxFiles": 10 }
{ "error": "Error en la carga", "code": "UPLOAD_ERROR", "details": "Solo se permiten archivos de imagen" }
```

El cliente (`public/js/realtime.js`) valida antes de subir:
- Tamaño máximo por archivo (5 MB).
- Cantidad máxima de archivos (10).
- Muestra mensajes claros con el tamaño real y el límite.

Flujo de creación en `/realtimeproducts`:
1) El formulario sube las imágenes a `/api/uploads`.
2) Con las rutas devueltas (`/img/...`), emite por WebSocket `product:create` con el producto completo.
3) El servidor valida y persiste; luego emite a todos `products` para refrescar la vista.

## WebSockets
- Canal: Socket.IO (cliente cargado en `layouts/main.handlebars`).
- Eventos del servidor:
  - Emite `products` al conectar y cada vez que se crea/actualiza/elimina un producto.
- Eventos del cliente:
  - `product:create` → crea producto (callback con `{ ok, product | error }`).
  - `product:delete` → elimina producto por `id` (callback con `{ ok | error }`).

## API REST

Productos (`/api/products`)
- GET `/api/products` → `{ products: [...] }`
- GET `/api/products/:pid` → objeto de producto o 404 si no existe
- POST `/api/products` → crea producto (201)
- PUT `/api/products/:pid` → actualiza campos permitidos (200)
- DELETE `/api/products/:pid` → elimina producto (204)

Campos requeridos para crear producto (validados por `ProductManager`):
- `title` (string)
- `description` (string)
- `code` (string)
- `price` (number)
- `status` (boolean)
- `stock` (number)
- `category` (string)
- `thumbnails` (array de strings con rutas públicas, por ejemplo `"/img/xxx.jpg"`)

Ejemplo POST crear producto (si ya subiste imágenes con `/api/uploads`):
```json
{
  "title": "Zapatos",
  "description": "Zapatos de cuero",
  "code": "ZAP-001",
  "price": 1200,
  "status": true,
  "stock": 15,
  "category": "calzado",
  "thumbnails": ["/img/1712345678-zap1.jpg", "/img/1712345680-zap2.jpg"]
}
```

Carritos (`/api/carts`)
- POST `/api/carts` → crea un carrito (201). Body opcional para inicializar productos.
- GET `/api/carts/:cid` → lista de productos del carrito en formato `{ product, quantity }` (200)
- POST `/api/carts/:cid/product/:pid` → agrega/incrementa un producto en el carrito; body opcional `quantity` (200)

Ejemplos de body:
```json
// Crear carrito con productos
{
  "products": [
    { "id": 1, "quantity": 3 },
    { "id": 2, "quantity": 1 }
  ]
}
```
- Agregar producto al carrito (POST `/api/carts/:cid/product/:pid`)
```json
{ "quantity": 2 }
```
Nota: `quantity` es opcional; si no se envía, se incrementa en 1.

## Pruebas rápidas con Postman

1) Iniciar el servidor con `npm start`.
2) En Postman, crear una petición:
   - Crear producto:
     - Method: POST
     - URL: `http://localhost:8080/api/products`
     - Body: raw → JSON (usar el ejemplo de “Crear producto”)
   - Obtener producto:
     - Method: GET
     - URL: `http://localhost:8080/api/products/{pid}`
   - Actualizar producto:
     - Method: PUT
     - URL: `http://localhost:8080/api/products/{pid}`
     - Body: raw → JSON (usar el ejemplo de “Actualizar producto”)
   - Eliminar producto:
     - Method: DELETE
     - URL: `http://localhost:8080/api/products/{pid}`
   - Crear carrito:
     - Method: POST
     - URL: `http://localhost:8080/api/carts`
     - Body: raw → JSON (usar el ejemplo de “Crear carrito”)
   - Agregar producto al carrito:
     - Method: POST
     - URL: `http://localhost:8080/api/carts/{cid}/product/{pid}`
     - Body: raw → JSON (usar el ejemplo de “Agregar producto al carrito”)
   - Ver productos del carrito:
     - Method: GET
     - URL: `http://localhost:8080/api/carts/{cid}`
