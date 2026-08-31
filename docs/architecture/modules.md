# Modulos del ERP

## Backend

| Carpeta | Responsabilidad |
| --- | --- |
| `backend/config` | Variables de entorno, Prisma Client y conexion a base. |
| `backend/controllers` | Controladores Express por modulo. |
| `backend/routes` | Rutas REST y montaje de endpoints. |
| `backend/middleware` | Autenticacion, permisos, errores y validaciones transversales. |
| `backend/models` | Referencia de modelos; el schema real vive en Prisma. |
| `backend/services` | Reglas reutilizables, permisos y casos de uso compartidos. |
| `backend/prisma` | `schema.prisma`, seed y scripts de base de datos. |

## Modulos funcionales

| Modulo | Responsabilidad |
| --- | --- |
| `auth` | Login, JWT, sesion actual, usuario y permisos. |
| `tenancy` | Resolucion de tenant desde token, alcance y filtros por tenant. |
| `companies` | Empresas legales, datos tributarios, moneda y zona horaria. |
| `branches` | Sucursales, bodegas, cajas y puntos de emision. |
| `users` | Usuarios, perfiles y alcance por empresa/sucursal. |
| `access-control` | Roles, permisos, denegar por defecto y auditoria administrativa. |
| `catalog` | Categorias, subcategorias, productos, servicios e impuestos. |
| `inventory` | Existencias, movimientos, kardex, ingresos, ajustes y transferencias. |
| `sales` | Venta, detalle, totales, pagos iniciales y confirmacion. |
| `payments` | Metodos de pago, pagos, cartera y aplicaciones de pago. |
| `electronic-documents` | Preparacion de documentos electronicos, XML/RIDE y estados futuros. |
| `credit-notes` | Nota total/parcial, limites acreditables y devolucion fisica. |
| `audit` | Registro de acciones administrativas y operaciones sensibles. |
| `health` | Estado de API y base de datos. |

## Frontend

| Carpeta | Responsabilidad |
| --- | --- |
| `frontend/src/components` | Componentes reutilizables. |
| `frontend/src/pages` | Pantallas completas. |
| `frontend/src/services` | Cliente API y servicios por dominio. |
| `frontend/src/utils` | Utilidades de sesion, permisos y formato. |
| `frontend/src/styles` | Tailwind y estilos globales. |

## Convenciones

- Todas las consultas funcionales filtran por `tenantId`.
- `companyId`, `branchId` y `warehouseId` se agregan cuando corresponda.
- La API siempre decide permisos; el frontend solo oculta acciones.

## Modulo de productos

- Categorias y subcategorias se gestionan antes de productos.
- La subcategoria siempre pertenece a una categoria del mismo tenant.
- El producto guarda `companyId` y usa la sucursal activa principal de esa empresa como `branchId` operativo inicial.
- `pvp1`, `pvp2` y `pvp3` viven en `CatalogItem`.
- El IVA usa `TaxRate`: `IVA_15` para productos con IVA y `IVA_0` para productos sin IVA.
- La imagen referencial se comprime a WebP y se guarda en `backend/uploads/products`.
