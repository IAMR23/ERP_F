import {
  AlertCircle,
  CheckCircle2,
  FileText,
  RefreshCw,
  RotateCcw,
  Save,
  Search
} from "lucide-react";
import { useMemo, useState } from "react";
import { createDocument, validateCreditNoteInvoice } from "../services/documentService";
import { getWarehouses } from "../services/warehouseService";

const inputClass =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:bg-slate-50 disabled:text-slate-500";
const labelClass = "text-xs font-medium uppercase text-slate-500";
const iconButtonClass =
  "inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-3 text-sm text-ink hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function quantity(value) {
  return Number(value || 0).toFixed(4);
}

function dateText(value) {
  return value ? new Date(value).toLocaleDateString("es-EC") : "";
}

function proratedLineValues(line) {
  const selectedQuantity = Number(line.quantity || 0);
  const maxQuantity = Number(line.maxQuantity || 0);
  const ratio = maxQuantity > 0 ? selectedQuantity / maxQuantity : 0;
  const unitPrice = Number(line.unitPrice || 0);
  const discountAmount = Number(line.discountAmount || 0) * ratio;
  const taxableSubtotal = Math.max(0, selectedQuantity * unitPrice - discountAmount);
  const taxRatePercent = Number(line.taxRatePercent || 0);
  const taxAmount = taxableSubtotal * (taxRatePercent / 100);

  return {
    discountAmount,
    taxableSubtotal,
    taxAmount,
    total: taxableSubtotal + taxAmount
  };
}

