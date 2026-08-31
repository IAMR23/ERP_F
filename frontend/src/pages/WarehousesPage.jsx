import {
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  CheckCircle2,
  ClipboardList,
  FileText,
  PackagePlus,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Warehouse
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createStockEntry,
  createStockTransfer,
  createWarehouse,
  getWarehouseOptions,
  getWarehouses
} from "../services/warehouseService";

const emptyWarehouseForm = {
  branchId: "",
  code: "",
  name: "",
  description: "",
  isDefault: false
};

const emptyLine = {
  catalogItemId: "",
  quantity: "1",
  unitCost: "0"
};

const emptyTransferLine = {
  catalogItemId: "",
  quantity: "1"
};

const inputClass =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
const labelClass = "text-xs font-medium uppercase text-slate-500";
const iconButtonClass =
  "inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-3 text-sm text-ink hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50";

function formatNumber(value, decimals = 2) {
  return new Intl.NumberFormat("es-EC", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(Number(value || 0));
}

export default function WarehousesPage({ activeView = "warehouses" }) {
  const [warehouses, setWarehouses] = useState([]);
  const [options, setOptions] = useState({ branches: [], products: [], suppliers: [] });
  const [warehouseForm, setWarehouseForm] = useState(emptyWarehouseForm);
  const [entryForm, setEntryForm] = useState({
    branchId: "",
    warehouseId: "",
    type: "MANUAL",
    supplierId: "",
    documentNumber: "",
    documentDate: "",
    fiscalAuth: "",
    reference: "",
    reason: "",
    lines: [{ ...emptyLine }]
  });
  const [transferForm, setTransferForm] = useState({
    sourceWarehouseId: "",
    destinationWarehouseId: "",
    reference: "",
    reason: "",
    lines: [{ ...emptyTransferLine }]
  });
  const [inventoryFilters, setInventoryFilters] = useState({
    branchId: "",
    warehouseId: "",
    catalogItemId: ""
  });
  const [loading, setLoading] = useState(true);
  const [savingWarehouse, setSavingWarehouse] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [savingTransfer, setSavingTransfer] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [optionRows, warehouseRows] = await Promise.all([getWarehouseOptions(), getWarehouses()]);
      const nextWarehouses = warehouseRows.warehouses || [];

      setOptions({
        branches: optionRows.branches || [],
        products: optionRows.products || [],
        suppliers: optionRows.suppliers || []
      });
      setWarehouses(nextWarehouses);
      setWarehouseForm((current) => ({
        ...current,
        branchId: current.branchId || optionRows.branches?.[0]?.id || ""
      }));
      setEntryForm((current) => {
        const currentWarehouse = nextWarehouses.find((warehouse) => warehouse.id === current.warehouseId);
        const branchId =
          current.branchId || currentWarehouse?.branch?.id || nextWarehouses[0]?.branch?.id || optionRows.branches?.[0]?.id || "";
        const warehouseId =
          currentWarehouse?.branch?.id === branchId
            ? currentWarehouse.id
            : nextWarehouses.find((warehouse) => warehouse.branch.id === branchId)?.id || "";

        return {
          ...current,
          branchId,
          warehouseId
        };
      });
      setTransferForm((current) => {
        const sourceWarehouseId = current.sourceWarehouseId || nextWarehouses[0]?.id || "";
        const sourceWarehouse = nextWarehouses.find((warehouse) => warehouse.id === sourceWarehouseId);
        const currentDestination = nextWarehouses.find(
          (warehouse) => warehouse.id === current.destinationWarehouseId
        );
        const currentDestinationIsValid =
          currentDestination &&
          currentDestination.id !== sourceWarehouseId &&
          (!sourceWarehouse || currentDestination.company.id === sourceWarehouse.company.id);
        const destinationWarehouseId =
          (currentDestinationIsValid ? currentDestination.id : "") ||
          nextWarehouses.find(
            (warehouse) =>
              warehouse.id !== sourceWarehouseId &&
              (!sourceWarehouse || warehouse.company.id === sourceWarehouse.company.id)
          )?.id ||
          "";

        return {
          ...current,
          sourceWarehouseId,
          destinationWarehouseId
        };
      });
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === entryForm.warehouseId),
    [entryForm.warehouseId, warehouses]
  );

  const productsForWarehouse = useMemo(() => {
    if (!selectedWarehouse) {
      return [];
    }

    return options.products.filter((product) => product.companyId === selectedWarehouse.company.id);
  }, [options.products, selectedWarehouse]);

  const entryWarehouses = useMemo(
    () =>
      warehouses.filter(
        (warehouse) => !entryForm.branchId || warehouse.branch.id === entryForm.branchId
      ),
    [entryForm.branchId, warehouses]
  );

  const suppliersForWarehouse = useMemo(() => {
    if (!selectedWarehouse) {
      return [];
    }

    return options.suppliers.filter((supplier) => supplier.companyId === selectedWarehouse.company.id);
  }, [options.suppliers, selectedWarehouse]);

  const sourceTransferWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === transferForm.sourceWarehouseId),
    [transferForm.sourceWarehouseId, warehouses]
  );

  const destinationTransferWarehouses = useMemo(() => {
    if (!sourceTransferWarehouse) {
      return warehouses.filter((warehouse) => warehouse.id !== transferForm.sourceWarehouseId);
    }

    return warehouses.filter(
      (warehouse) =>
        warehouse.id !== sourceTransferWarehouse.id &&
        warehouse.company.id === sourceTransferWarehouse.company.id &&
        warehouse.status === "ACTIVE"
    );
  }, [sourceTransferWarehouse, transferForm.sourceWarehouseId, warehouses]);

  const transferStockItems = useMemo(() => {
    if (!sourceTransferWarehouse) {
      return [];
    }

    return sourceTransferWarehouse.stockBalances
      .map((balance) => ({
        ...balance,
        available: Math.max(0, Number(balance.onHand) - Number(balance.reserved))
      }))
      .filter((balance) => balance.available > 0);
  }, [sourceTransferWarehouse]);

  const transferTotalUnits = transferForm.lines.reduce(
    (sum, line) => sum + Number(line.quantity || 0),
    0
  );

  const inventoryRows = useMemo(
    () =>
      warehouses.flatMap((warehouse) =>
        warehouse.stockBalances
          .filter((balance) => {
            return (
              (!inventoryFilters.branchId || warehouse.branch.id === inventoryFilters.branchId) &&
              (!inventoryFilters.warehouseId || warehouse.id === inventoryFilters.warehouseId) &&
              (!inventoryFilters.catalogItemId || balance.product.id === inventoryFilters.catalogItemId)
            );
          })
          .map((balance) => ({
            id: balance.id,
            product: balance.product,
            branch: warehouse.branch,
            warehouse: { id: warehouse.id, code: warehouse.code, name: warehouse.name },
            onHand: balance.onHand,
            averageCost: balance.averageCost
          }))
      ),
    [inventoryFilters, warehouses]
  );

  const entryTotal = entryForm.lines.reduce(
    (sum, line) => sum + Number(line.quantity || 0) * Number(line.unitCost || 0),
    0
  );

  function updateInventoryFilter(field, value) {
    setInventoryFilters((current) => {
      const next = { ...current, [field]: value };

      if (field === "branchId") {
        const warehouseMatchesBranch = warehouses.some(
          (warehouse) => warehouse.id === current.warehouseId && warehouse.branch.id === value
        );
        next.warehouseId = warehouseMatchesBranch ? current.warehouseId : "";
      }

      return next;
    });
  }

  function updateEntryLine(index, field, value) {
    setEntryForm((current) => {
      const lines = current.lines.map((line, lineIndex) => {
        if (lineIndex !== index) {
          return line;
        }

        if (field === "catalogItemId") {
          const product = options.products.find((item) => item.id === value);
          return {
            ...line,
            catalogItemId: value,
            unitCost: product ? String(product.cost) : line.unitCost
          };
        }

        return { ...line, [field]: value };
      });

      return { ...current, lines };
    });
  }

  function addEntryLine() {
    setEntryForm((current) => ({ ...current, lines: [...current.lines, { ...emptyLine }] }));
  }

  function removeEntryLine(index) {
    setEntryForm((current) => ({
      ...current,
      lines: current.lines.filter((_, lineIndex) => lineIndex !== index)
    }));
  }

  function updateTransferLine(index, field, value) {
    setTransferForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line
      )
    }));
  }

  function addTransferLine() {
    setTransferForm((current) => ({
      ...current,
      lines: [...current.lines, { ...emptyTransferLine }]
    }));
  }

  function removeTransferLine(index) {
    setTransferForm((current) => ({
      ...current,
      lines: current.lines.filter((_, lineIndex) => lineIndex !== index)
    }));
  }

  async function handleWarehouseSubmit(event) {
    event.preventDefault();
    setSavingWarehouse(true);
    setError("");
    setNotice("");

    try {
      const response = await createWarehouse(warehouseForm);
      setNotice("Bodega creada");
      setWarehouseForm({
        ...emptyWarehouseForm,
        branchId: warehouseForm.branchId
      });
      await loadData();
      setEntryForm((current) => ({ ...current, warehouseId: response.warehouse.id }));
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setSavingWarehouse(false);
    }
  }

  async function handleEntrySubmit(event) {
    event.preventDefault();
    setSavingEntry(true);
    setError("");
    setNotice("");

    try {
      await createStockEntry(entryForm.warehouseId, {
        type: entryForm.type,
        supplierId: entryForm.type === "PURCHASE_INVOICE" ? entryForm.supplierId : null,
        documentNumber: entryForm.type === "PURCHASE_INVOICE" ? entryForm.documentNumber : null,
        documentDate: entryForm.type === "PURCHASE_INVOICE" ? entryForm.documentDate : null,
        fiscalAuth: entryForm.type === "PURCHASE_INVOICE" ? entryForm.fiscalAuth : null,
        reference: entryForm.reference,
        reason: entryForm.reason,
        lines: entryForm.lines
      });
      setNotice("Productos agregados a la bodega");
      setEntryForm((current) => ({
        ...current,
        supplierId: "",
        documentNumber: "",
        documentDate: "",
        fiscalAuth: "",
        reference: "",
        reason: "",
        lines: [{ ...emptyLine }]
      }));
      await loadData();
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setSavingEntry(false);
    }
  }

  async function handleTransferSubmit(event) {
    event.preventDefault();
    setSavingTransfer(true);
    setError("");
    setNotice("");

    try {
      await createStockTransfer(transferForm.sourceWarehouseId, {
        destinationWarehouseId: transferForm.destinationWarehouseId,
        reference: transferForm.reference,
        reason: transferForm.reason,
        lines: transferForm.lines
      });
      setNotice("Transferencia registrada");
      setTransferForm((current) => ({
        ...current,
        reference: "",
        reason: "",
        lines: [{ ...emptyTransferLine }]
      }));
      await loadData();
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setSavingTransfer(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Bodegas</h2>
          <p className="mt-1 text-sm text-slate-500">Inventario asociado por sucursal.</p>
        </div>
        <button className={iconButtonClass} onClick={loadData} type="button" disabled={loading}>
          <RefreshCw size={17} aria-hidden="true" />
          <span className="ml-2">Actualizar</span>
        </button>
      </div>

      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={17} aria-hidden="true" />
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={17} aria-hidden="true" />
          {notice}
        </div>
      ) : null}

      {activeView === "warehouses" ? (
      <>
      <section className="mb-5 rounded-lg border border-line bg-white">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Boxes size={18} className="text-brand" aria-hidden="true" />
          <h3 className="font-medium text-ink">Inventario por bodega</h3>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-3">
          <label className="block">
            <span className={labelClass}>Sucursal</span>
            <select
              className={`${inputClass} mt-1`}
              value={inventoryFilters.branchId}
              onChange={(event) => updateInventoryFilter("branchId", event.target.value)}
            >
              <option value="">Todas</option>
              {options.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} - {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Bodega</span>
            <select
              className={`${inputClass} mt-1`}
              value={inventoryFilters.warehouseId}
              onChange={(event) => updateInventoryFilter("warehouseId", event.target.value)}
            >
              <option value="">Todas</option>
              {warehouses
                .filter(
                  (warehouse) =>
                    !inventoryFilters.branchId ||
                    warehouse.branch.id === inventoryFilters.branchId
                )
                .map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.branch.name} / {warehouse.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Producto</span>
            <select
              className={`${inputClass} mt-1`}
              value={inventoryFilters.catalogItemId}
              onChange={(event) => updateInventoryFilter("catalogItemId", event.target.value)}
            >
              <option value="">Todos</option>
              {options.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.internalCode} - {product.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="overflow-x-auto border-t border-line">
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                {["Producto", "Sucursal", "Bodega", "Stock", "Costo prom."].map((column) => (
                  <th key={column} className="px-4 py-3 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {inventoryRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{row.product.name}</p>
                    <p className="text-xs text-slate-500">{row.product.internalCode}</p>
                  </td>
                  <td className="px-4 py-3">{row.branch.name}</td>
                  <td className="px-4 py-3">{row.warehouse.name}</td>
                  <td className="px-4 py-3 text-right font-medium text-ink">
                    {formatNumber(row.onHand, 4)}
                  </td>
                  <td className="px-4 py-3 text-right">${formatNumber(row.averageCost, 2)}</td>
                </tr>
              ))}
              {!inventoryRows.length ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan="5">
                    Sin stock para los filtros seleccionados
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <div className="rounded-lg border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <Warehouse size={18} className="text-brand" aria-hidden="true" />
              <h3 className="font-medium text-ink">Bodegas por sucursal</h3>
            </div>
            <span className="text-sm text-slate-500">{warehouses.length}</span>
          </div>

          <div className="divide-y divide-line">
            {loading ? (
              <p className="px-4 py-5 text-sm text-slate-500">Cargando...</p>
            ) : null}

            {!loading && !warehouses.length ? (
              <p className="px-4 py-5 text-sm text-slate-500">Sin bodegas registradas.</p>
            ) : null}

            {warehouses.map((warehouse) => (
              <article key={warehouse.id} className="px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink">{warehouse.name}</p>
                      {warehouse.isDefault ? (
                        <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                          Principal
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {warehouse.code} | {warehouse.branch.name} | {warehouse.company.tradeName}
                    </p>
                    {warehouse.description ? (
                      <p className="mt-2 text-sm text-slate-600">{warehouse.description}</p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-right">
                    <div className="rounded-lg border border-line px-3 py-2">
                      <p className="text-xs text-slate-500">Items</p>
                      <p className="font-semibold text-ink">{warehouse.stockItems}</p>
                    </div>
                    <div className="rounded-lg border border-line px-3 py-2">
                      <p className="text-xs text-slate-500">Unidades</p>
                      <p className="font-semibold text-ink">{formatNumber(warehouse.totalUnits, 4)}</p>
                    </div>
                  </div>
                </div>

                {warehouse.stockBalances.length ? (
                  <div className="mt-4 overflow-hidden rounded-lg border border-line">
                    <div className="grid grid-cols-[1fr_110px_110px] bg-mist px-3 py-2 text-xs font-medium uppercase text-slate-500">
                      <span>Producto</span>
                      <span className="text-right">Stock</span>
                      <span className="text-right">Costo prom.</span>
                    </div>
                    {warehouse.stockBalances.map((balance) => (
                      <div
                        key={balance.id}
                        className="grid grid-cols-[1fr_110px_110px] border-t border-line px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium text-ink">{balance.product.name}</p>
                          <p className="text-xs text-slate-500">{balance.product.internalCode}</p>
                        </div>
                        <span className="self-center text-right text-ink">
                          {formatNumber(balance.onHand, 4)}
                        </span>
                        <span className="self-center text-right text-ink">
                          ${formatNumber(balance.averageCost, 2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>

        <form className="rounded-lg border border-line bg-white" onSubmit={handleWarehouseSubmit}>
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <Plus size={18} className="text-accent" aria-hidden="true" />
            <h3 className="font-medium text-ink">Nueva bodega</h3>
          </div>
          <div className="space-y-4 p-4">
            <label className="block">
              <span className={labelClass}>Sucursal</span>
              <select
                className={`${inputClass} mt-1`}
                value={warehouseForm.branchId}
                onChange={(event) =>
                  setWarehouseForm((current) => ({ ...current, branchId: event.target.value }))
                }
                required
              >
                <option value="">Seleccionar</option>
                {options.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} - {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Codigo</span>
                <input
                  className={`${inputClass} mt-1 uppercase`}
                  value={warehouseForm.code}
                  onChange={(event) =>
                    setWarehouseForm((current) => ({ ...current, code: event.target.value }))
                  }
                  maxLength={24}
                  required
                />
              </label>
              <label className="block">
                <span className={labelClass}>Nombre</span>
                <input
                  className={`${inputClass} mt-1`}
                  value={warehouseForm.name}
                  onChange={(event) =>
                    setWarehouseForm((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className={labelClass}>Descripcion</span>
              <textarea
                className="mt-1 min-h-20 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                value={warehouseForm.description}
                onChange={(event) =>
                  setWarehouseForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
                type="checkbox"
                checked={warehouseForm.isDefault}
                onChange={(event) =>
                  setWarehouseForm((current) => ({ ...current, isDefault: event.target.checked }))
                }
              />
              Bodega principal
            </label>

            <button
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={savingWarehouse}
            >
              <Save size={17} aria-hidden="true" />
              Guardar bodega
            </button>
          </div>
        </form>
      </section>
      </>
      ) : null}

      {activeView === "entries" ? (
      <form className="mt-5 rounded-lg border border-line bg-white" onSubmit={handleEntrySubmit}>
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <PackagePlus size={18} className="text-brand" aria-hidden="true" />
            <h3 className="font-medium text-ink">Agregar productos</h3>
          </div>
          <div className="inline-flex rounded-lg border border-line bg-mist p-1">
            <button
              className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm ${
                entryForm.type === "MANUAL" ? "bg-white text-ink shadow-sm" : "text-slate-600"
              }`}
              type="button"
              onClick={() => setEntryForm((current) => ({ ...current, type: "MANUAL" }))}
            >
              <ClipboardList size={16} aria-hidden="true" />
              Manual
            </button>
            <button
              className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm ${
                entryForm.type === "PURCHASE_INVOICE" ? "bg-white text-ink shadow-sm" : "text-slate-600"
              }`}
              type="button"
              onClick={() => setEntryForm((current) => ({ ...current, type: "PURCHASE_INVOICE" }))}
            >
              <FileText size={16} aria-hidden="true" />
              Factura proveedor
            </button>
          </div>
        </div>

        <div className="space-y-5 p-4">
          <div className="grid gap-4 lg:grid-cols-4">
            <label className="block">
              <span className={labelClass}>Sucursal</span>
              <select
                className={`${inputClass} mt-1`}
                value={entryForm.branchId}
                onChange={(event) =>
                  setEntryForm((current) => {
                    const branchId = event.target.value;
                    const firstWarehouse =
                      warehouses.find((warehouse) => warehouse.branch.id === branchId) || null;

                    return {
                      ...current,
                      branchId,
                      warehouseId: firstWarehouse?.id || "",
                      supplierId: "",
                      lines: [{ ...emptyLine }]
                    };
                  })
                }
                required
              >
                <option value="">Seleccionar</option>
                {options.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} - {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Bodega</span>
              <select
                className={`${inputClass} mt-1`}
                value={entryForm.warehouseId}
                onChange={(event) =>
                  setEntryForm((current) => {
                    const warehouse = warehouses.find((item) => item.id === event.target.value);

                    return {
                      ...current,
                      branchId: warehouse?.branch.id || current.branchId,
                      warehouseId: event.target.value,
                      supplierId: "",
                      lines: [{ ...emptyLine }]
                    };
                  })
                }
                required
              >
                <option value="">Seleccionar</option>
                {entryWarehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Referencia</span>
              <input
                className={`${inputClass} mt-1`}
                value={entryForm.reference}
                onChange={(event) =>
                  setEntryForm((current) => ({ ...current, reference: event.target.value }))
                }
              />
            </label>

            <label className="block">
              <span className={labelClass}>Motivo</span>
              <input
                className={`${inputClass} mt-1`}
                value={entryForm.reason}
                onChange={(event) =>
                  setEntryForm((current) => ({ ...current, reason: event.target.value }))
                }
              />
            </label>
          </div>

          {entryForm.type === "PURCHASE_INVOICE" ? (
            <div className="grid gap-4 lg:grid-cols-4">
              <label className="block lg:col-span-2">
                <span className={labelClass}>Proveedor</span>
                <select
                  className={`${inputClass} mt-1`}
                  value={entryForm.supplierId}
                  onChange={(event) =>
                    setEntryForm((current) => ({ ...current, supplierId: event.target.value }))
                  }
                  required
                >
                  <option value="">Seleccionar</option>
                  {suppliersForWarehouse.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.tradeName || supplier.legalName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClass}>Factura</span>
                <input
                  className={`${inputClass} mt-1`}
                  value={entryForm.documentNumber}
                  onChange={(event) =>
                    setEntryForm((current) => ({ ...current, documentNumber: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="block">
                <span className={labelClass}>Fecha</span>
                <input
                  className={`${inputClass} mt-1`}
                  type="date"
                  value={entryForm.documentDate}
                  onChange={(event) =>
                    setEntryForm((current) => ({ ...current, documentDate: event.target.value }))
                  }
                />
              </label>
              <label className="block lg:col-span-4">
                <span className={labelClass}>Autorizacion SRI</span>
                <input
                  className={`${inputClass} mt-1`}
                  value={entryForm.fiscalAuth}
                  onChange={(event) =>
                    setEntryForm((current) => ({ ...current, fiscalAuth: event.target.value }))
                  }
                />
              </label>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-lg border border-line">
            <div className="overflow-x-auto">
              <div className="grid min-w-[720px] grid-cols-[1fr_130px_150px_120px_52px] bg-mist px-3 py-2 text-xs font-medium uppercase text-slate-500">
                <span>Producto</span>
                <span className="text-right">Cantidad</span>
                <span className="text-right">Costo unit.</span>
                <span className="text-right">Total</span>
                <span />
              </div>
              {entryForm.lines.map((line, index) => (
                <div
                  key={`${index}-${line.catalogItemId}`}
                  className="grid min-w-[720px] grid-cols-[1fr_130px_150px_120px_52px] items-center gap-3 border-t border-line px-3 py-3"
                >
                  <select
                    className={inputClass}
                    value={line.catalogItemId}
                    onChange={(event) => updateEntryLine(index, "catalogItemId", event.target.value)}
                    required
                  >
                    <option value="">Seleccionar producto</option>
                    {productsForWarehouse.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.internalCode} - {product.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className={`${inputClass} text-right`}
                    min="0.0001"
                    step="0.0001"
                    type="number"
                    value={line.quantity}
                    onChange={(event) => updateEntryLine(index, "quantity", event.target.value)}
                    required
                  />
                  <input
                    className={`${inputClass} text-right`}
                    min="0"
                    step="0.000001"
                    type="number"
                    value={line.unitCost}
                    onChange={(event) => updateEntryLine(index, "unitCost", event.target.value)}
                    required
                  />
                  <p className="text-right text-sm font-medium text-ink">
                    ${formatNumber(Number(line.quantity || 0) * Number(line.unitCost || 0), 2)}
                  </p>
                  <button
                    className={iconButtonClass}
                    type="button"
                    title="Quitar"
                    onClick={() => removeEntryLine(index)}
                    disabled={entryForm.lines.length === 1}
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button className={iconButtonClass} type="button" onClick={addEntryLine}>
              <Plus size={17} aria-hidden="true" />
              <span className="ml-2">Linea</span>
            </button>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="rounded-lg border border-line bg-mist px-4 py-2 text-right">
                <p className="text-xs text-slate-500">Total entrada</p>
                <p className="font-semibold text-ink">${formatNumber(entryTotal, 2)}</p>
              </div>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={savingEntry || !entryForm.warehouseId}
              >
                <Boxes size={17} aria-hidden="true" />
                Registrar entrada
              </button>
            </div>
          </div>
        </div>
      </form>
      ) : null}

      {activeView === "transfers" ? (
      <form className="mt-5 rounded-lg border border-line bg-white" onSubmit={handleTransferSubmit}>
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <ArrowRightLeft size={18} className="text-brand" aria-hidden="true" />
          <h3 className="font-medium text-ink">Transferir stock</h3>
        </div>

        <div className="space-y-5 p-4">
          <div className="grid gap-4 lg:grid-cols-4">
            <label className="block">
              <span className={labelClass}>Origen</span>
              <select
                className={`${inputClass} mt-1`}
                value={transferForm.sourceWarehouseId}
                onChange={(event) =>
                  setTransferForm((current) => {
                    const sourceWarehouseId = event.target.value;
                    const sourceWarehouse = warehouses.find((warehouse) => warehouse.id === sourceWarehouseId);
                    const destinationWarehouseId =
                      current.destinationWarehouseId &&
                      current.destinationWarehouseId !== sourceWarehouseId &&
                      (!sourceWarehouse ||
                        warehouses.find(
                          (warehouse) =>
                            warehouse.id === current.destinationWarehouseId &&
                            warehouse.company.id === sourceWarehouse.company.id
                        ))
                        ? current.destinationWarehouseId
                        : warehouses.find(
                            (warehouse) =>
                              warehouse.id !== sourceWarehouseId &&
                              (!sourceWarehouse || warehouse.company.id === sourceWarehouse.company.id)
                          )?.id || "";

                    return {
                      ...current,
                      sourceWarehouseId,
                      destinationWarehouseId,
                      lines: [{ ...emptyTransferLine }]
                    };
                  })
                }
                required
              >
                <option value="">Seleccionar</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.branch.name} / {warehouse.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Destino</span>
              <select
                className={`${inputClass} mt-1`}
                value={transferForm.destinationWarehouseId}
                onChange={(event) =>
                  setTransferForm((current) => ({
                    ...current,
                    destinationWarehouseId: event.target.value
                  }))
                }
                required
              >
                <option value="">Seleccionar</option>
                {destinationTransferWarehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.branch.name} / {warehouse.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Referencia</span>
              <input
                className={`${inputClass} mt-1`}
                value={transferForm.reference}
                onChange={(event) =>
                  setTransferForm((current) => ({ ...current, reference: event.target.value }))
                }
              />
            </label>

            <label className="block">
              <span className={labelClass}>Motivo</span>
              <input
                className={`${inputClass} mt-1`}
                value={transferForm.reason}
                onChange={(event) =>
                  setTransferForm((current) => ({ ...current, reason: event.target.value }))
                }
              />
            </label>
          </div>

          <div className="overflow-hidden rounded-lg border border-line">
            <div className="overflow-x-auto">
              <div className="grid min-w-[680px] grid-cols-[1fr_120px_130px_52px] bg-mist px-3 py-2 text-xs font-medium uppercase text-slate-500">
                <span>Producto</span>
                <span className="text-right">Disponible</span>
                <span className="text-right">Cantidad</span>
                <span />
              </div>
              {transferForm.lines.map((line, index) => {
                const stockItem = transferStockItems.find(
                  (item) => item.product.id === line.catalogItemId
                );

                return (
                  <div
                    key={`${index}-${line.catalogItemId}`}
                    className="grid min-w-[680px] grid-cols-[1fr_120px_130px_52px] items-center gap-3 border-t border-line px-3 py-3"
                  >
                    <select
                      className={inputClass}
                      value={line.catalogItemId}
                      onChange={(event) => updateTransferLine(index, "catalogItemId", event.target.value)}
                      required
                    >
                      <option value="">Seleccionar producto</option>
                      {transferStockItems.map((item) => (
                        <option key={item.product.id} value={item.product.id}>
                          {item.product.internalCode} - {item.product.name}
                        </option>
                      ))}
                    </select>
                    <span className="text-right text-sm text-ink">
                      {formatNumber(stockItem?.available || 0, 4)}
                    </span>
                    <input
                      className={`${inputClass} text-right`}
                      max={stockItem?.available || undefined}
                      min="0.0001"
                      step="0.0001"
                      type="number"
                      value={line.quantity}
                      onChange={(event) => updateTransferLine(index, "quantity", event.target.value)}
                      required
                    />
                    <button
                      className={iconButtonClass}
                      type="button"
                      title="Quitar"
                      onClick={() => removeTransferLine(index)}
                      disabled={transferForm.lines.length === 1}
                    >
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {!transferStockItems.length ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Sin stock disponible en la bodega origen.
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              className={iconButtonClass}
              type="button"
              onClick={addTransferLine}
              disabled={!transferStockItems.length}
            >
              <Plus size={17} aria-hidden="true" />
              <span className="ml-2">Linea</span>
            </button>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="rounded-lg border border-line bg-mist px-4 py-2 text-right">
                <p className="text-xs text-slate-500">Total unidades</p>
                <p className="font-semibold text-ink">{formatNumber(transferTotalUnits, 4)}</p>
              </div>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={
                  savingTransfer ||
                  !transferForm.sourceWarehouseId ||
                  !transferForm.destinationWarehouseId ||
                  !transferStockItems.length
                }
              >
                <ArrowRightLeft size={17} aria-hidden="true" />
                Registrar transferencia
              </button>
            </div>
          </div>
        </div>
      </form>
      ) : null}
    </div>
  );
}
