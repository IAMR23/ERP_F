# ERP

Nuevo proyecto ERP basado en las entidades y avance funcional del POS, pero con estructura de carpetas alineada a `American`.

## Stack

- Backend: Node.js, Express, JavaScript, Prisma y PostgreSQL.
- Frontend: React, Vite, JavaScript y Tailwind CSS.
- Recarga backend: nodemon.
- Base local: PostgreSQL con base `ERP`.
- Gestor de paquetes: npm.

## Estructura

```text
ERP/
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

## Inicio rapido

Cuando quieras levantarlo:

```cmd
cd backend
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

En otra terminal:

```cmd
cd frontend
npm install
npm run dev
```

Credenciales demo:

- Email: `admin@erp.local`
- Password: `Admin123!`

URLs por defecto:

- API: `http://localhost:3100/api/v1`
- Web: `http://localhost:5175`

## Base de datos

La base debe llamarse `ERP`. El proyecto trae:

- `docker-compose.yml` para PostgreSQL local cuando decidas usar Docker.
- `backend/scripts/create-database.sql` por si prefieres crearla manualmente.
- `backend/prisma/schema.prisma` con las entidades base tomadas del POS.
- `backend/prisma/seed.js` con usuario principal y datos demo.

No se incluyen pruebas Playwright ni E2E.