export default function CreditNotesPage() {
  const [validationForm, setValidationForm] = useState({
    issueDate: todayInputValue(),
    documentNumber: "",
    reason: ""
  });
  const [warehouses, setWarehouses] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [lines, setLines] = useState([]);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const availableWarehouses = useMemo(() => {
    if (!invoice) {
      return warehouses;
    }

    return warehouses.filter((warehouse) => warehouse.company?.id === invoice.companyId);
  }, [invoice, warehouses]);

  const totals = useMemo(
    () =>
      lines.reduce(
        (acc, line) => {
          const values = proratedLineValues(line);

          if (Number(line.taxRatePercent) === 15) acc.subtotal15 += values.taxableSubtotal;
          if (Number(line.taxRatePercent) === 5) acc.subtotal5 += values.taxableSubtotal;
          if (Number(line.taxRatePercent) === 0) acc.subtotal0 += values.taxableSubtotal;
          acc.discount += values.discountAmount;
          acc.tax += values.taxAmount;
          acc.total += values.total;
          return acc;
        },
        { subtotal15: 0, subtotal5: 0, subtotal0: 0, discount: 0, tax: 0, total: 0 }
      ),
    [lines]
  );

  function updateValidationForm(field, value) {
    setValidationForm((current) => ({ ...current, [field]: value }));
  }

  function updateLineQuantity(sourceLineId, value) {
    setLines((current) =>
      current.map((line) =>
        line.sourceLineId === sourceLineId
          ? {
              ...line,
              quantity: value
            }
          : line
      )
    );
  }

  async function loadWarehouses() {
    const data = await getWarehouses();
    return data.warehouses || [];
  }

  async function handleValidate(event) {
    event.preventDefault();
    setLoadingDraft(true);
    setError("");
    setNotice("");
    setInvoice(null);
    setLines([]);

    try {
      const [warehouseRows, draftData] = await Promise.all([
        warehouses.length ? Promise.resolve(warehouses) : loadWarehouses(),
        validateCreditNoteInvoice({
          documentNumber: validationForm.documentNumber,
          reason: validationForm.reason
        })
      ]);
      const draft = draftData.draft;
      const invoiceWarehouseId = draft.invoice?.warehouse?.id || "";

      setWarehouses(warehouseRows);
      setInvoice(draft.invoice);
      setWarehouseId(
        warehouseRows.some((warehouse) => warehouse.id === invoiceWarehouseId)
          ? invoiceWarehouseId
          : warehouseRows.find((warehouse) => warehouse.company?.id === draft.invoice?.companyId)?.id || ""
      );
      setLines(
        (draft.lines || []).map((line) => ({
          sourceLineId: line.sourceLineId,
          catalogItemId: line.catalogItemId,
          product: line.product,
          quantity: String(line.quantity),
          maxQuantity: line.quantity,
          unit: line.unit,
          unitPrice: line.unitPrice,
          discountAmount: line.discountAmount,
          taxRatePercent: line.taxRatePercent,
          incomeTaxRetention: line.incomeTaxRetention,
          ivaRetention: line.ivaRetention
        }))
      );
      setNotice("Factura validada");
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setLoadingDraft(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    if (!invoice) {
      setError("Valide primero el numero de factura y el motivo");
      setSaving(false);
      return;
    }

    if (!warehouseId) {
      setError("Seleccione la bodega donde regresara el stock");
      setSaving(false);
      return;
    }

    const selectedLines = lines.filter((line) => Number(line.quantity || 0) > 0);

    if (!selectedLines.length) {
      setError("Seleccione al menos un producto con cantidad mayor a 0");
      setSaving(false);
      return;
    }

    try {
      const response = await createDocument({
        documentType: "CREDIT_NOTE",
        issueDate: validationForm.issueDate,
        relatedDocumentNumber: invoice.documentNumber,
        reference: invoice.documentNumber,
        reason: validationForm.reason,
        description: validationForm.reason,
        personId: invoice.customer?.id,
        warehouseId,
        establishmentCode: invoice.establishmentCode,
        emissionPoint: invoice.emissionPoint,
        lines: selectedLines.map((line) => ({
          sourceLineId: line.sourceLineId,
          catalogItemId: line.catalogItemId,
          quantity: line.quantity
        }))
      });

      setNotice(`Nota de credito ${response.document?.documentNumber || ""} guardada y stock devuelto`);
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Notas de credito</h2>
        </div>
        <button
          className={iconButtonClass}
          disabled={loadingDraft}
          onClick={handleValidate}
          type="button"
        >
          <RefreshCw size={17} aria-hidden="true" />
          <span className="ml-2">Actualizar</span>
        </button>
      </div>

      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={17} aria-hidden="true" />
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={17} aria-hidden="true" />
          {notice}
        </div>
      ) : null}

      <form className="rounded-lg border border-line bg-white" onSubmit={handleValidate}>
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <FileText size={18} className="text-brand" aria-hidden="true" />
          <h3 className="font-medium text-ink">Validar factura</h3>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Fecha de emision">
            <input
              className={inputClass}
              onChange={(event) => updateValidationForm("issueDate", event.target.value)}
              type="date"
              value={validationForm.issueDate}
            />
          </Field>

          <Field label="# Factura">
            <input
              className={inputClass}
              onChange={(event) => updateValidationForm("documentNumber", event.target.value)}
              placeholder="001-001-000000001"
              value={validationForm.documentNumber}
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="Motivo">
              <input
                className={inputClass}
                onChange={(event) => updateValidationForm("reason", event.target.value)}
                value={validationForm.reason}
              />
            </Field>
          </div>
        </div>

        <div className="flex justify-end border-t border-line px-4 py-3">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loadingDraft}
            type="submit"
          >
            <Search size={16} aria-hidden="true" />
            Validar
          </button>
        </div>
      </form>

      {invoice ? (
        <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
          <section className="rounded-lg border border-line bg-white">
            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className={labelClass}>Factura</p>
                <p className="mt-1 font-semibold text-ink">{invoice.documentNumber}</p>
                <p className="text-sm text-slate-500">{dateText(invoice.issueDate)}</p>
              </div>
              <div>
                <p className={labelClass}>Cliente</p>
                <p className="mt-1 font-semibold text-ink">{invoice.customer?.nombre || "Sin cliente"}</p>
                <p className="text-sm text-slate-500">{invoice.customer?.identificacion || "-"}</p>
              </div>
              <div>
                <p className={labelClass}>Total factura</p>
                <p className="mt-1 font-semibold text-ink">${money(invoice.total)}</p>
                <p className="text-sm text-slate-500">{invoice.branch?.name}</p>
              </div>
              <Field label="Bodega de retorno">
                <select
                  className={inputClass}
                  onChange={(event) => setWarehouseId(event.target.value)}
                  value={warehouseId}
                >
                  <option value="">Seleccione bodega</option>
                  {availableWarehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.branch?.name} / {warehouse.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white">
            <div className="flex border-b border-line px-4">
              <button
                className="h-12 border-t-4 border-brand px-4 text-sm font-semibold text-brand"
                type="button"
              >
                Productos
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-line text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    {["Producto", "Cantidad", "Max.", "Unidad", "Precio", "IVA", "Subtotal"].map(
                      (column) => (
                        <th className="px-3 py-3 font-medium" key={column}>
                          {column}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lines.map((line) => {
                    const values = proratedLineValues(line);

                    return (
                      <tr key={line.sourceLineId}>
                        <td className="min-w-72 px-3 py-3">
                          <p className="font-medium text-ink">{line.product?.name}</p>
                          <p className="text-xs text-slate-500">{line.product?.internalCode}</p>
                        </td>
                        <td className="w-36 px-3 py-3">
                          <input
                            className={`${inputClass} text-right`}
                            max={line.maxQuantity}
                            min="0"
                            onChange={(event) => updateLineQuantity(line.sourceLineId, event.target.value)}
                            step="0.0001"
                            type="number"
                            value={line.quantity}
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          {quantity(line.maxQuantity)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">{line.unit || "Unidad"}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">${money(line.unitPrice)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          {Number(line.taxRatePercent || 0).toFixed(0)}%
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-medium">
                          ${money(values.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <label className="grid gap-2 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
              <span className="pt-3 text-right text-sm font-medium text-ink">Motivo:</span>
              <textarea
                className="min-h-28 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                onChange={(event) => updateValidationForm("reason", event.target.value)}
                value={validationForm.reason}
              />
            </label>

            <div className="space-y-2">
              <AmountRow label="Subtotal 15%" value={totals.subtotal15} />
              <AmountRow label="Subtotal 5%" value={totals.subtotal5} />
              <AmountRow label="Subtotal 0%" value={totals.subtotal0} />
              <AmountRow label="Descuento" value={totals.discount} />
              <AmountRow label="IVA" value={totals.tax} />
              <AmountRow label="Total" value={totals.total} strong />
            </div>
          </section>

          <div className="flex justify-end">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              <Save size={16} aria-hidden="true" />
              Guardar nota de credito
            </button>
          </div>
        </form>
      ) : (
        <section className="mt-5 rounded-lg border border-dashed border-line bg-white px-4 py-8 text-center text-sm text-slate-500">
          <RotateCcw className="mx-auto mb-2 text-slate-400" size={22} aria-hidden="true" />
          Valide una factura para cargar sus productos.
        </section>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function AmountRow({ label, strong = false, value }) {
  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-2">
      <span className={`text-right text-sm ${strong ? "font-semibold text-ink" : "font-medium text-ink"}`}>
        {label}:
      </span>
      <div className="flex h-9 overflow-hidden rounded-lg border border-line bg-white">
        <span className="inline-flex w-10 items-center justify-center border-r border-line bg-slate-50 text-sm text-slate-600">
          $
        </span>
        <input
          className={`min-w-0 flex-1 bg-white px-3 text-right text-sm outline-none ${
            strong ? "font-semibold text-ink" : "text-ink"
          }`}
          readOnly
          value={money(value)}
        />
      </div>
    </div>
  );
}
