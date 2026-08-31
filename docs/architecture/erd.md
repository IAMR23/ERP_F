# ERD

El ERP conserva el modelo de datos avanzado del POS como base inicial. El schema fuente vive en:

```text
backend/prisma/schema.prisma
```

## Diagrama principal

```mermaid
erDiagram
  Tenant ||--o{ Company : owns
  Tenant ||--o{ User : has
  Company ||--o{ Branch : has
  Branch ||--o{ Warehouse : has
  Company ||--o{ Supplier : buys_from

  User ||--o{ UserRole : assigned
  Role ||--o{ UserRole : grants
  Role ||--o{ RolePermission : contains
  Permission ||--o{ RolePermission : permits
  User ||--o{ UserCompanyScope : scoped
  Company ||--o{ UserCompanyScope : limits
  User ||--o{ UserBranchScope : scoped
  Branch ||--o{ UserBranchScope : limits

  Tenant ||--o{ Category : owns
  Category ||--o{ Subcategory : has
  Subcategory ||--o{ CatalogItem : has
  CatalogItem ||--o{ StockBalance : product_only
  Warehouse ||--o{ StockBalance : stores
  CatalogItem ||--o{ InventoryMovement : product_only
  Warehouse ||--o{ InventoryMovement : records

  Supplier ||--o{ StockEntry : supplies
  StockEntry ||--o{ StockEntryLine : contains
  Warehouse ||--o{ StockTransfer : origin
  StockTransfer ||--o{ StockTransferLine : contains
  Warehouse ||--o{ StockAdjustment : adjusted
  StockAdjustment ||--o{ StockAdjustmentLine : contains
  Warehouse ||--o{ StockCount : counted
  StockCount ||--o{ StockCountLine : contains

  Company ||--o{ Sale : issues
  Branch ||--o{ Sale : issues
  Warehouse ||--o{ Sale : stock_source
  Sale ||--o{ SaleLine : contains
  CatalogItem ||--o{ SaleLine : sold_as_snapshot
  Sale ||--o{ SalePayment : receives
  PaymentMethod ||--o{ SalePayment : method
```

## Restricciones recomendadas

- Indices compuestos por `tenantId` y claves de busqueda frecuentes.
- Unicidad por tenant para codigos internos relevantes.
- `StockBalance` unico por tenant, bodega y producto.
- `idempotencyKey` unica por tenant en movimientos criticos.
- Validaciones de tenant coherente entre entidades relacionadas.
