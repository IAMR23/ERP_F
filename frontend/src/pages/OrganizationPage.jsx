import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Edit3,
  GitBranch,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createBranch,
  createCompany,
  disableBranch,
  disableCompany,
  getBranches,
  getCompanies,
  updateBranch,
  updateCompany
} from "../services/organizationService";

const emptyCompanyForm = {
  legalName: "",
  tradeName: "",
  ruc: "",
  mainAddress: "",
  email: "",
  phone: "",
  sriEnvironment: "TEST",
  currency: "USD",
  timezone: "America/Guayaquil",
  status: "ACTIVE"
};

const emptyBranchForm = {
  companyId: "",
  code: "",
  name: "",
  address: "",
  phone: "",
  email: "",
  managerName: "",
  sriEstablishmentCode: "001",
  status: "ACTIVE"
};

const inputClass =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
const labelClass = "text-xs font-medium uppercase text-slate-500";
const iconButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-sm text-ink hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60";

function dateText(value) {
  return value ? new Date(value).toLocaleString() : "";
}

function statusLabel(status) {
  return status === "ACTIVE" ? "Activo" : "Inactivo";
}

export default function OrganizationPage() {
  const [tab, setTab] = useState("companies");
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm);
  const [branchForm, setBranchForm] = useState(emptyBranchForm);
  const [editingCompanyId, setEditingCompanyId] = useState(null);
  const [editingBranchId, setEditingBranchId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activeCompanies = useMemo(
    () => companies.filter((company) => company.status === "ACTIVE"),
    [companies]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [companyData, branchData] = await Promise.all([getCompanies(), getBranches()]);
      const nextCompanies = companyData.companies || [];
      setCompanies(nextCompanies);
      setBranches(branchData.branches || []);
      setBranchForm((current) => ({
        ...current,
        companyId: current.companyId || nextCompanies.find((company) => company.status === "ACTIVE")?.id || ""
      }));
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function updateCompanyForm(field, value) {
    setCompanyForm((current) => ({ ...current, [field]: value }));
  }

  function updateBranchForm(field, value) {
    setBranchForm((current) => ({ ...current, [field]: value }));
  }

  function resetCompanyForm() {
    setEditingCompanyId(null);
    setCompanyForm(emptyCompanyForm);
  }

  function resetBranchForm(companyId = activeCompanies[0]?.id || "") {
    setEditingBranchId(null);
    setBranchForm({ ...emptyBranchForm, companyId });
  }

  async function submitCompany(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (editingCompanyId) {
        await updateCompany(editingCompanyId, companyForm);
        setNotice("Empresa actualizada");
      } else {
        const response = await createCompany(companyForm);
        setNotice("Empresa creada");
        resetBranchForm(response.company.id);
      }

      resetCompanyForm();
      await loadData();
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitBranch(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (editingBranchId) {
        await updateBranch(editingBranchId, branchForm);
        setNotice("Sucursal actualizada");
      } else {
        await createBranch(branchForm);
        setNotice("Sucursal creada");
      }

      resetBranchForm(branchForm.companyId);
      await loadData();
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeCompany(companyId) {
    await removeRecord(() => disableCompany(companyId), "Empresa desactivada");
  }

  async function removeBranch(branchId) {
    await removeRecord(() => disableBranch(branchId), "Sucursal desactivada");
  }

  async function removeRecord(action, message) {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await action();
      setNotice(message);
      await loadData();
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setSaving(false);
    }
  }

  function editCompany(company) {
    setTab("companies");
    setEditingCompanyId(company.id);
    setCompanyForm({
      legalName: company.legalName,
      tradeName: company.tradeName,
      ruc: company.ruc,
      mainAddress: company.mainAddress || "",
      email: company.email || "",
      phone: company.phone || "",
      sriEnvironment: company.sriEnvironment,
      currency: company.currency,
      timezone: company.timezone,
      status: company.status
    });
  }

  function editBranch(branch) {
    setTab("branches");
    setEditingBranchId(branch.id);
    setBranchForm({
      companyId: branch.companyId,
      code: branch.code,
      name: branch.name,
      address: branch.address || "",
      phone: branch.phone || "",
      email: branch.email || "",
      managerName: branch.managerName || "",
      sriEstablishmentCode: branch.sriEstablishmentCode || "001",
      status: branch.status
    });
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Organizacion</h2>
          <p className="mt-1 text-sm text-slate-500">Empresas y sucursales.</p>
        </div>
        <button className={iconButtonClass} onClick={loadData} type="button" disabled={loading}>
          <RefreshCw size={17} aria-hidden="true" />
          Actualizar
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

      <nav className="mb-5 flex flex-wrap gap-2">
        {[
          ["companies", "Empresas", Building2],
          ["branches", "Sucursales", GitBranch]
        ].map(([key, label, Icon]) => (
          <button
            key={key}
            className={`inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm ${
              tab === key
                ? "border-brand bg-brand text-white"
                : "border-line bg-white text-slate-600 hover:bg-mist"
            }`}
            onClick={() => setTab(key)}
            type="button"
          >
            <Icon size={17} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>

      {tab === "companies" ? (
        <CompaniesSection
          companies={companies}
          disabled={saving}
          editingId={editingCompanyId}
          form={companyForm}
          loading={loading}
          onCancel={resetCompanyForm}
          onChange={updateCompanyForm}
          onDelete={removeCompany}
          onEdit={editCompany}
          onSubmit={submitCompany}
        />
      ) : null}

      {tab === "branches" ? (
        <BranchesSection
          branches={branches}
          companies={activeCompanies}
          disabled={saving}
          editingId={editingBranchId}
          form={branchForm}
          loading={loading}
          onCancel={() => resetBranchForm(branchForm.companyId)}
          onChange={updateBranchForm}
          onDelete={removeBranch}
          onEdit={editBranch}
          onSubmit={submitBranch}
        />
      ) : null}
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

function Input(props) {
  return <input {...props} className={inputClass} />;
}

function Select(props) {
  return <select {...props} className={inputClass} />;
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className="min-h-24 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
    />
  );
}

function FormActions({ disabled, editingId, onCancel }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button className={primaryButtonClass} disabled={disabled} type="submit">
        <Save size={17} aria-hidden="true" />
        {editingId ? "Actualizar" : "Guardar"}
      </button>
      {editingId ? (
        <button className={iconButtonClass} onClick={onCancel} type="button">
          <X size={17} aria-hidden="true" />
          Cancelar
        </button>
      ) : null}
    </div>
  );
}

function CompaniesSection(props) {
  return (
    <div className="grid gap-5 xl:grid-cols-[430px_1fr]">
      <form className="rounded-lg border border-line bg-white" onSubmit={props.onSubmit}>
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Plus size={18} className="text-brand" aria-hidden="true" />
          <h3 className="font-medium text-ink">{props.editingId ? "Editar empresa" : "Nueva empresa"}</h3>
        </div>
        <div className="space-y-4 p-4">
          <Field label="Razon social">
            <Input
              value={props.form.legalName}
              onChange={(event) => props.onChange("legalName", event.target.value)}
              required
            />
          </Field>
          <Field label="Nombre comercial">
            <Input
              value={props.form.tradeName}
              onChange={(event) => props.onChange("tradeName", event.target.value)}
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="RUC">
              <Input
                value={props.form.ruc}
                onChange={(event) => props.onChange("ruc", event.target.value)}
                maxLength={13}
                required
              />
            </Field>
            <Field label="Telefono">
              <Input
                value={props.form.phone}
                onChange={(event) => props.onChange("phone", event.target.value)}
              />
            </Field>
          </div>
          <Field label="Email">
            <Input
              type="email"
              value={props.form.email}
              onChange={(event) => props.onChange("email", event.target.value)}
            />
          </Field>
          <Field label="Direccion matriz">
            <Textarea
              value={props.form.mainAddress}
              onChange={(event) => props.onChange("mainAddress", event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ambiente SRI">
              <Select
                value={props.form.sriEnvironment}
                onChange={(event) => props.onChange("sriEnvironment", event.target.value)}
              >
                <option value="TEST">Pruebas</option>
                <option value="PRODUCTION">Produccion</option>
              </Select>
            </Field>
            <Field label="Estado">
              <Select
                value={props.form.status}
                onChange={(event) => props.onChange("status", event.target.value)}
              >
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Moneda">
              <Input
                value={props.form.currency}
                onChange={(event) => props.onChange("currency", event.target.value)}
                maxLength={3}
              />
            </Field>
            <Field label="Zona horaria">
              <Input
                value={props.form.timezone}
                onChange={(event) => props.onChange("timezone", event.target.value)}
              />
            </Field>
          </div>
          <FormActions disabled={props.disabled} editingId={props.editingId} onCancel={props.onCancel} />
        </div>
      </form>

      <DataTable
        columns={["Empresa", "RUC", "SRI", "Estado", "Uso", "Actualizacion", "Acciones"]}
        emptyText={props.loading ? "Cargando..." : "Sin empresas registradas"}
        rows={props.companies.map((company) => [
          <div key={`${company.id}-name`}>
            <p className="font-medium text-ink">{company.tradeName}</p>
            <p className="text-slate-500">{company.legalName}</p>
          </div>,
          company.ruc,
          company.sriEnvironment === "PRODUCTION" ? "Produccion" : "Pruebas",
          statusLabel(company.status),
          `${company._count.branches} suc. / ${company._count.catalogItems} prod.`,
          dateText(company.updatedAt),
          <RowActions
            key={company.id}
            disabled={props.disabled}
            onDelete={() => props.onDelete(company.id)}
            onEdit={() => props.onEdit(company)}
          />
        ])}
      />
    </div>
  );
}

function BranchesSection(props) {
  return (
    <div className="grid gap-5 xl:grid-cols-[430px_1fr]">
      <form className="rounded-lg border border-line bg-white" onSubmit={props.onSubmit}>
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Plus size={18} className="text-accent" aria-hidden="true" />
          <h3 className="font-medium text-ink">{props.editingId ? "Editar sucursal" : "Nueva sucursal"}</h3>
        </div>
        <div className="space-y-4 p-4">
          <Field label="Empresa">
            <Select
              value={props.form.companyId}
              onChange={(event) => props.onChange("companyId", event.target.value)}
              disabled={Boolean(props.editingId)}
              required
            >
              <option value="">Seleccionar</option>
              {props.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.tradeName}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Codigo">
              <Input
                className={`${inputClass} uppercase`}
                value={props.form.code}
                onChange={(event) => props.onChange("code", event.target.value)}
                maxLength={24}
                required
              />
            </Field>
            <Field label="Punto Emision SRI">
              <Input
                value={props.form.sriEstablishmentCode}
                onChange={(event) => props.onChange("sriEstablishmentCode", event.target.value)}
                maxLength={3}
              />
            </Field>
          </div>
          <Field label="Nombre">
            <Input
              value={props.form.name}
              onChange={(event) => props.onChange("name", event.target.value)}
              required
            />
          </Field>
          <Field label="Direccion">
            <Textarea
              value={props.form.address}
              onChange={(event) => props.onChange("address", event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telefono">
              <Input
                value={props.form.phone}
                onChange={(event) => props.onChange("phone", event.target.value)}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={props.form.email}
                onChange={(event) => props.onChange("email", event.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Responsable">
              <Input
                value={props.form.managerName}
                onChange={(event) => props.onChange("managerName", event.target.value)}
              />
            </Field>
            <Field label="Estado">
              <Select
                value={props.form.status}
                onChange={(event) => props.onChange("status", event.target.value)}
              >
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
              </Select>
            </Field>
          </div>
          <FormActions disabled={props.disabled} editingId={props.editingId} onCancel={props.onCancel} />
        </div>
      </form>

      <DataTable
        columns={["Sucursal", "Empresa", "SRI", "Contacto", "Estado", "Uso", "Acciones"]}
        emptyText={props.loading ? "Cargando..." : "Sin sucursales registradas"}
        rows={props.branches.map((branch) => [
          <div key={`${branch.id}-name`}>
            <p className="font-medium text-ink">{branch.name}</p>
            <p className="text-slate-500">{branch.code}</p>
          </div>,
          branch.company?.tradeName,
          branch.sriEstablishmentCode,
          <div key={`${branch.id}-contact`}>
            <p>{branch.managerName || "Sin responsable"}</p>
            <p className="text-slate-500">{branch.phone || branch.email || "Sin contacto"}</p>
          </div>,
          statusLabel(branch.status),
          `${branch._count.warehouses} bod.`,
          <RowActions
            key={branch.id}
            disabled={props.disabled}
            onDelete={() => props.onDelete(branch.id)}
            onEdit={() => props.onEdit(branch)}
          />
        ])}
      />
    </div>
  );
}

function RowActions({ disabled, onDelete, onEdit }) {
  return (
    <div className="flex gap-2">
      <button
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={onEdit}
        title="Editar"
        type="button"
      >
        <Edit3 size={16} aria-hidden="true" />
      </button>
      <button
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={onDelete}
        title="Desactivar"
        type="button"
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function DataTable({ columns, emptyText, rows }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="align-top">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={columns.length}>
                  {emptyText}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
