# Seguridad

## Modelo de acceso

Entidades base:

- `User`
- `Role`
- `Permission`
- `UserRole`
- `RolePermission`
- `UserCompanyScope`
- `UserBranchScope`

## Permisos iniciales

- `company.view`
- `company.create`
- `company.update`
- `company.disable`
- `branch.view`
- `branch.create`
- `branch.update`
- `branch.disable`
- `catalog.view`
- `catalog.create`
- `catalog.update`
- `catalog.disable`
- `inventory.read`
- `inventory.kardex.read`
- `stock_entry.read`
- `stock_entry.create`
- `stock_entry.confirm`
- `stock_transfer.read`
- `stock_transfer.create`
- `stock_transfer.request`
- `stock_transfer.approve`
- `stock_transfer.dispatch`
- `stock_transfer.receive`
- `sale.read`
- `sale.create`
- `role.view`
- `role.create`
- `role.update`
- `role.assign`
- `user.view`
- `user.manage`

## Reglas

- Denegar por defecto.
- Un usuario puede tener varios roles.
- Un rol puede tener varios permisos.
- El alcance puede limitarse por empresa y sucursal.
- La API valida autenticacion, tenant, permiso y scope.
- El frontend nunca decide permisos por si solo.

## Tenancy

- El token JWT incluye `userId` y `tenantId`.
- Todas las consultas funcionales incluyen `tenantId`.
- Relaciones cruzadas validan que ambos lados pertenezcan al mismo tenant.
- Logs y errores no exponen datos de otros tenants.

## Secretos

- La `.env` incluida es solo de desarrollo local.
- En ambientes compartidos o productivos se deben rotar todos los secretos.
- Nunca reutilizar la password demo fuera de desarrollo.
