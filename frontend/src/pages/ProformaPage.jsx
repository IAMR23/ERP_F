import { AlertTriangle, Eye, FileText, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getDocument, getDocuments } from "../services/documentService";
import BillingPage from "./BillingPage";

const inputClass =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
const labelClass = "text-xs font-medium uppercase text-slate-500";
const iconButtonClass =
  "inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-3 text-sm text-ink hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50";

function money(value) {
  return Number(value || 0).toFixed(2);
}

function dateText(value) {
  return value ? new Date(value).toLocaleDateString("es-EC") : "";
}

function documentLabel(document) {
  return `PRO ${document.documentNumber || "Sin numero"}`;
}

export default function ProformaPage({ session }) {
  const [proformas, setProformas] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1
  });
  const [filters, setFilters] = useState({
    documentNumber: "",
    person: "",
    pageSize: "10"
  });
  const [selectedProforma, setSelectedProforma] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");

  const loadProformas = useCallback(
    async (page = 1, nextFilters = filters) => {
      setLoading(true);
      setError("");

      try {
        const data = await getDocuments({
          ...nextFilters,
          documentType: "PROFORMA",
          page,
          pageSize: nextFilters.pageSize
        });

        setProformas(data.documents || []);
        setPagination(data.pagination || { page, pageSize: Number(nextFilters.pageSize), total: 0, totalPages: 1 });
      } catch (apiError) {
        setError(apiError.message);
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    loadProformas(1);
  }, [loadProformas]);

  const pageNumbers = useMemo(() => {
    const current = pagination.page;
    const total = pagination.totalPages;
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [pagination.page, pagination.totalPages]);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function submitFilters(event) {
    event.preventDefault();
    loadProformas(1);
  }

  function clearFilters() {
    const nextFilters = {
      documentNumber: "",
      person: "",
      pageSize: filters.pageSize
    };

    setFilters(nextFilters);
    loadProformas(1, nextFilters);
  }

  async function openProforma(proformaId) {
    setLoadingDetail(true);
    setError("");

    try {
      const data = await getDocument(proformaId);
      setSelectedProforma(data.document);
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <div className="space-y-8">
      <BillingPage session={session} mode="proforma" onDocumentSaved={() => loadProformas(1)} />

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink">Proformas guardadas</h2>
            <p className="mt-1 text-sm text-slate-500">Cotizaciones registradas con productos y totales.</p>
          </div>
          <button className={iconButtonClass} onClick={() => loadProformas(pagination.page)} type="button" disabled={loading}>
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

        <form className="mb-5 rounded-lg border border-line bg-white" onSubmit={submitFilters}>
          <div className="grid gap-4 p-4 lg:grid-cols-3">
            <Field label="Proforma">
              <input
                className={inputClass}
                placeholder="Buscar por numero"
                value={filters.documentNumber}
                onChange={(event) => updateFilter("documentNumber", event.target.value)}
              />
            </Field>
            <Field label="Persona">
              <input
                className={inputClass}
                placeholder="Identificacion, nombre, telefono o email"
                value={filters.person}
                onChange={(event) => updateFilter("person", event.target.value)}
              />
            </Field>
            <Field label="Por pagina">
              <select
                className={inputClass}
                value={filters.pageSize}
                onChange={(event) => updateFilter("pageSize", event.target.value)}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">
            <button className={iconButtonClass} type="submit">
              <Search size={16} aria-hidden="true" />
              <span className="ml-2">Buscar</span>
            </button>
            <button className={iconButtonClass} onClick={clearFilters} type="button">
              Limpiar
            </button>
          </div>
        </form>

        <div className="overflow-hidden rounded-lg border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  {["Emision", "Cliente", "Proforma", "Bodega", "Productos", "Total", "Acciones"].map((column) => (
                    <th key={column} className="px-3 py-3 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-500" colSpan="7">
                      Cargando proformas...
                    </td>
                  </tr>
                ) : null}

                {!loading && !proformas.length ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-500" colSpan="7">
                      Sin proformas guardadas
                    </td>
                  </tr>
                ) : null}

                {!loading
                  ? proformas.map((proforma) => (
                      <tr key={proforma.id} className="align-top">
                        <td className="whitespace-nowrap px-3 py-3">{dateText(proforma.issueDate)}</td>
                        <td className="min-w-64 px-3 py-3">
                          <p className="font-medium uppercase text-ink">{proforma.customer?.nombre || "Sin cliente"}</p>
                          <p className="text-xs text-slate-500">{proforma.customer?.identificacion || "-"}</p>
                        </td>
                        <td className="min-w-44 px-3 py-3">
                          <button
                            className="font-semibold text-brand hover:underline"
                            onClick={() => openProforma(proforma.id)}
                            type="button"
                          >
                            {documentLabel(proforma)}
                          </button>
                          <p className="text-xs text-slate-500">{proforma.reference || "Sin referencia"}</p>
                        </td>
                        <td className="min-w-44 px-3 py-3">
                          <p className="font-medium text-ink">{proforma.warehouse?.name || "-"}</p>
                          <p className="text-xs text-slate-500">{proforma.branch?.name || ""}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">{proforma.lines?.length || 0}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-semibold">${money(proforma.total)}</td>
                        <td className="px-3 py-3">
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink hover:bg-mist"
                            disabled={loadingDetail}
                            onClick={() => openProforma(proforma.id)}
                            title="Ver proforma"
                            type="button"
                          >
                            <Eye size={16} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))
                  : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Pagina {pagination.page} de {pagination.totalPages} de un total: {pagination.total}
          </p>
          <div className="flex flex-wrap gap-1">
            <button
              className={iconButtonClass}
              disabled={loading || pagination.page <= 1}
              onClick={() => loadProformas(pagination.page - 1)}
              type="button"
            >
              Anterior
            </button>
            {pageNumbers.map((page) => (
              <button
                className={`inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm ${
                  page === pagination.page
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-white text-ink hover:bg-mist"
                }`}
                key={page}
                disabled={loading}
                onClick={() => loadProformas(page)}
                type="button"
              >
                {page}
              </button>
            ))}
            <button
              className={iconButtonClass}
              disabled={loading || pagination.page >= pagination.totalPages}
              onClick={() => loadProformas(pagination.page + 1)}
              type="button"
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      {selectedProforma ? (
        <ProformaPreview proforma={selectedProforma} onClose={() => setSelectedProforma(null)} />
      ) : null}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="grid gap-1">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function ProformaPreview({ proforma, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
      <section className="max-h-full w-full max-w-4xl overflow-y-auto rounded-lg border border-line bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-brand" aria-hidden="true" />
            <h3 className="font-medium text-ink">{documentLabel(proforma)}</h3>
          </div>
          <button className={iconButtonClass} onClick={onClose} type="button" title="Cerrar">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-slate-500">Empresa</p>
              <p className="font-semibold text-ink">{proforma.company?.tradeName}</p>
              <p className="text-sm text-slate-500">RUC {proforma.company?.ruc}</p>
            </div>
            <div className="md:text-right">
              <p className="text-xs uppercase text-slate-500">Emision</p>
              <p className="font-semibold text-ink">{dateText(proforma.issueDate)}</p>
              <p className="text-sm text-slate-500">{proforma.branch?.name} | {proforma.warehouse?.name}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Cliente</p>
              <p className="font-semibold text-ink">{proforma.customer?.nombre}</p>
              <p className="text-sm text-slate-500">{proforma.customer?.identificacion}</p>
            </div>
            <div className="md:text-right">
              <p className="text-xs uppercase text-slate-500">Referencia</p>
              <p className="font-semibold text-ink">{proforma.reference || "Sin referencia"}</p>
              <p className="text-sm text-slate-500">{proforma.description || "Sin descripcion"}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-line">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  {["Producto", "Cant.", "Precio", "Desc.", "IVA", "Subtotal"].map((column) => (
                    <th key={column} className="px-3 py-3 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {proforma.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-3 py-3">
                      <p className="font-medium text-ink">{line.catalogItem?.name}</p>
                      <p className="text-xs text-slate-500">{line.catalogItem?.internalCode}</p>
                    </td>
                    <td className="px-3 py-3 text-right">{money(line.quantity)}</td>
                    <td className="px-3 py-3 text-right">${money(line.unitPrice)}</td>
                    <td className="px-3 py-3 text-right">${money(line.discountAmount)}</td>
                    <td className="px-3 py-3 text-right">${money(line.taxAmount)}</td>
                    <td className="px-3 py-3 text-right font-medium">${money(line.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ml-auto max-w-sm space-y-2">
            <AmountRow label="Subtotal" value={proforma.taxableSubtotal} />
            <AmountRow label="Descuento" value={proforma.discountTotal} />
            <AmountRow label="IVA" value={proforma.taxTotal} />
            <AmountRow label="Total" value={proforma.total} strong />
          </div>
        </div>
      </section>
    </div>
  );
}

function AmountRow({ label, strong = false, value }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2">
      <span className={`text-right text-sm ${strong ? "font-semibold text-ink" : "font-medium text-ink"}`}>
        {label}:
      </span>
      <div className={`rounded-lg border border-line px-3 py-2 text-right text-sm ${strong ? "font-semibold text-ink" : "text-ink"}`}>
        ${money(value)}
      </div>
    </div>
  );
}
