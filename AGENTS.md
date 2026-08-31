# Instrucciones de trabajo

Trabaja siguiendo la arquitectura fisica de `American`:

- Backend en `backend/`.
- Frontend en `frontend/`.
- Backend organizado en `config`, `controllers`, `middleware`, `models`, `routes`, `services` y `prisma`.
- Frontend organizado en `src/components`, `src/pages`, `src/services`, `src/styles` y `src/utils`.

## Tecnologias obligatorias

- Usar npm.
- Backend en Node.js + Express + JavaScript.
- No usar NestJS.
- Frontend en React + Vite + JavaScript.
- Usar Tailwind CSS.
- PostgreSQL como base de datos.
- Prisma como schema y cliente de datos.
- Usar nodemon para recarga local del backend.

## Ejecucion

- No inicies servidores automaticamente.
- No abras navegadores automaticamente.
- No ejecutes Docker sin autorizacion del usuario.
- Si necesitas ejecutar el proyecto, pregunta primero.

## Playwright y E2E

- No crear, modificar, instalar ni ejecutar Playwright o pruebas E2E sin autorizacion expresa del usuario.
- Si el usuario no menciona E2E, asumir que no esta autorizado.

## Base de datos

- La base local se llama `ERP`.
- El schema vive en `backend/prisma/schema.prisma`.
- El seed vive en `backend/prisma/seed.js`.
- Todas las consultas funcionales deben filtrar por `tenantId`.
- No subir credenciales reales; la `.env` incluida es solo de desarrollo.

## Validacion manual

El usuario realizara las pruebas completas de interfaz. Al terminar una funcionalidad, entregar pasos manuales breves con datos a ingresar y resultado esperado.
