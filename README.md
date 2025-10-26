# API Tienda Web

Servidor Express con persistencia en archivos para gestionar productos y carritos usando [`ProductManager`](src/ProductManager.js) y [`CartManager`](src/CartManager.js). Rutas definidas en [app.js](app.js). Persistencia en [data/products.json](data/products.json) y [data/carts.json](data/carts.json).

## Requisitos
- Node.js 16+

## Instalación
```sh
npm install
```

## Ejecutar
```sh
npm start
```
Deberías ver:
```
Server running on http://localhost:8080
```

## Endpoints

- Salud
  - GET `/` → `{ status: "ok", service: "api-tienda-web" }`

- Productos (`/api/products`)
  - GET `/api/products` → `{ products: [...] }`
  - GET `/api/products/:pid` → objeto de producto o 404 si no existe
  - POST `/api/products` → crea un producto (201)
  - PUT `/api/products/:pid` → actualiza campos permitidos (200)
  - DELETE `/api/products/:pid` → elimina un producto (204)

- Carritos (`/api/carts`)
  - POST `/api/carts` → crea un carrito (201). Body opcional para inicializar productos.
  - GET `/api/carts/:cid` → lista de productos del carrito en formato `{ product, quantity }` (200)
  - POST `/api/carts/:cid/product/:pid` → agrega/incrementa un producto en el carrito; body opcional `quantity` (200)

## Cuerpos de ejemplo (JSON)

- Crear producto (POST `/api/products`)
```json
{
  "title": "Zapatos",
  "description": "Zapatos de cuero",
  "code": "ZAP-001",
  "price": 1200,
  "status": true,
  "stock": 15,
  "category": "calzado",
  "thumbnails": ["/imgs/zap1.png", "/imgs/zap2.png"]
}
```

- Actualizar producto (PUT `/api/products/:pid`)
```json
{
  "price": 1100,
  "stock": 20,
  "title": "Zapatos (nuevo título opcional)"
}
```

- Crear carrito (POST `/api/carts`)
```json
{
  "products": [
    { "id": 1, "quantity": 3 },
    { "id": 2, "quantity": 1 }
  ]
}
```
Notas:
- `products` es opcional. Si se omite o es vacío, el carrito se crea como `{ "id": <auto>, "products": [] }`.
- Se valida que cada `id` exista en [data/products.json](data/products.json) y que `quantity` sea > 0.
- Si hay `id` duplicados se suman las cantidades.

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
