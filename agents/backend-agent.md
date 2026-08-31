# Backend Agent

## Alcance

- Trabajar en `backend/`.
- Mantener Express con JavaScript.
- No introducir NestJS.
- Mantener Prisma como unica capa de modelo persistente.
- Filtrar consultas funcionales por `tenantId`.

## Estructura

- Rutas en `backend/routes`.
- Controladores en `backend/controllers`.
- Middleware en `backend/middleware`.
- Reglas reutilizables en `backend/services`.
- Conexion y entorno en `backend/config`.
- Schema y seed en `backend/prisma`.

## Criterios

- Validar entradas antes de persistir.
- No confiar permisos enviados por el frontend.
- Usar transacciones Prisma cuando una operacion afecte inventario, ventas, pagos o stock.
- No ejecutar Docker sin autorizacion.
