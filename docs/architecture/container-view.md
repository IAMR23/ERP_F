# Vista de contenedores

## Estructura de carpetas

```text
backend/
  config/
  controllers/
  middleware/
  models/
  prisma/
  routes/
  services/
  index.js
frontend/
  public/
  src/
    components/
    pages/
    services/
    styles/
    utils/
docs/
agents/
```

## Contenedores logicos

| Contenedor | Stack | Responsabilidad |
| --- | --- | --- |
| `backend` | Node.js, Express, JavaScript | REST API, autenticacion, autorizacion, validaciones, transacciones Prisma y auditoria. |
| `frontend` | React, Vite, JavaScript, Tailwind | UI administrativa y POS, consumo REST, sesion local y flujos operativos. |
| `backend/prisma` | Prisma, PostgreSQL | Schema, seed y sincronizacion de datos. |
| `docs` | Markdown | Arquitectura, reglas, roadmap y reportes de avance. |
| `agents` | Markdown | Guias de trabajo por area. |

## Infraestructura local

Docker Compose queda preparado solo para PostgreSQL con base `ERP`. No debe ejecutarse sin autorizacion del usuario.

## Comunicacion

- Web llama a API por REST.
- API autentica con JWT.
- API persiste con Prisma/PostgreSQL.
- El `tenantId` se obtiene del usuario autenticado y no desde el frontend.
