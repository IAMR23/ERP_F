const PERMISSIONS = [
  "company.view",
  "company.create",
  "company.update",
  "company.disable",
  "branch.view",
  "branch.create",
  "branch.update",
  "branch.disable",
  "catalog.view",
  "catalog.create",
  "catalog.update",
  "catalog.disable",
  "role.view",
  "role.create",
  "role.update",
  "role.assign",
  "user.view",
  "user.manage",
  "person.read",
  "person.create",
  "person.update",
  "person.disable",
  "supplier.read",
  "supplier.create",
  "supplier.update",
  "supplier.disable",
  "warehouse.read",
  "warehouse.create",
  "warehouse.update",
  "warehouse.disable",
  "inventory.read",
  "inventory.kardex.read",
  "stock_entry.read",
  "stock_entry.create",
  "stock_entry.confirm",
  "stock_transfer.read",
  "stock_transfer.create",
  "stock_transfer.request",
  "stock_transfer.approve",
  "stock_transfer.dispatch",
  "stock_transfer.receive",
  "stock_adjustment.read",
  "stock_adjustment.create",
  "stock_adjustment.approve",
  "stock_count.read",
  "stock_count.create",
  "stock_count.approve",
  "sale.read",
  "sale.create"
];

function mapUserPermissions(user) {
  return user.roles.flatMap((userRole) =>
    userRole.role.permissions.map((rolePermission) => rolePermission.permission.code)
  );
}

module.exports = {
  PERMISSIONS,
  mapUserPermissions
};
