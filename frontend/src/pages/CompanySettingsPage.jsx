import { ArrowLeft, BriefcaseBusiness, Edit3, Eye, Plus, Save, Trash2, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { API_ORIGIN } from "../services/api";
import {
  createCompanyUser,
  disableCompanyUser,
  getCompanySettings,
  getCompanyUsers,
  updateCompanySettings,
  updateCompanyUser
} from "../services/organizationService";

const emptyForm = {
  id: "",
  ruc: "",
  legalName: "",
  tradeName: "",
  establishmentNumber: "",
  accountingRequired: false,
  specialContributor: false,
  largeTaxpayer: false,
  exporter: false,
  exporterType: "NO_HABITUAL",
  rimpe: false,
  withholdingAgent: false,
  specialContributorResolution: "",
  withholdingAgentResolution: "",
  largeTaxpayerResolution: "",
  sriSoftwareProviderRuc: "",
  city: "",
  phone: "",
  mainAddress: "",
  decimalPlaces: "2",
  notificationEmail: "",
  logoObjectKey: "",
  hasSriCertificate: false,
  quoteWarranty: "",
  quotePaymentMethod: "",
  logo: null,
  proformaSignature: null
};

const emptyUserForm = {
  name: "",
  username: "",
  email: "",
  password: "",
  status: "ACTIVE",
  roleId: "",
  branchId: ""
};

const inputClass =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
const labelClass = "text-xs font-medium uppercase text-slate-500";
const iconButtonClass =
  "inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-3 text-sm text-ink hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60";

function booleanString(value) {
  return value ? "true" : "false";
}

function fileName(file, objectKey, emptyLabel = "Imagen no seleccionada") {
  if (file?.name) {
    return file.name;
  }

  if (!objectKey) {
    return emptyLabel;
  }

  return objectKey.split("/").pop();
}

function hasFileExtension(file, extension) {
  return Boolean(file?.name?.toLowerCase().endsWith(extension));
}

export default function CompanySettingsPage({ onBack }) {
  const [activeTab, setActiveTab] = useState("general");
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [editingUserId, setEditingUserId] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [userSaving, setUserSaving] = useState(false);

  const loadCompany = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getCompanySettings();
      const company = response.company;

      setForm({
        ...emptyForm,
        id: company.id,
        ruc: company.ruc || "",
        legalName: company.legalName || "",
        tradeName: company.tradeName || "",
        establishmentNumber: company.establishmentNumber || "",
        accountingRequired: Boolean(company.accountingRequired),
        specialContributor: Boolean(company.specialContributor),
        largeTaxpayer: Boolean(company.largeTaxpayer),
        exporter: Boolean(company.exporter),
        exporterType: company.exporterType || "NO_HABITUAL",
        rimpe: Boolean(company.rimpe),
        withholdingAgent: Boolean(company.withholdingAgent),
        specialContributorResolution: company.specialContributorResolution || "",
        withholdingAgentResolution: company.withholdingAgentResolution || "",
        largeTaxpayerResolution: company.largeTaxpayerResolution || "",
        sriSoftwareProviderRuc: company.sriSoftwareProviderRuc || "",
        city: company.city || "",
        phone: company.phone || "",
        mainAddress: company.mainAddress || "",
        decimalPlaces: String(company.decimalPlaces ?? 2),
        notificationEmail: company.notificationEmail || "",
        logoObjectKey: company.logoObjectKey || "",
        hasSriCertificate: Boolean(company.hasSriCertificate),
        quoteWarranty: company.quoteWarranty || "",
        quotePaymentMethod: company.quotePaymentMethod || ""
      });
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setError("");

    try {
      const response = await getCompanyUsers();
      setUsers(response.users || []);
      setRoles(response.roles || []);
      setBranches(response.branches || []);
      setUsersLoaded(true);
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "users" && !usersLoaded) {
      loadUsers();
    }
  }, [activeTab, loadUsers, usersLoaded]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateUserField(field, value) {
    setUserForm((current) => ({ ...current, [field]: value }));
  }

  function resetUserForm() {
    setUserForm(emptyUserForm);
    setEditingUserId("");
  }

  function handleEditUser(user) {
    setEditingUserId(user.id);
    setUserForm({
      name: user.name || "",
      username: user.username || "",
      email: user.email || "",
      password: "",
      status: user.status || "ACTIVE",
      roleId: user.roleId || "",
      branchId: user.branchId || ""
    });
    setNotice("");
    setError("");
  }

  async function handleUserSubmit(event) {
    event.preventDefault();

    setUserSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        name: userForm.name,
        username: userForm.username,
        email: userForm.email,
        status: userForm.status,
        roleId: userForm.roleId,
        branchId: userForm.branchId
      };

      if (!editingUserId || userForm.password) {
        payload.password = userForm.password;
      }

      if (editingUserId) {
        await updateCompanyUser(editingUserId, payload);
        setNotice("Usuario actualizado");
      } else {
        await createCompanyUser(payload);
        setNotice("Usuario creado");
      }

      resetUserForm();
      await loadUsers();
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setUserSaving(false);
    }
  }

  async function handleDisableUser(userId) {
    const accepted = window.confirm("Deseas desactivar este usuario?");
    if (!accepted) {
      return;
    }

    setUserSaving(true);
    setError("");
    setNotice("");

    try {
      await disableCompanyUser(userId);
      setNotice("Usuario desactivado");
      if (editingUserId === userId) {
        resetUserForm();
      }
      await loadUsers();
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setUserSaving(false);
    }
  }

  function openStoredImage(objectKey) {
    if (!objectKey) {
      return;
    }

    window.open(`${API_ORIGIN}/uploads/${objectKey}`, "_blank", "noopener,noreferrer");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.id) {
      setError("Empresa no encontrada");
      return;
    }

    if (form.proformaSignature && !hasFileExtension(form.proformaSignature, ".p12")) {
      setError("El certificado SRI debe ser un archivo con extension .p12");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const formData = new FormData();
      [
        "ruc",
        "legalName",
        "tradeName",
        "establishmentNumber",
        "city",
        "phone",
        "mainAddress",
        "decimalPlaces",
        "notificationEmail",
        "specialContributorResolution",
        "withholdingAgentResolution",
        "largeTaxpayerResolution",
        "sriSoftwareProviderRuc",
        "quotePaymentMethod"
      ].forEach((field) => formData.append(field, form[field]));

      formData.append("accountingRequired", booleanString(form.accountingRequired));
      formData.append("specialContributor", booleanString(form.specialContributor));
      formData.append("largeTaxpayer", booleanString(form.largeTaxpayer));
      formData.append("exporter", booleanString(form.exporter));
      formData.append("exporterType", form.exporterType);
      formData.append("rimpe", booleanString(form.rimpe));
      formData.append("withholdingAgent", booleanString(form.withholdingAgent));

      if (form.logo) formData.append("logo", form.logo);
      if (form.proformaSignature) formData.append("proformaSignature", form.proformaSignature);

      const response = await updateCompanySettings(form.id, formData);
      const company = response.company;

      setForm((current) => ({
        ...current,
        logo: null,
        proformaSignature: null,
        logoObjectKey: company.logoObjectKey || "",
        hasSriCertificate: Boolean(company.hasSriCertificate)
      }));
      setNotice("Configuracion guardada");
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Mi compania</h2>
          <p className="mt-1 text-sm text-slate-500">Configuracion general de la empresa.</p>
        </div>
        <button className={iconButtonClass} onClick={onBack} type="button">
          <ArrowLeft size={17} aria-hidden="true" />
          <span className="ml-2">Volver</span>
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}

      <section className="rounded-lg border border-line bg-white">
        <div className="flex border-b border-line px-4">
          <button
            className={`h-12 border-t-4 px-4 text-sm font-semibold ${
              activeTab === "general"
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-ink"
            }`}
            onClick={() => setActiveTab("general")}
            type="button"
          >
            General
          </button>
          <button
            className={`h-12 border-t-4 px-4 text-sm font-semibold ${
              activeTab === "users"
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-ink"
            }`}
            onClick={() => setActiveTab("users")}
            type="button"
          >
            Usuarios
          </button>
        </div>

        {activeTab === "general" ? (
          <form onSubmit={handleSubmit}>
        <section className="p-4">
          <div className="mb-4 flex items-center gap-2">
            <BriefcaseBusiness size={18} className="text-brand" aria-hidden="true" />
            <h3 className="font-medium text-ink">Configuraciones de la Empresa</h3>
          </div>

          {loading ? (
            <p className="rounded-lg border border-line bg-mist px-4 py-5 text-sm text-slate-500">
              Cargando...
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-line">
              <div className="hidden grid-cols-[260px_minmax(0,1fr)_110px] border-b border-line bg-slate-50 text-xs font-semibold uppercase text-slate-500 md:grid">
                <div className="px-3 py-3">Configuracion</div>
                <div className="border-l border-line px-3 py-3">Descripcion</div>
                <div className="border-l border-line px-3 py-3 text-center">Acciones</div>
              </div>

              <SettingRow label="Ruc">
                <input
                  className={inputClass}
                  onChange={(event) => updateField("ruc", event.target.value)}
                  required
                  value={form.ruc}
                />
              </SettingRow>
              <SettingRow label="Razon social">
                <input
                  className={inputClass}
                  onChange={(event) => updateField("legalName", event.target.value)}
                  required
                  value={form.legalName}
                />
              </SettingRow>
              <SettingRow label="Nombre comercial">
                <input
                  className={inputClass}
                  onChange={(event) => updateField("tradeName", event.target.value)}
                  required
                  value={form.tradeName}
                />
              </SettingRow>
              <SettingRow label="Numero de Establecimientos">
                <input
                  className={`${inputClass} max-w-xs`}
                  onChange={(event) => updateField("establishmentNumber", event.target.value)}
                  value={form.establishmentNumber}
                />
              </SettingRow>
              <SettingRow label="Obligado a llevar contabilidad">
                <select
                  className={`${inputClass} max-w-xs`}
                  onChange={(event) =>
                    updateField("accountingRequired", event.target.value === "true")
                  }
                  value={booleanString(form.accountingRequired)}
                >
                  <option value="true">SI</option>
                  <option value="false">NO</option>
                </select>
              </SettingRow>
              <SettingRow label="Contribuyente especial">
                <Checkbox
                  checked={form.specialContributor}
                  onChange={(value) => updateField("specialContributor", value)}
                />
              </SettingRow>
              <SettingRow label="Resolucion contribuyente especial">
                <input
                  className={`${inputClass} max-w-xs`}
                  onChange={(event) => updateField("specialContributorResolution", event.target.value)}
                  value={form.specialContributorResolution}
                />
              </SettingRow>
              <SettingRow label="Gran Contribuyente">
                <Checkbox
                  checked={form.largeTaxpayer}
                  onChange={(value) => updateField("largeTaxpayer", value)}
                />
              </SettingRow>
              <SettingRow label="Resolucion gran contribuyente">
                <input
                  className={`${inputClass} max-w-xs`}
                  onChange={(event) => updateField("largeTaxpayerResolution", event.target.value)}
                  value={form.largeTaxpayerResolution}
                />
              </SettingRow>
              <SettingRow label="Exportador">
                <div className="flex flex-wrap items-center gap-4">
                  <Checkbox
                    checked={form.exporter}
                    onChange={(value) => updateField("exporter", value)}
                  />
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      checked={form.exporterType === "NO_HABITUAL"}
                      className="h-4 w-4 border-line text-brand focus:ring-brand"
                      onChange={() => updateField("exporterType", "NO_HABITUAL")}
                      type="radio"
                    />
                    No habitual
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      checked={form.exporterType === "HABITUAL"}
                      className="h-4 w-4 border-line text-brand focus:ring-brand"
                      onChange={() => updateField("exporterType", "HABITUAL")}
                      type="radio"
                    />
                    Habitual
                  </label>
                </div>
              </SettingRow>
              <SettingRow label="Contribuyente Regimen RIMPE">
                <Checkbox checked={form.rimpe} onChange={(value) => updateField("rimpe", value)} />
              </SettingRow>
              <SettingRow label="Agente de retencion">
                <Checkbox
                  checked={form.withholdingAgent}
                  onChange={(value) => updateField("withholdingAgent", value)}
                />
              </SettingRow>
              <SettingRow label="Resolucion agente de retencion">
                <input
                  className={`${inputClass} max-w-xs`}
                  onChange={(event) => updateField("withholdingAgentResolution", event.target.value)}
                  value={form.withholdingAgentResolution}
                />
              </SettingRow>
              <SettingRow label="RUC proveedor sistema">
                <input
                  className={`${inputClass} max-w-xs`}
                  inputMode="numeric"
                  onChange={(event) => updateField("sriSoftwareProviderRuc", event.target.value)}
                  value={form.sriSoftwareProviderRuc}
                />
              </SettingRow>
              <SettingRow label="Ciudad">
                <input
                  className={`${inputClass} max-w-lg`}
                  onChange={(event) => updateField("city", event.target.value)}
                  value={form.city}
                />
              </SettingRow>
              <SettingRow label="Telefonos">
                <input
                  className={inputClass}
                  onChange={(event) => updateField("phone", event.target.value)}
                  value={form.phone}
                />
              </SettingRow>
              <SettingRow label="Direccion">
                <textarea
                  className="min-h-20 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                  onChange={(event) => updateField("mainAddress", event.target.value)}
                  value={form.mainAddress}
                />
              </SettingRow>
              <SettingRow label="Num. Decimales">
                <select
                  className={`${inputClass} max-w-xs`}
                  onChange={(event) => updateField("decimalPlaces", event.target.value)}
                  value={form.decimalPlaces}
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((decimals) => (
                    <option key={decimals} value={decimals}>
                      {decimals}
                    </option>
                  ))}
                </select>
              </SettingRow>
              <SettingRow label="Email Notificacion">
                <input
                  className={inputClass}
                  onChange={(event) => updateField("notificationEmail", event.target.value)}
                  type="email"
                  value={form.notificationEmail}
                />
              </SettingRow>
              <SettingRow
                action={
                  <button
                    className={iconButtonClass}
                    disabled={!form.logoObjectKey}
                    onClick={() => openStoredImage(form.logoObjectKey)}
                    title="Ver logo"
                    type="button"
                  >
                    <Eye size={16} aria-hidden="true" />
                  </button>
                }
                label="Logo de la Empresa"
                note="Ancho y alto maximo: 500x300 px. Formato permitido: jpg, jpeg, png, gif, bmp."
              >
                <FilePicker
                  file={form.logo}
                  objectKey={form.logoObjectKey}
                  onChange={(file) => updateField("logo", file)}
                />
              </SettingRow>
              <SettingRow
                label="Certificado de firma electronica SRI (.p12)"
                note={form.hasSriCertificate ? "Certificado cargado. Formato permitido: p12." : "Formato permitido: p12."}
              >
                <FilePicker
                  accept=".p12"
                  allowedExtensions={[".p12"]}
                  emptyLabel={form.hasSriCertificate ? "Certificado cargado" : "Archivo no seleccionado"}
                  file={form.proformaSignature}
                  onChange={(file) => {
                    updateField("proformaSignature", file);
                    if (file) setError("");
                  }}
                  onInvalid={() => setError("El certificado SRI debe ser un archivo con extension .p12")}
                />
              </SettingRow>
              <SettingRow label="Contrasena" note="Variable de entorno: SRI_P12_PASSWORD">
                <input
                  className={`${inputClass} max-w-xl bg-slate-50 text-slate-500`}
                  disabled
                  readOnly
                  type="text"
                  value="Configurada en .env"
                />
              </SettingRow>
              <SettingRow label="Forma de Pago" note="Predeterminada en cotizaciones">
                <input
                  className={`${inputClass} max-w-xl`}
                  onChange={(event) => updateField("quotePaymentMethod", event.target.value)}
                  value={form.quotePaymentMethod}
                />
              </SettingRow>
            </div>
          )}
        </section>

        <div className="flex justify-end border-t border-line px-4 py-3">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving || loading}
            type="submit"
          >
            <Save size={17} aria-hidden="true" />
            Guardar
          </button>
        </div>
          </form>
        ) : (
          <UsersPanel
            branches={branches}
            editingUserId={editingUserId}
            form={userForm}
            loading={usersLoading}
            onCancel={resetUserForm}
            onChange={updateUserField}
            onDisable={handleDisableUser}
            onEdit={handleEditUser}
            onSubmit={handleUserSubmit}
            roles={roles}
            saving={userSaving}
            users={users}
          />
        )}
      </section>
    </main>
  );
}

