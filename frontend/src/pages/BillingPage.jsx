import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Trash2,
  UserRound,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InvoicePrintSheet, { printInvoiceDocument } from "../components/InvoicePrintSheet";
import {
  createDocument,
  sendSriDocument,
  validateSriDocument
} from "../services/documentService";
import { getBranches } from "../services/organizationService";
import { createPerson, getPeople } from "../services/personService";
import { getPaymentMethods } from "../services/paymentMethodService";
import { getWarehouseOptions, getWarehouses } from "../services/warehouseService";

const roleOptions = [
  ["CLIENTE", "Cliente"],
  ["PROVEEDOR", "Proveedor"],
  ["EMPLEADO", "Empleado"],
  ["VENDEDOR", "Vendedor"]
];

const emptyPersonForm = {
  tipoPersona: "NATURAL",
  tipoIdentificacion: "CEDULA",
  identificacion: "",
  nombre: "",
  telefono: "",
  email: "",
  direccion: "",
  roles: ["CLIENTE"],
  activo: "true"
};

const emptyProductLine = {
  catalogItemId: "",
  quantity: "1",
  unit: "Unidad",
  unitPrice: "0",
  ivaRate: "15",
  incomeTaxRetention: "0",
  ivaRetention: "0",
  discountMode: "$",
  discount: "0"
};

const inputClass =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
const labelClass = "text-xs font-medium uppercase text-slate-500";
const iconButtonClass =
  "inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-3 text-sm text-ink hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function sriCode(value, fallback = "001") {
  return String(value || fallback).trim().padStart(3, "0");
}

function branchEmissionPoint(branch, fallback = "001") {
  return sriCode(branch?.sriEstablishmentCode, fallback);
}

function nextDocumentNumber(establishmentCode = "001", emissionPoint = "001") {
  return `${sriCode(establishmentCode)}-${sriCode(emissionPoint)}-000000001`;
}

function isClient(person) {
  return Boolean(person.activo) && person.roles?.includes("CLIENTE");
}

function clientLabel(client) {
  return client ? `${client.identificacion} - ${client.nombre}` : "";
}

function findDefaultClient(people) {
  return people.find((person) => isClient(person) && person.identificacion === "999999999");
}

