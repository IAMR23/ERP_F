import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Download,
  Eye,
  FileSearch,
  FileText,
  Printer,
  RefreshCw,
  Search,
  Send,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import InvoicePrintSheet, { printInvoiceDocument } from "../components/InvoicePrintSheet";
import {
  consultSriAuthorization,
  downloadRidePdf,
  getDocument,
  getDocuments,
  sendSriDocument,
  validateSriDocument
} from "../services/documentService";

const inputClass =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
const labelClass = "text-xs font-medium uppercase text-slate-500";
const iconButtonClass =
  "inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-3 text-sm text-ink hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50";

const documentTypes = {
  INVOICE: "Factura",
  CREDIT_NOTE: "Nota de credito",
  SALES_NOTE: "Nota de venta",
  PROFORMA: "Proforma"
};

const documentPrefixes = {
  INVOICE: "FAC",
  CREDIT_NOTE: "NC",
  SALES_NOTE: "NV",
  PROFORMA: "PRO"
};

function money(value) {
  return Number(value || 0).toFixed(2);
}

function dateInputValue(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function dateText(value) {
  return value ? new Date(value).toLocaleDateString("es-EC") : "";
}

function documentLabel(document) {
  const prefix = documentPrefixes[document.documentType] || "DOC";
  return `${prefix} ${document.documentNumber || "Sin numero"}`;
}

function statusLabel(status) {
  if (status === "VOIDED") return "Anulado";
  if (status === "PENDING_DELIVERY") return "Pendiente";
  return "Confirmado";
}

function sriStatusLabel(status) {
  if (status === "PENDING_REVIEW") return "Pendiente de revision";
  if (status === "READY_TO_SEND") return "Listo para enviar";
  if (status === "SENT") return "Enviado";
  if (status === "PROCESSING") return "Procesando";
  if (status === "AUTHORIZED") return "Autorizado";
  if (status === "REJECTED") return "Rechazado";
  return "No aplica";
}

function sriStatusClass(status) {
  if (status === "AUTHORIZED") return "bg-emerald-100 text-emerald-700";
  if (status === "REJECTED") return "bg-red-100 text-red-700";
  if (status === "PENDING_REVIEW" || status === "READY_TO_SEND") return "bg-amber-100 text-amber-700";
  if (status === "SENT" || status === "PROCESSING") return "bg-sky-100 text-sky-700";
  return "bg-slate-100 text-slate-700";
}

function dateTimeText(value) {
  return value ? new Date(value).toLocaleString("es-EC") : "-";
}

function sriEnvironmentLabel(value) {
  return value === "PRODUCTION" || value === "Produccion" ? "Produccion" : "Pruebas";
}

function sriSubmissionFromDocument(document) {
  const review = document.sriReview || {};

  if (!review.sentAt && !review.error) {
    return null;
  }

  return {
    status: review.status || document.sriStatus,
    error: review.error || document.sriError || null,
    sentAt: review.sentAt || document.sriSentAt || null,
    environment: sriEnvironmentLabel(document.company?.sriEnvironment),
    documentNumber: document.documentNumber,
    accessKey: review.accessKey || document.sriAccessKey,
    company: document.company?.tradeName || document.company?.legalName,
    ruc: document.company?.ruc,
    customer: document.customer?.nombre,
    customerIdentification: document.customer?.identificacion,
    productCount: review.productCount || document.lines.length,
    total: review.total || document.total,
    signedXml: document.sriXml ? document.sriXml.includes("<Signature") || document.sriXml.includes("<ds:Signature") : false,
    xmlBytes: document.sriXml ? new Blob([document.sriXml]).size : 0,
    messages: review.messages || []
  };
}

function sriSubmissionSummary(submission) {
  if (!submission) {
    return "-";
  }

  return [
    submission.documentNumber ? `Factura ${submission.documentNumber}` : null,
    submission.accessKey ? `clave ${submission.accessKey}` : null,
    submission.environment ? `ambiente ${submission.environment}` : null,
    submission.signedXml ? "XML firmado" : "XML sin firma",
    `${submission.productCount || 0} producto(s)`,
    `$${money(submission.total)}`,
    submission.xmlBytes ? `XML ${submission.xmlBytes} bytes` : null
  ]
    .filter(Boolean)
    .join(" | ");
}

function errorDetailLines(error) {
  const details = error?.details;

  if (!details) {
    return [];
  }

  if (Array.isArray(details)) {
    return details;
  }

  if (Array.isArray(details.sriSubmission?.messages)) {
    return details.sriSubmission.messages.map((message) =>
      [message.identificador, message.mensaje, message.informacionAdicional, message.tipo]
        .filter(Boolean)
        .join(" - ")
    );
  }

  return [];
}

function safeFileName(value, fallback = "documento") {
  return String(value || fallback)
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

function downloadTextFile(content, fileName, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1
  });
  const [filters, setFilters] = useState({
    documentNumber: "",
    person: "",
    documentType: "",
    status: "",
    fromDate: dateInputValue(),
    toDate: dateInputValue(),
    pageSize: "25"
  });
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadDocuments = useCallback(
    async (page = 1, nextFilters = filters) => {
      setLoading(true);
      setError("");

      try {
        const data = await getDocuments({
          ...nextFilters,
          page,
          pageSize: nextFilters.pageSize
        });

        setDocuments(data.documents || []);
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
    loadDocuments(1);
  }, [loadDocuments]);

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
    setNotice("");
    loadDocuments(1);
  }

  function clearFilters() {
    const nextFilters = {
      documentNumber: "",
      person: "",
      documentType: "",
      status: "",
      fromDate: "",
      toDate: "",
      pageSize: filters.pageSize
    };

    setFilters(nextFilters);
    setNotice("");
    loadDocuments(1, nextFilters);
  }

  function quickFilter(documentType) {
    const nextFilters = { ...filters, documentType };

    setFilters(nextFilters);
    setNotice("");
    loadDocuments(1, nextFilters);
  }

  async function openDocument(documentId) {
    setLoadingDetail(true);
    setError("");

    try {
      const data = await getDocument(documentId);
      setSelectedDocument(data.document);
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setLoadingDetail(false);
    }
  }

  function handleSriValidated(document, message = `Factura ${document.documentNumber || ""} validada para SRI`) {
    setSelectedDocument(document);
    setDocuments((current) =>
      current.map((item) => (item.id === document.id ? { ...item, sriStatus: document.sriStatus } : item))
    );
    setNotice(message);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Documentos</h2>
          <p className="mt-1 text-sm text-slate-500">Consulta facturas, notas de credito, notas de venta y proformas.</p>
        </div>
        <button className={iconButtonClass} onClick={() => loadDocuments(pagination.page)} type="button" disabled={loading}>
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

      <form className="mb-5 rounded-lg border border-line bg-white" onSubmit={submitFilters}>
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <FileSearch size={18} className="text-brand" aria-hidden="true" />
          <h3 className="font-medium text-ink">Busqueda</h3>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <Field label="Documento">
            <input
              className={inputClass}
              placeholder="Buscar por numero de documento"
              value={filters.documentNumber}
              onChange={(event) => updateFilter("documentNumber", event.target.value)}
            />
          </Field>

          <Field label="Desde">
            <input
              className={inputClass}
              type="date"
              value={filters.fromDate}
              onChange={(event) => updateFilter("fromDate", event.target.value)}
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

          <Field label="Hasta">
            <input
              className={inputClass}
              type="date"
              value={filters.toDate}
              onChange={(event) => updateFilter("toDate", event.target.value)}
            />
          </Field>

          <Field label="Tipo documento">
            <select
              className={inputClass}
              value={filters.documentType}
              onChange={(event) => updateFilter("documentType", event.target.value)}
            >
              <option value="">Todos</option>
              <option value="INVOICE">Facturas</option>
              <option value="CREDIT_NOTE">Notas de credito</option>
              <option value="SALES_NOTE">Notas de venta</option>
              <option value="PROFORMA">Proformas</option>
            </select>
          </Field>

          <Field label="Estado">
            <select
              className={inputClass}
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              <option value="">Todos</option>
              <option value="CONFIRMED">Confirmado</option>
              <option value="PENDING_DELIVERY">Pendiente</option>
              <option value="VOIDED">Anulado</option>
            </select>
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

        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          <span className="mr-2 text-sm font-medium text-slate-500">Filtros rapidos:</span>
          <button className={iconButtonClass} onClick={() => quickFilter("INVOICE")} type="button">
            Facturas
          </button>
          <button className={iconButtonClass} onClick={() => quickFilter("CREDIT_NOTE")} type="button">
            Notas de credito
          </button>
          <button className={iconButtonClass} onClick={() => quickFilter("SALES_NOTE")} type="button">
            Notas de venta
          </button>
          <button className={iconButtonClass} onClick={() => quickFilter("PROFORMA")} type="button">
            Proformas
          </button>
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
                {[
                  "Emision",
                  "Persona",
                  "Documento",
                  "Estado",
                  "SRI",
                  "Neto",
                  "Imp.",
                  "Total",
                  "Ret.",
                  "Saldo",
                  "Acciones"
                ].map((column) => (
                  <th key={column} className="px-3 py-3 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan="11">
                    Cargando documentos...
                  </td>
                </tr>
              ) : null}

              {!loading && !documents.length ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan="11">
                    Sin documentos encontrados
                  </td>
                </tr>
              ) : null}

              {!loading
                ? documents.map((document) => (
                    <tr key={document.id} className="align-top">
                      <td className="whitespace-nowrap px-3 py-3">{dateText(document.issueDate)}</td>
                      <td className="min-w-64 px-3 py-3">
                        <p className="font-medium uppercase text-ink">{document.customer?.nombre || "Sin persona"}</p>
                        <p className="text-xs text-slate-500">
                          {document.customer?.identificacion || "-"} | Cliente
                        </p>
                      </td>
                      <td className="min-w-48 px-3 py-3">
                        <button
                          className="font-semibold text-brand hover:underline"
                          onClick={() => openDocument(document.id)}
                          type="button"
                        >
                          {documentLabel(document)}
                        </button>
                        <p className="text-xs text-slate-500">{documentTypes[document.documentType]}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                          {statusLabel(document.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-md px-2 py-1 text-xs font-medium ${sriStatusClass(document.sriStatus)}`}>
                          {sriStatusLabel(document.sriStatus)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">${money(document.taxableSubtotal)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">${money(document.taxTotal)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-medium">${money(document.total)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">${money(document.retentionTotal)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">${money(document.balance)}</td>
                      <td className="px-3 py-3">
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink hover:bg-mist"
                          disabled={loadingDetail}
                          onClick={() => openDocument(document.id)}
                          title="Ver documento"
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
            onClick={() => loadDocuments(pagination.page - 1)}
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
              onClick={() => loadDocuments(page)}
              type="button"
            >
              {page}
            </button>
          ))}
          <button
            className={iconButtonClass}
            disabled={loading || pagination.page >= pagination.totalPages}
            onClick={() => loadDocuments(pagination.page + 1)}
            type="button"
          >
            Siguiente
          </button>
        </div>
      </div>

      {selectedDocument ? (
        <DocumentPreview
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onValidated={handleSriValidated}
        />
      ) : null}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="grid gap-1 md:grid-cols-[150px_minmax(0,1fr)] md:items-center">
      <span className={`${labelClass} md:text-right`}>{label}</span>
      {children}
    </label>
  );
}

function DocumentPreview({ document, onClose, onValidated }) {
  const [copyState, setCopyState] = useState("");
  const [sriActionError, setSriActionError] = useState("");
  const [sriActionErrorDetails, setSriActionErrorDetails] = useState([]);
  const [sriActionNotice, setSriActionNotice] = useState("");
  const [lastSriSubmission, setLastSriSubmission] = useState(null);
  const [validatingSri, setValidatingSri] = useState(false);
  const [sendingSri, setSendingSri] = useState(false);
  const [consultingSri, setConsultingSri] = useState(false);
  const [downloadingRide, setDownloadingRide] = useState(false);
  const isInvoice = document.documentType === "INVOICE";
  const activeSriSubmission = lastSriSubmission || sriSubmissionFromDocument(document);
  const hasSignedXml = Boolean(document.sriXml?.includes("<ds:Signature") || document.sriXml?.includes("<Signature"));

  async function copyXml() {
    if (!document.sriXml) {
      return;
    }

    try {
      await navigator.clipboard.writeText(document.sriXml);
      setCopyState("XML copiado");
    } catch {
      setCopyState("No se pudo copiar el XML");
    }
  }

  async function validateSri() {
    setValidatingSri(true);
    setSriActionError("");
    setSriActionErrorDetails([]);
    setSriActionNotice("");
    setLastSriSubmission(null);

    try {
      const response = await validateSriDocument(document.id);
      onValidated(response.document, `Factura ${response.document.documentNumber || ""} validada para SRI`);
      setSriActionNotice("Certificado y XML validados");
    } catch (apiError) {
      setSriActionError(apiError.message);
      setSriActionErrorDetails(errorDetailLines(apiError));
    } finally {
      setValidatingSri(false);
    }
  }

  async function sendSri() {
    setSendingSri(true);
    setSriActionError("");
    setSriActionErrorDetails([]);
    setSriActionNotice("");
    setLastSriSubmission(null);

    try {
      const response = await sendSriDocument(document.id);
      const sriSubmission = response.sriSubmission || sriSubmissionFromDocument(response.document);

      setLastSriSubmission(sriSubmission);
      onValidated(response.document, `Factura ${response.document.documentNumber || ""} actualizada con respuesta SRI`);
      setSriActionNotice("Respuesta SRI registrada. Revisa el detalle abajo.");
    } catch (apiError) {
      const sriSubmission = apiError.details?.sriSubmission || null;

      setLastSriSubmission(sriSubmission);
      setSriActionError(sriSubmission?.error || apiError.message);
      setSriActionErrorDetails(errorDetailLines(apiError));
    } finally {
      setSendingSri(false);
    }
  }

  async function consultAuthorization() {
    setConsultingSri(true);
    setSriActionError("");
    setSriActionErrorDetails([]);
    setSriActionNotice("");
    setLastSriSubmission(null);

    try {
      const response = await consultSriAuthorization(document.id);
      const sriSubmission = response.sriSubmission || sriSubmissionFromDocument(response.document);

      setLastSriSubmission(sriSubmission);
      onValidated(response.document, `Factura ${response.document.documentNumber || ""} consultada en SRI`);
      setSriActionNotice("Consulta de autorizacion registrada.");
    } catch (apiError) {
      const sriSubmission = apiError.details?.sriSubmission || null;

      setLastSriSubmission(sriSubmission);
      setSriActionError(sriSubmission?.error || apiError.message);
      setSriActionErrorDetails(errorDetailLines(apiError));
    } finally {
      setConsultingSri(false);
    }
  }

  function downloadXml() {
    if (!document.sriXml || !hasSignedXml) {
      return;
    }

    downloadTextFile(
      document.sriXml,
      `${safeFileName(document.documentNumber, "factura")}.xml`,
      "application/xml;charset=utf-8"
    );
  }

  async function downloadRide() {
    setDownloadingRide(true);
    setSriActionError("");
    setSriActionErrorDetails([]);

    try {
      const { blob, fileName } = await downloadRidePdf(document.id);
      downloadBlob(blob, fileName);
    } catch (apiError) {
      setSriActionError(apiError.message);
      setSriActionErrorDetails(errorDetailLines(apiError));
    } finally {
      setDownloadingRide(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
      <section className="max-h-full w-full max-w-5xl overflow-y-auto rounded-lg border border-line bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-brand" aria-hidden="true" />
            <h3 className="font-medium text-ink">{documentLabel(document)}</h3>
          </div>
          <div className="flex items-center gap-2">
            {isInvoice ? (
              <button className={iconButtonClass} onClick={printInvoiceDocument} type="button">
                <Printer size={16} aria-hidden="true" />
                <span className="ml-2">Imprimir factura</span>
              </button>
            ) : null}
            <button className={iconButtonClass} onClick={onClose} type="button" title="Cerrar">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          {isInvoice ? (
            <div className="overflow-x-auto rounded-lg bg-slate-100 p-3">
              <InvoicePrintSheet document={document} />
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-slate-500">Empresa</p>
              <p className="font-semibold text-ink">{document.company?.tradeName}</p>
              <p className="text-sm text-slate-500">RUC {document.company?.ruc}</p>
            </div>
            <div className="md:text-right">
              <p className="text-xs uppercase text-slate-500">Emision</p>
              <p className="font-semibold text-ink">{dateText(document.issueDate)}</p>
              <p className="text-sm text-slate-500">{statusLabel(document.status)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Cliente</p>
              <p className="font-semibold text-ink">{document.customer?.nombre}</p>
              <p className="text-sm text-slate-500">{document.customer?.identificacion}</p>
            </div>
            <div className="md:text-right">
              <p className="text-xs uppercase text-slate-500">Forma de pago</p>
              <p className="font-semibold text-ink">
                {document.payments[0]?.paymentMethod?.name || "Sin forma de pago"}
              </p>
              <p className="text-sm text-slate-500">{document.branch?.name} | {document.warehouse?.name}</p>
            </div>
          </div>

          {isInvoice ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50">
              <div className="flex flex-col gap-3 border-b border-amber-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase text-amber-700">Revision SRI</p>
                  <p className="mt-1 text-sm text-amber-800">
                    XML generado con {document.sriReview?.productCount || document.lines.length} producto(s)
                  </p>
                </div>
                <span className={`w-fit rounded-md px-2 py-1 text-xs font-medium ${sriStatusClass(document.sriStatus)}`}>
                  {sriStatusLabel(document.sriStatus)}
                </span>
              </div>

              <div className="grid gap-4 p-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-amber-700">Clave de acceso</p>
                  <p className="break-all font-mono text-sm text-ink">{document.sriAccessKey || "-"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-amber-700">XML generado</p>
                  <p className="text-sm font-semibold text-ink">{dateTimeText(document.sriGeneratedAt)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-amber-700">Total factura</p>
                  <p className="text-sm font-semibold text-ink">${money(document.total)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-amber-700">Retenciones registradas</p>
                  <p className="text-sm font-semibold text-ink">${money(document.retentionTotal)}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-amber-200 px-4 py-3">
                <button
                  className={iconButtonClass}
                  disabled={!document.sriXml}
                  onClick={copyXml}
                  type="button"
                >
                  <Clipboard size={16} aria-hidden="true" />
                  <span className="ml-2">Copiar XML</span>
                </button>
                <button
                  className={iconButtonClass}
                  disabled={!document.sriXml || !hasSignedXml}
                  onClick={downloadXml}
                  type="button"
                >
                  <Download size={16} aria-hidden="true" />
                  <span className="ml-2">Descargar XML</span>
                </button>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={validatingSri || !document.sriXml}
                  onClick={validateSri}
                  type="button"
                >
                  <Send size={16} aria-hidden="true" />
                  {validatingSri ? "Validando..." : "Validar para SRI"}
                </button>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={sendingSri || document.sriStatus !== "READY_TO_SEND"}
                  onClick={sendSri}
                  type="button"
                >
                  <Send size={16} aria-hidden="true" />
                  {sendingSri ? "Enviando..." : "Enviar al SRI"}
                </button>
                <button
                  className={iconButtonClass}
                  disabled={consultingSri || !["SENT", "PROCESSING"].includes(document.sriStatus)}
                  onClick={consultAuthorization}
                  type="button"
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  <span className="ml-2">{consultingSri ? "Consultando..." : "Consultar autorizacion"}</span>
                </button>
                <button
                  className={iconButtonClass}
                  disabled={downloadingRide || document.sriStatus !== "AUTHORIZED"}
                  onClick={downloadRide}
                  type="button"
                >
                  <Download size={16} aria-hidden="true" />
                  <span className="ml-2">{downloadingRide ? "Descargando..." : "Descargar RIDE PDF"}</span>
                </button>
                {copyState ? <span className="self-center text-sm text-amber-800">{copyState}</span> : null}
                {sriActionNotice ? <span className="self-center text-sm text-emerald-700">{sriActionNotice}</span> : null}
                {sriActionError ? <span className="self-center text-sm text-red-700">{sriActionError}</span> : null}
              </div>
              {sriActionErrorDetails.length ? (
                <div className="border-t border-amber-200 px-4 py-3">
                  <p className="text-xs uppercase text-red-700">Detalle tecnico</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
                    {sriActionErrorDetails.map((detail, index) => (
                      <li key={`${detail}-${index}`}>{detail}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {activeSriSubmission ? (
                <div className="grid gap-3 border-t border-amber-200 px-4 py-3 text-sm md:grid-cols-2">
                  <div className="md:col-span-2">
                    <p className="text-xs uppercase text-amber-700">Que se envio</p>
                    <p className="break-words font-medium text-ink">
                      {sriSubmissionSummary(activeSriSubmission)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-amber-700">Fecha de envio</p>
                    <p className="font-semibold text-ink">{dateTimeText(activeSriSubmission.sentAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-amber-700">Error SRI</p>
                    <p className={`font-semibold ${activeSriSubmission.error ? "text-red-700" : "text-emerald-700"}`}>
                      {activeSriSubmission.error || "Sin error registrado"}
                    </p>
                  </div>
                  {activeSriSubmission.messages?.length ? (
                    <div className="md:col-span-2">
                      <p className="text-xs uppercase text-amber-700">Mensajes SRI</p>
                      <div className="mt-1 space-y-2 rounded-lg border border-amber-200 bg-white p-3">
                        {activeSriSubmission.messages.map((message, index) => (
                          <p className="text-sm text-ink" key={`${message.identificador || "msg"}-${index}`}>
                            <span className="font-semibold">{message.identificador || message.tipo || "SRI"}:</span>{" "}
                            {[message.mensaje, message.informacionAdicional].filter(Boolean).join(" - ")}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="overflow-hidden rounded-lg border border-line">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  {["Producto", "Cant.", "Unidad", "Precio", "Desc.", "IVA", "Ret.", "Subtotal"].map((column) => (
                    <th key={column} className="px-3 py-3 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {document.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-3 py-3">
                      <p className="font-medium text-ink">{line.catalogItem?.name}</p>
                      <p className="text-xs text-slate-500">{line.catalogItem?.internalCode}</p>
                    </td>
                    <td className="px-3 py-3 text-right">{money(line.quantity)}</td>
                    <td className="px-3 py-3">{line.unit || "Unidad"}</td>
                    <td className="px-3 py-3 text-right">${money(line.unitPrice)}</td>
                    <td className="px-3 py-3 text-right">${money(line.discountAmount)}</td>
                    <td className="px-3 py-3 text-right">${money(line.taxAmount)}</td>
                    <td className="px-3 py-3 text-right">
                      ${money(Number(line.incomeTaxRetention || 0) + Number(line.ivaRetention || 0))}
                    </td>
                    <td className="px-3 py-3 text-right font-medium">${money(line.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ml-auto max-w-sm space-y-2">
            <AmountRow label="Subtotal" value={document.taxableSubtotal} />
            <AmountRow label="Descuento" value={document.discountTotal} />
            <AmountRow label="IVA" value={document.taxTotal} />
            <AmountRow label="Retenciones" value={document.retentionTotal} />
            <AmountRow label="Total" value={document.total} strong />
          </div>

          {document.sriXml ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase text-slate-500">XML para revision</p>
              <textarea
                className="h-72 w-full rounded-lg border border-line bg-slate-950 px-3 py-2 font-mono text-xs text-slate-50 outline-none"
                readOnly
                value={document.sriXml}
              />
            </div>
          ) : null}
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