function UsersPanel({
  branches,
  editingUserId,
  form,
  loading,
  onCancel,
  onChange,
  onDisable,
  onEdit,
  onSubmit,
  roles,
  saving,
  users
}) {
  return (
    <section className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <Users size={18} className="text-brand" aria-hidden="true" />
        <h3 className="font-medium text-ink">Usuarios</h3>
      </div>

      <form className="mb-5 rounded-lg border border-line bg-white p-4" onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className={labelClass}>Nombre</span>
            <input
              className={`${inputClass} mt-1`}
              onChange={(event) => onChange("name", event.target.value)}
              required
              value={form.name}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Usuario</span>
            <input
              className={`${inputClass} mt-1`}
              onChange={(event) => onChange("username", event.target.value)}
              required
              value={form.username}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Correo</span>
            <input
              className={`${inputClass} mt-1`}
              onChange={(event) => onChange("email", event.target.value)}
              required
              type="email"
              value={form.email}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Contrasena</span>
            <input
              className={`${inputClass} mt-1`}
              minLength={editingUserId ? undefined : 6}
              onChange={(event) => onChange("password", event.target.value)}
              placeholder={editingUserId ? "Dejar vacia para mantener" : ""}
              required={!editingUserId}
              type="password"
              value={form.password}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Estado</span>
            <select
              className={`${inputClass} mt-1`}
              onChange={(event) => onChange("status", event.target.value)}
              value={form.status}
            >
              <option value="ACTIVE">Activo</option>
              <option value="INACTIVE">Inactivo</option>
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Rol</span>
            <select
              className={`${inputClass} mt-1`}
              onChange={(event) => onChange("roleId", event.target.value)}
              required
              value={form.roleId}
            >
              <option value="">Seleccionar rol</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className={labelClass}>Sucursal</span>
            <select
              className={`${inputClass} mt-1`}
              onChange={(event) => onChange("branchId", event.target.value)}
              required
              value={form.branchId}
            >
              <option value="">Seleccionar sucursal</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} - {branch.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {editingUserId ? (
            <button className={iconButtonClass} onClick={onCancel} type="button">
              <X size={17} aria-hidden="true" />
              <span className="ml-2">Cancelar</span>
            </button>
          ) : null}
          <button className={primaryButtonClass} disabled={saving || loading} type="submit">
            {editingUserId ? <Save size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
            {editingUserId ? "Actualizar" : "Crear usuario"}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="rounded-lg border border-line bg-mist px-4 py-5 text-sm text-slate-500">
          Cargando usuarios...
        </p>
      ) : users.length ? (
        <div className="rounded-lg border border-line">
          <div className="hidden grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(120px,0.75fr)_minmax(0,1fr)_100px_150px] border-b border-line bg-slate-50 text-xs font-semibold uppercase text-slate-500 lg:grid">
            <div className="px-3 py-3">Usuario</div>
            <div className="border-l border-line px-3 py-3">Correo</div>
            <div className="border-l border-line px-3 py-3">Rol</div>
            <div className="border-l border-line px-3 py-3">Sucursal</div>
            <div className="border-l border-line px-3 py-3">Estado</div>
            <div className="border-l border-line px-3 py-3 text-center">Acciones</div>
          </div>

          {users.map((user) => (
            <div
              className="grid gap-3 border-b border-line px-3 py-3 last:border-b-0 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(120px,0.75fr)_minmax(0,1fr)_100px_150px] lg:gap-0 lg:px-0 lg:py-0"
              key={user.id}
            >
              <UserCell label="Usuario">
                <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{user.username}</p>
              </UserCell>
              <UserCell label="Correo">{user.email}</UserCell>
              <UserCell label="Rol">{user.roleName || "Sin rol"}</UserCell>
              <UserCell label="Sucursal">
                {user.branchCode ? `${user.branchCode} - ${user.branchName}` : "Sin sucursal"}
              </UserCell>
              <UserCell label="Estado">
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                    user.status === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {user.status === "ACTIVE" ? "Activo" : "Inactivo"}
                </span>
              </UserCell>
              <div className="flex items-center gap-2 lg:justify-center lg:border-l lg:border-line lg:px-3 lg:py-2">
                <button className={iconButtonClass} onClick={() => onEdit(user)} title="Editar" type="button">
                  <Edit3 size={16} aria-hidden="true" />
                </button>
                <button
                  className={iconButtonClass}
                  disabled={saving || user.status === "INACTIVE"}
                  onClick={() => onDisable(user.id)}
                  title="Desactivar"
                  type="button"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-line bg-mist px-4 py-5 text-sm text-slate-500">
          No hay usuarios registrados.
        </p>
      )}
    </section>
  );
}

function UserCell({ children, label }) {
  return (
    <div className="min-w-0 text-sm text-ink lg:border-l lg:border-line lg:px-3 lg:py-3 lg:first:border-l-0">
      <p className="mb-1 text-xs font-semibold uppercase text-slate-500 lg:hidden">{label}</p>
      <div className="min-w-0 truncate">{children}</div>
    </div>
  );
}

function SettingRow({ action = null, children, label, note }) {
  return (
    <div className="grid gap-2 border-b border-line px-3 py-3 last:border-b-0 md:grid-cols-[260px_minmax(0,1fr)_110px] md:gap-0 md:px-0 md:py-0">
      <div className="md:border-r md:border-line md:px-3 md:py-3">
        <p className="text-sm font-semibold text-ink">{label}:</p>
        {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
      </div>
      <div className="min-w-0 md:px-3 md:py-2">{children}</div>
      <div className="flex items-center md:justify-center md:border-l md:border-line md:px-3 md:py-2">
        {action}
      </div>
    </div>
  );
}

function Checkbox({ checked, onChange }) {
  return (
    <input
      checked={checked}
      className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
      onChange={(event) => onChange(event.target.checked)}
      type="checkbox"
    />
  );
}

function FilePicker({
  accept = "image/*",
  allowedExtensions = [],
  emptyLabel = "Imagen no seleccionada",
  file,
  objectKey,
  onChange,
  onInvalid
}) {
  function handleChange(event) {
    const selectedFile = event.target.files?.[0] || null;

    if (
      selectedFile &&
      allowedExtensions.length &&
      !allowedExtensions.some((extension) => hasFileExtension(selectedFile, extension))
    ) {
      event.target.value = "";
      onChange(null);
      onInvalid?.();
      return;
    }

    onChange(selectedFile);
  }

  return (
    <label className="flex h-10 w-full cursor-pointer overflow-hidden rounded-lg border border-line bg-white text-sm">
      <span className="inline-flex shrink-0 items-center border-r border-line px-3 font-medium text-brand">
        Seleccionar
      </span>
      <span className="flex min-w-0 flex-1 items-center px-3 text-slate-500">
        <span className="truncate">{fileName(file, objectKey, emptyLabel)}</span>
      </span>
      <input
        accept={accept}
        className="sr-only"
        onChange={handleChange}
        type="file"
      />
    </label>
  );
}