function findDefaultWarehouse(warehouses, branchId) {
  const branchWarehouses = warehouses.filter((warehouse) => warehouse.branch?.id === branchId);
  return (
    branchWarehouses.find(
      (warehouse) => warehouse.isDefault && warehouse.status === "ACTIVE"
    ) ||
    branchWarehouses.find((warehouse) => warehouse.status === "ACTIVE") ||
    branchWarehouses[0] ||
    null
  );
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function decimalText(value, decimals = 3) {
  const normalized = String(value || "").replaceAll(",", ".").replace(/[^\d.]/g, "");
  const [integerPart, ...decimalParts] = normalized.split(".");
  const decimalPart = decimalParts.join("").slice(0, decimals);

  if (normalized.startsWith(".")) {
    return decimalPart ? `0.${decimalPart}` : "0.";
  }

  return decimalParts.length ? `${integerPart}.${decimalPart}` : integerPart;
}

export default function BillingPage({ session, mode = "billing", onDocumentSaved }) {
  const isProformaMode = mode === "proforma";
  const [people, setPeople] = useState([]);
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [personForm, setPersonForm] = useState(emptyPersonForm);
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [personSearchOpen, setPersonSearchOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingDocument, setSavingDocument] = useState(false);
  const [submittedDocumentId, setSubmittedDocumentId] = useState("");
  const [savingPerson, setSavingPerson] = useState(false);
  const [printableDocument, setPrintableDocument] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [documentForm, setDocumentForm] = useState({
    issueDate: todayInputValue(),
    personType: "CLIENTE",
    documentType: isProformaMode ? "PROFORMA" : "INVOICE",
    branchId: "",
    establishmentCode: "001",
    emissionPoint: "001",
    documentNumber: nextDocumentNumber(),
    personId: "",
    paymentMethodId: "",
    reference: "",
    seller: session?.user?.name || ""
  });
  const [productForm, setProductForm] = useState({
    warehouseId: "",
    description: "",
    lines: []
  });
  const submissionLockRef = useRef(false);

  const clients = useMemo(() => people.filter(isClient), [people]);
  const selectedClient = useMemo(
    () => clients.find((person) => person.id === documentForm.personId),
    [clients, documentForm.personId]
  );
  const filteredClients = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();

    if (!term) {
      return clients;
    }

    return clients.filter((client) =>
      [client.identificacion, client.nombre, client.telefono, client.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [clientSearch, clients]);

  const availableWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.branch?.id === documentForm.branchId),
    [documentForm.branchId, warehouses]
  );

  const selectedWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === productForm.warehouseId),
    [productForm.warehouseId, warehouses]
  );

  const productsForWarehouse = useMemo(() => {
    if (!selectedWarehouse) {
      return products;
    }

    return products.filter((product) => product.companyId === selectedWarehouse.company?.id);
  }, [products, selectedWarehouse]);

  const totals = useMemo(
    () =>
      productForm.lines.reduce(
        (acc, line) => {
          const quantity = Number(line.quantity || 0);
          const unitPrice = Number(line.unitPrice || 0);
          const gross = quantity * unitPrice;
          const rawDiscount = Number(line.discount || 0);
          const discount =
            line.discountMode === "%"
              ? Math.min(gross, gross * (rawDiscount / 100))
              : Math.min(gross, rawDiscount);
          const subtotal = Math.max(0, gross - discount);
          const ivaRate = Number(line.ivaRate || 0);

          if (ivaRate === 15) acc.subtotal15 += subtotal;
          if (ivaRate === 5) acc.subtotal5 += subtotal;
          if (ivaRate === 0) acc.subtotal0 += subtotal;

          acc.discount += discount;
          acc.iva15 += ivaRate === 15 ? subtotal * 0.15 : 0;
          acc.iva5 += ivaRate === 5 ? subtotal * 0.05 : 0;
          acc.total += subtotal + (ivaRate === 15 ? subtotal * 0.15 : 0) + (ivaRate === 5 ? subtotal * 0.05 : 0);
          return acc;
        },
        {
          subtotal15: 0,
          subtotal5: 0,
          subtotal0: 0,
          discount: 0,
          iva15: 0,
          iva5: 0,
          ice: 0,
          total: 0
        }
      ),
    [productForm.lines]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [peopleData, branchData, warehouseOptionData, warehouseData, paymentMethodData] =
        await Promise.all([
          getPeople(),
          getBranches(),
          getWarehouseOptions(),
          getWarehouses(),
          getPaymentMethods()
        ]);
      const nextPeople = peopleData.people || [];
      const nextBranches = branchData.branches || [];
      const nextWarehouses = warehouseData.warehouses || [];
      const nextPaymentMethods = paymentMethodData.paymentMethods || [];
      const firstBranch = nextBranches[0];

      setPeople(nextPeople);
      setBranches(nextBranches);
      setWarehouses(nextWarehouses);
      setProducts(warehouseOptionData.products || []);
      setPaymentMethods(nextPaymentMethods);
      setDocumentForm((current) => {
        const branch = nextBranches.find((item) => item.id === current.branchId) || firstBranch;
        const currentAutoNumber = nextDocumentNumber(current.establishmentCode, current.emissionPoint);
        const establishmentCode = sriCode(current.establishmentCode);
        const emissionPoint = branchEmissionPoint(branch, current.emissionPoint);
        const shouldRefreshNumber = !current.documentNumber || current.documentNumber === currentAutoNumber;
        const defaultWarehouse = findDefaultWarehouse(nextWarehouses, branch?.id);
        const currentPaymentMethod = nextPaymentMethods.find(
          (paymentMethod) => paymentMethod.id === current.paymentMethodId
        );

        setProductForm((currentProductForm) => ({
          ...currentProductForm,
          warehouseId: currentProductForm.warehouseId || defaultWarehouse?.id || ""
        }));
        return {
          ...current,
          branchId: current.branchId || branch?.id || "",
          establishmentCode,
          emissionPoint,
          documentNumber: shouldRefreshNumber
            ? nextDocumentNumber(establishmentCode, emissionPoint)
            : current.documentNumber,
          personId: current.personId || findDefaultClient(nextPeople)?.id || nextPeople.find(isClient)?.id || "",
          paymentMethodId: isProformaMode ? "" : currentPaymentMethod?.id || ""
        };
      });
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  }, [isProformaMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!personSearchOpen) {
      setClientSearch(clientLabel(selectedClient));
    }
  }, [personSearchOpen, selectedClient]);

  function updateDocumentForm(field, value) {
    setDocumentForm((current) => {
      const next = { ...current, [field]: value };

      if (field === "branchId") {
        const branch = branches.find((item) => item.id === value);
        const defaultWarehouse = findDefaultWarehouse(warehouses, value);
        next.establishmentCode = "001";
        next.emissionPoint = branchEmissionPoint(branch, next.emissionPoint);
        next.documentNumber = nextDocumentNumber(next.establishmentCode, next.emissionPoint);
        setProductForm((currentProductForm) => ({
          ...currentProductForm,
          warehouseId: defaultWarehouse?.id || "",
          lines: []
        }));
      }

      if (field === "emissionPoint") {
        next.documentNumber = nextDocumentNumber(next.establishmentCode, value);
      }

      return next;
    });
  }

  function updatePersonForm(field, value) {
    setPersonForm((current) => ({ ...current, [field]: value }));
  }

  function togglePersonRole(role) {
    setPersonForm((current) => {
      const roles = current.roles.includes(role)
        ? current.roles.filter((currentRole) => currentRole !== role)
        : [...current.roles, role];

      return {
        ...current,
        roles: roles.includes("CLIENTE") ? roles : ["CLIENTE", ...roles]
      };
    });
  }

  function openPersonModal(searchValue = "") {
    const term = typeof searchValue === "string" ? searchValue.trim() : "";
    const looksLikeIdentification = /^\d{5,}$/.test(term);

    setPersonForm({
      ...emptyPersonForm,
      identificacion: looksLikeIdentification ? term : "",
      nombre: looksLikeIdentification ? "" : term
    });
    setPersonModalOpen(true);
    setPersonSearchOpen(false);
    setError("");
    setNotice("");
    setPrintableDocument(null);
  }

  function selectClient(personId) {
    const client = clients.find((person) => person.id === personId);

    updateDocumentForm("personId", personId);
    setPersonSearchOpen(false);
    setClientSearch(clientLabel(client));
  }

  function searchClient(value) {
    setClientSearch(value);
    setPersonSearchOpen(true);
    updateDocumentForm("personId", "");
  }

  function addProductLine() {
    setProductForm((current) => ({
      ...current,
      lines: [...current.lines, { ...emptyProductLine }]
    }));
  }

  function removeProductLine(index) {
    setProductForm((current) => ({
      ...current,
      lines: current.lines.filter((_, lineIndex) => lineIndex !== index)
    }));
  }

  function updateProductLine(index, field, value) {
    setProductForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => {
        if (lineIndex !== index) {
          return line;
        }

        if (field === "catalogItemId") {
          const product = products.find((item) => item.id === value);

          return {
            ...line,
            catalogItemId: value,
            unitPrice: product ? decimalText(product.salePrice || 0) : line.unitPrice
          };
        }

        if (field === "unitPrice") {
          return { ...line, unitPrice: decimalText(value) };
        }

        return { ...line, [field]: value };
      })
    }));
  }

  function lineSubtotal(line) {
    const gross = Number(line.quantity || 0) * Number(line.unitPrice || 0);
    const discountValue = Number(line.discount || 0);
    const discount =
      line.discountMode === "%"
        ? Math.min(gross, gross * (discountValue / 100))
        : Math.min(gross, discountValue);

    return Math.max(0, gross - discount);
  }

  async function handlePersonSubmit(event) {
    event.preventDefault();
    setSavingPerson(true);
    setError("");
    setNotice("");

    try {
      const response = await createPerson({
        ...personForm,
        activo: personForm.activo === "true",
        roles: personForm.roles.includes("CLIENTE")
          ? personForm.roles
          : ["CLIENTE", ...personForm.roles]
      });
      const createdPerson = response.person;

      await loadData();
      setDocumentForm((current) => ({
        ...current,
        personId: createdPerson?.id || current.personId
      }));
      setPersonModalOpen(false);
      setPersonForm(emptyPersonForm);
      setNotice("Cliente agregado");
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setSavingPerson(false);
    }
  }

  async function handleDocumentSubmit(options = {}) {
    const savingAsProforma = isProformaMode || options.asProforma;
    const actionText = savingAsProforma ? "guardar la proforma" : "facturar";

    if (!savingAsProforma && submittedDocumentId) {
      setError("Esta factura ya fue registrada y no puede volver a enviarse.");
      return;
    }

    if (submissionLockRef.current) {
      return;
    }

    setError("");
    setNotice("");
    setPrintableDocument(null);

    if (!documentForm.personId) {
      setError(`Seleccione una persona para poder ${actionText}`);
      return;
    }

    if (!productForm.warehouseId) {
      setError(`Seleccione una bodega para poder ${actionText}`);
      return;
    }

    if (!savingAsProforma && !documentForm.paymentMethodId) {
      setError("Seleccione una forma de pago para poder facturar");
      return;
    }

    if (!productForm.lines.length) {
      setError(`Agregue al menos un producto para poder ${actionText}`);
      return;
    }

    const missingProductIndex = productForm.lines.findIndex((line) => !line.catalogItemId);

    if (missingProductIndex >= 0) {
      setError(`Seleccione un producto en la linea ${missingProductIndex + 1}`);
      return;
    }

    const lines = productForm.lines.map((line) => {
      const gross = Number(line.quantity || 0) * Number(line.unitPrice || 0);
      const discountValue = Number(line.discount || 0);
      const discountAmount =
        line.discountMode === "%"
          ? Math.min(gross, gross * (discountValue / 100))
          : Math.min(gross, discountValue);

      return {
        catalogItemId: line.catalogItemId,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
        discountAmount,
        taxRatePercent: line.ivaRate,
        incomeTaxRetention: line.incomeTaxRetention,
        ivaRetention: line.ivaRetention
      };
    });

    submissionLockRef.current = true;
    setSavingDocument(true);

    try {
      const response = await createDocument({
        ...documentForm,
        documentType: savingAsProforma ? "PROFORMA" : documentForm.documentType,
        paymentMethodId: savingAsProforma ? undefined : documentForm.paymentMethodId,
        warehouseId: productForm.warehouseId,
        description: productForm.description,
        lines
      });

      let completedDocument = response.document;

      if (!savingAsProforma && response.document?.id) {
        setSubmittedDocumentId(response.document.id);
      }

      setDocumentForm((current) => ({
        ...current,
        documentNumber:
          savingAsProforma && !isProformaMode
            ? current.documentNumber
            : response.document?.documentNumber || current.documentNumber
      }));

      if (!savingAsProforma && response.document?.id) {
        try {
          const validationResponse = await validateSriDocument(response.document.id);
          const sriResponse = await sendSriDocument(response.document.id);
          completedDocument =
            sriResponse.document || validationResponse.document || response.document;

          if (completedDocument.sriReview?.status === "REJECTED") {
            const sriError =
              completedDocument.sriReview.error || sriResponse.sriSubmission?.error;
            setError(
              `Factura ${completedDocument.documentNumber || ""} guardada, pero no fue autorizada por el SRI${
                sriError ? `: ${sriError}` : "."
              }`
            );
          } else if (completedDocument.sriReview?.status === "AUTHORIZED") {
            setNotice(
              `Factura ${completedDocument.documentNumber || ""} guardada y autorizada por el SRI`
            );
          } else {
            setNotice(
              `Factura ${completedDocument.documentNumber || ""} guardada y enviada al SRI para su autorización`
            );
          }
        } catch (sriError) {
          setError(
            `Factura ${response.document.documentNumber || ""} guardada, pero no se pudo completar el envío al SRI: ${sriError.message}`
          );
        }
      } else {
        setNotice(`Proforma ${response.document?.documentNumber || ""} guardada`);
      }

      setPrintableDocument(
        !savingAsProforma && completedDocument?.documentType === "INVOICE"
          ? completedDocument
          : null
      );
      onDocumentSaved?.(completedDocument);
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      submissionLockRef.current = false;
      setSavingDocument(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-ink">
            {isProformaMode ? "Proforma" : "Facturacion"}
          </h2>
        </div>
        <button className={iconButtonClass} onClick={loadData} type="button" disabled={loading}>
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

      {!isProformaMode ? (
        <div className="mb-5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <span className="font-semibold">Importante:</span> De acuerdo con la normativa del SRI, los documentos electrónicos deben ser autorizados en el momento de su emisión.
        </div>
      ) : null}

      <section className="rounded-lg border border-line bg-white">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <FileText size={18} className="text-brand" aria-hidden="true" />
          <h3 className="font-medium text-ink">
            {isProformaMode ? "Registrar Proforma" : "Registrar Documento Electronico"}
          </h3>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <Field label="Fecha de Emision">
              <input
                className={inputClass}
                type="date"
                value={documentForm.issueDate}
                onChange={(event) => updateDocumentForm("issueDate", event.target.value)}
              />
            </Field>
          </div>

          <div>
            <Field label="Tipo de Documento">
              <select
                className={inputClass}
                value={documentForm.personType}
                onChange={(event) => updateDocumentForm("personType", event.target.value)}
              >
                <option value="CLIENTE">Cliente</option>
              </select>
            </Field>
          </div>

          <div>
            <Field label="Comprobante">
              <select
                className={inputClass}
                value={documentForm.documentType}
                onChange={(event) => updateDocumentForm("documentType", event.target.value)}
                disabled={isProformaMode}
              >
                {isProformaMode ? (
                  <option value="PROFORMA">Proforma</option>
                ) : (
                  <>
                    <option value="INVOICE">Factura</option>
                    <option value="SALES_NOTE">Nota de venta</option>
                  </>
                )}
              </select>
            </Field>
          </div>

          <div>
            <Field label="Sucursal">
              <select
                className={inputClass}
                value={documentForm.branchId}
                onChange={(event) => updateDocumentForm("branchId", event.target.value)}
              >
                <option value="">Seleccione</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.sriEstablishmentCode || "001"} - {branch.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div>
            <Field label="Punto Emision">
              <input
                className={inputClass}
                maxLength={3}
                value={documentForm.emissionPoint}
                onChange={(event) => updateDocumentForm("emissionPoint", event.target.value)}
              />
            </Field>
          </div>

          <div>
            <Field label={isProformaMode ? "# de Proforma" : "# de Documento"}>
              <input
                className={inputClass}
                value={documentForm.documentNumber}
                onChange={(event) => updateDocumentForm("documentNumber", event.target.value)}
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field label="Persona">
              <PersonCombobox
                clients={filteredClients}
                open={personSearchOpen}
                search={clientSearch}
                selectedClientId={documentForm.personId}
                onAdd={() => openPersonModal(clientSearch)}
                onBlur={() => setTimeout(() => setPersonSearchOpen(false), 120)}
                onChange={searchClient}
                onFocus={() => setPersonSearchOpen(true)}
                onSelect={selectClient}
              />
            </Field>
          </div>

          {selectedClient ? (
            <div className="rounded-lg border border-line bg-mist px-3 py-2 text-sm md:col-span-2">
              <p className="font-medium text-ink">{selectedClient.nombre}</p>
              <p className="text-slate-500">
                {selectedClient.tipoIdentificacion} {selectedClient.identificacion}
                {selectedClient.email ? ` | ${selectedClient.email}` : ""}
                {selectedClient.telefono ? ` | ${selectedClient.telefono}` : ""}
              </p>
            </div>
          ) : null}

          <div className="md:col-span-2">
            <Field label="Referencia">
              <input
                className={inputClass}
                value={documentForm.reference}
                onChange={(event) => updateDocumentForm("reference", event.target.value)}
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field label="Vendedor">
              <input
                className={inputClass}
                value={documentForm.seller}
                onChange={(event) => updateDocumentForm("seller", event.target.value)}
              />
            </Field>
          </div>

          {!isProformaMode ? (
            <div className="md:col-span-2">
              <Field label="Forma de pago">
                <select
                  className={inputClass}
                  value={documentForm.paymentMethodId}
                  onChange={(event) => updateDocumentForm("paymentMethodId", event.target.value)}
                  required
                >
                  <option value="">Seleccione forma de pago</option>
                  {paymentMethods.map((paymentMethod) => (
                    <option key={paymentMethod.id} value={paymentMethod.id}>
                      {paymentMethod.status === "INACTIVE"
                        ? `${paymentMethod.name} - Inactiva`
                        : paymentMethod.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}

        </div>
      </section>

      <section className="mt-5 rounded-lg border border-line bg-white">
        <div className="flex border-b border-line px-4">
          <button
            className="h-12 border-t-4 border-brand px-4 text-sm font-semibold text-brand"
            type="button"
          >
            Productos
          </button>
        </div>

        <div className="px-5 py-6">
          <div className="mb-6 flex max-w-xl items-center gap-3">
            <label className="shrink-0 text-sm font-semibold text-ink" htmlFor="billing-warehouse">
              Bodega:
            </label>
            <select
              className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              id="billing-warehouse"
              value={productForm.warehouseId}
              onChange={(event) =>
                setProductForm((current) => ({
                  ...current,
                  warehouseId: event.target.value,
                  lines: []
                }))
              }
            >
              <option value="">Seleccione bodega</option>
              {availableWarehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                  {warehouse.isDefault ? " - Principal" : ""}
                </option>
              ))}
            </select>
            <button className={iconButtonClass} type="button" title="Buscar bodega">
              <Search size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-line">
            <div>
              <div className="hidden bg-slate-50 px-3 py-3 text-xs font-semibold uppercase text-slate-500 xl:grid xl:grid-cols-[72px_minmax(160px,1.7fr)_minmax(80px,.75fr)_minmax(90px,.8fr)_minmax(92px,.8fr)_minmax(90px,.8fr)_minmax(90px,.8fr)_68px_minmax(85px,.75fr)_minmax(95px,.9fr)_44px] xl:gap-2">
                <span>Cant.</span>
                <span>Producto</span>
                <span>Unidad</span>
                <span>Precio U.</span>
                <span className="flex items-center justify-between">
                  IVA
                  <Search size={14} aria-hidden="true" />
                </span>
                <span className="flex items-center justify-between">
                  Ret. IR
                  <Search size={14} aria-hidden="true" />
                </span>
                <span className="flex items-center justify-between">
                  Ret. IVA
                  <Search size={14} aria-hidden="true" />
                </span>
                <span className="text-center">Desc. +</span>
                <span>Desc.</span>
                <span className="text-right">Subtotal</span>
                <span />
              </div>

              {productForm.lines.map((line, index) => (
                <div
                  className="grid grid-cols-1 items-end gap-3 border-t border-line px-3 py-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[72px_minmax(160px,1.7fr)_minmax(80px,.75fr)_minmax(90px,.8fr)_minmax(92px,.8fr)_minmax(90px,.8fr)_minmax(90px,.8fr)_68px_minmax(85px,.75fr)_minmax(95px,.9fr)_44px] xl:gap-2"
                  key={`${index}-${line.catalogItemId}`}
                >
                  <label className="block">
                    <span className={`${labelClass} xl:hidden`}>Cant.</span>
                    <input
                      className={`${inputClass} mt-1 text-right xl:mt-0`}
                      min="0.0001"
                      onChange={(event) => updateProductLine(index, "quantity", event.target.value)}
                      step="0.0001"
                      type="number"
                      value={line.quantity}
                    />
                  </label>
                  <label className="block md:col-span-2 lg:col-span-4 xl:col-span-1">
                    <span className={`${labelClass} xl:hidden`}>Producto</span>
                    <select
                      className={`${inputClass} mt-1 xl:mt-0`}
                      onChange={(event) => updateProductLine(index, "catalogItemId", event.target.value)}
                      value={line.catalogItemId}
                    >
                      <option value="">Seleccione producto</option>
                      {productsForWarehouse.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.internalCode} - {product.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={`${labelClass} xl:hidden`}>Unidad</span>
                    <input
                      className={`${inputClass} mt-1 xl:mt-0`}
                      onChange={(event) => updateProductLine(index, "unit", event.target.value)}
                      value={line.unit}
                    />
                  </label>
                  <label className="block">
                    <span className={`${labelClass} xl:hidden`}>Precio U.</span>
                    <input
                      className={`${inputClass} mt-1 text-right xl:mt-0`}
                      inputMode="decimal"
                      onChange={(event) => updateProductLine(index, "unitPrice", event.target.value)}
                      type="text"
                      value={line.unitPrice}
                    />
                  </label>
                  <label className="block">
                    <span className={`${labelClass} xl:hidden`}>IVA</span>
                    <select
                      className={`${inputClass} mt-1 xl:mt-0`}
                      onChange={(event) => updateProductLine(index, "ivaRate", event.target.value)}
                      value={line.ivaRate}
                    >
                      <option value="15">IVA 15%</option>
                      <option value="5">IVA 5%</option>
                      <option value="0">IVA 0%</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className={`${labelClass} xl:hidden`}>Ret. IR</span>
                    <input
                      className={`${inputClass} mt-1 text-right xl:mt-0`}
                      min="0"
                      onChange={(event) =>
                        updateProductLine(index, "incomeTaxRetention", event.target.value)
                      }
                      step="0.01"
                      type="number"
                      value={line.incomeTaxRetention}
                    />
                  </label>
                  <label className="block">
                    <span className={`${labelClass} xl:hidden`}>Ret. IVA</span>
                    <input
                      className={`${inputClass} mt-1 text-right xl:mt-0`}
                      min="0"
                      onChange={(event) => updateProductLine(index, "ivaRetention", event.target.value)}
                      step="0.01"
                      type="number"
                      value={line.ivaRetention}
                    />
                  </label>
                  <label className="block">
                    <span className={`${labelClass} xl:hidden`}>Desc. +</span>
                    <select
                      className={`${inputClass} mt-1 text-center xl:mt-0`}
                      onChange={(event) => updateProductLine(index, "discountMode", event.target.value)}
                      value={line.discountMode}
                    >
                      <option value="$">$</option>
                      <option value="%">%</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className={`${labelClass} xl:hidden`}>Desc.</span>
                    <input
                      className={`${inputClass} mt-1 text-right xl:mt-0`}
                      min="0"
                      onChange={(event) => updateProductLine(index, "discount", event.target.value)}
                      step="0.01"
                      type="number"
                      value={line.discount}
                    />
                  </label>
                  <div>
                    <span className={`${labelClass} xl:hidden`}>Subtotal</span>
                    <p className="mt-1 h-10 rounded-lg border border-line bg-slate-50 px-3 py-2 text-right text-sm font-semibold text-ink xl:mt-0">
                      ${money(lineSubtotal(line))}
                    </p>
                  </div>
                  <button
                    className={`${iconButtonClass} w-full xl:w-10 xl:px-0`}
                    onClick={() => removeProductLine(index)}
                    title="Quitar"
                    type="button"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            {!productForm.lines.length ? (
              <div className="border-t border-line px-4 py-5">
                <button className={iconButtonClass} onClick={addProductLine} type="button">
                  <Plus size={16} aria-hidden="true" />
                  <span className="ml-2">Agregar detalle</span>
                </button>
              </div>
            ) : null}
          </div>

          {productForm.lines.length ? (
            <button className={`${iconButtonClass} mt-4`} onClick={addProductLine} type="button">
              <Plus size={16} aria-hidden="true" />
              <span className="ml-2">Agregar detalle</span>
            </button>
          ) : null}
        </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <label className="grid gap-2 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
          <span className="pt-3 text-right text-sm font-medium text-ink">Descripcion:</span>
          <textarea
            className="min-h-28 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            onChange={(event) =>
              setProductForm((current) => ({ ...current, description: event.target.value }))
            }
            value={productForm.description}
          />
        </label>

        <div className="space-y-2">
          <AmountRow label="Subtotal 15%" value={totals.subtotal15} />
          <AmountRow label="Subtotal 5%" value={totals.subtotal5} />
          <AmountRow label="Subtotal 0%" value={totals.subtotal0} />
          <AmountRow label="Descuento" value={totals.discount} />
          <AmountRow label="IVA 15%" value={totals.iva15} />
          <AmountRow label="IVA 5%" value={totals.iva5} />
          <AmountRow label="ICE" value={totals.ice} />
          <AmountRow label="Total" value={totals.total} strong />
        </div>
      </section>

      <div className="mt-8 flex flex-wrap justify-end gap-2">
        {isProformaMode ? (
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={savingDocument}
            onClick={handleDocumentSubmit}
            type="button"
          >
            <Save size={16} aria-hidden="true" />
            Guardar proforma
          </button>
        ) : (
          <>
            <button
              className={iconButtonClass}
              disabled={savingDocument || Boolean(submittedDocumentId)}
              onClick={() => handleDocumentSubmit({ asProforma: true })}
              type="button"
            >
              <Save size={16} aria-hidden="true" />
              <span className="ml-2">Guardar proforma</span>
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={savingDocument || Boolean(submittedDocumentId)}
              onClick={handleDocumentSubmit}
              type="button"
            >
              {savingDocument ? (
                <RefreshCw className="animate-spin" size={16} aria-hidden="true" />
              ) : (
                <Save size={16} aria-hidden="true" />
              )}
              <span>
                {savingDocument
                  ? "Guardando y enviando..."
                  : submittedDocumentId
                    ? "Factura ya registrada"
                    : "Guardar y enviar al SRI"}
              </span>
            </button>
            {printableDocument ? (
              <button
                className={iconButtonClass}
                disabled={savingDocument}
                onClick={printInvoiceDocument}
                type="button"
              >
                <Printer size={16} aria-hidden="true" />
                <span className="ml-2">Imprimir factura</span>
              </button>
            ) : null}
          </>
        )}
      </div>

      {printableDocument ? (
        <div className="invoice-print-host">
          <InvoicePrintSheet document={printableDocument} />
        </div>
      ) : null}

      {personModalOpen ? (
        <PersonFormModal
          disabled={savingPerson}
          form={personForm}
          onChange={updatePersonForm}
          onClose={() => setPersonModalOpen(false)}
          onSubmit={handlePersonSubmit}
          onToggleRole={togglePersonRole}
        />
      ) : null}

    </div>
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

function Field({ label, children }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function PersonCombobox({
  clients,
  open,
  search,
  selectedClientId,
  onAdd,
  onBlur,
  onChange,
  onFocus,
  onSelect
}) {
  return (
    <div className="relative">
      <div className="flex">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
            aria-hidden="true"
          />
          <input
            className="h-10 w-full rounded-l-lg border border-line bg-white pl-9 pr-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            onBlur={onBlur}
            onChange={(event) => onChange(event.target.value)}
            onFocus={onFocus}
            placeholder="Escriba identificacion, nombre, telefono o email"
            value={search}
            required={!selectedClientId}
          />
        </div>
        <button
          className="inline-flex h-10 w-12 items-center justify-center rounded-r-lg border border-l-0 border-line bg-white text-ink hover:bg-mist"
          onClick={onAdd}
          title="Nueva persona"
          type="button"
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-line bg-white py-1 text-sm shadow-lg">
          {clients.length ? (
            clients.map((client) => (
              <button
                className={`block w-full px-3 py-2 text-left hover:bg-mist ${
                  selectedClientId === client.id ? "bg-teal-50 text-brand" : "text-ink"
                }`}
                key={client.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(client.id)}
                type="button"
              >
                <span className="font-medium">{clientLabel(client)}</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {[client.email, client.telefono].filter(Boolean).join(" | ") || "Sin contacto"}
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-slate-500">
              Sin clientes encontrados. Use el boton + para agregarlo manualmente.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function PersonFormModal({ disabled, form, onChange, onClose, onSubmit, onToggleRole }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
      <form
        className="max-h-full w-full max-w-3xl overflow-y-auto rounded-lg border border-line bg-white shadow-xl"
        onSubmit={onSubmit}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <UserRound size={18} className="text-brand" aria-hidden="true" />
            <h3 className="font-medium text-ink">Nueva persona</h3>
          </div>
          <button className={iconButtonClass} onClick={onClose} type="button" title="Cerrar">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Tipo de persona">
            <select
              className={inputClass}
              value={form.tipoPersona}
              onChange={(event) => onChange("tipoPersona", event.target.value)}
              required
            >
              <option value="NATURAL">Natural</option>
              <option value="JURIDICA">Juridica</option>
            </select>
          </Field>
          <Field label="Tipo de identificacion">
            <select
              className={inputClass}
              value={form.tipoIdentificacion}
              onChange={(event) => onChange("tipoIdentificacion", event.target.value)}
              required
            >
              <option value="CEDULA">Cedula</option>
              <option value="RUC">RUC</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>
          </Field>
          <Field label="Identificacion">
            <input
              className={inputClass}
              value={form.identificacion}
              onChange={(event) => onChange("identificacion", event.target.value)}
              required
            />
          </Field>
          <Field label="Nombre / Razon social">
            <input
              className={inputClass}
              value={form.nombre}
              onChange={(event) => onChange("nombre", event.target.value)}
              required
            />
          </Field>
          <Field label="Telefono">
            <input
              className={inputClass}
              value={form.telefono}
              onChange={(event) => onChange("telefono", event.target.value)}
            />
          </Field>
          <Field label="Email">
            <input
              className={inputClass}
              type="email"
              value={form.email}
              onChange={(event) => onChange("email", event.target.value)}
            />
          </Field>
          <Field label="Estado">
            <select
              className={inputClass}
              value={form.activo}
              onChange={(event) => onChange("activo", event.target.value)}
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Direccion">
              <textarea
                className="min-h-20 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                value={form.direccion}
                onChange={(event) => onChange("direccion", event.target.value)}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <p className={labelClass}>Rol de la persona</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {roleOptions.map(([role, label]) => (
                <label
                  key={role}
                  className="flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm text-ink"
                >
                  <input
                    className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
                    type="checkbox"
                    checked={form.roles.includes(role)}
                    onChange={() => onToggleRole(role)}
                    disabled={role === "CLIENTE"}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button className={iconButtonClass} onClick={onClose} type="button">
            Cancelar
          </button>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
            type="submit"
          >
            <Save size={17} aria-hidden="true" />
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
