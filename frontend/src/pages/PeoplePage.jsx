import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Save,
  Search,
  UserRound,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createPerson,
  getPeople,
  setPersonActive,
  updatePerson
} from "../services/personService";

const roleOptions = [
  ["CLIENTE", "Cliente"],
  ["PROVEEDOR", "Proveedor"],
  ["EMPLEADO", "Empleado"],
  ["VENDEDOR", "Vendedor"]
];

const emptyForm = {
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

const inputClass =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
const labelClass = "text-xs font-medium uppercase text-slate-500";
const iconButtonClass =
  "inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-3 text-sm text-ink hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50";

function dateText(value) {
  return value ? new Date(value).toLocaleString() : "";
}

function statusText(activo) {
  return activo ? "Activo" : "Inactivo";
}

function roleLabel(role) {
  return roleOptions.find(([value]) => value === role)?.[1] || role;
}

export default function PeoplePage() {
  const [people, setPeople] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [viewingPerson, setViewingPerson] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPeople = useCallback(async (term = "") => {
    setLoading(true);
    setError("");

    try {
      const data = await getPeople(term);
      setPeople(data.people || []);
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPeople("");
  }, [loadPeople]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadPeople(search);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [loadPeople, search]);

  const title = useMemo(() => (editingId ? "Editar persona" : "Nueva persona"), [editingId]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleRole(role) {
    setForm((current) => {
      const exists = current.roles.includes(role);
      return {
        ...current,
        roles: exists
          ? current.roles.filter((currentRole) => currentRole !== role)
          : [...current.roles, role]
      };
    });
  }

  function openNewForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function openEditForm(person) {
    setEditingId(person.id);
    setForm({
      tipoPersona: person.tipoPersona,
      tipoIdentificacion: person.tipoIdentificacion,
      identificacion: person.identificacion,
      nombre: person.nombre,
      telefono: person.telefono || "",
      email: person.email || "",
      direccion: person.direccion || "",
      roles: person.roles || [],
      activo: String(Boolean(person.activo))
    });
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        ...form,
        activo: form.activo === "true"
      };

      if (editingId) {
        await updatePerson(editingId, payload);
        setNotice("Persona actualizada");
      } else {
        await createPerson(payload);
        setNotice("Persona creada");
      }

      closeForm();
      await loadPeople(search);
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(person) {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await setPersonActive(person.id, !person.activo);
      setNotice(person.activo ? "Persona desactivada" : "Persona activada");
      await loadPeople(search);
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
          <h2 className="text-2xl font-semibold text-ink">Personas</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className={iconButtonClass} onClick={() => loadPeople(search)} type="button" disabled={loading}>
            <RefreshCw size={17} aria-hidden="true" />
            <span className="ml-2">Actualizar</span>
          </button>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-teal-800"
            onClick={openNewForm}
            type="button"
          >
            <Plus size={17} aria-hidden="true" />
            Nueva persona
          </button>
        </div>
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

      <div className="mb-4 rounded-lg border border-line bg-white p-3">
        <label className="relative block">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={17}
            aria-hidden="true"
          />
          <input
            className="h-10 w-full rounded-lg border border-line bg-white pl-10 pr-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            placeholder="Buscar por identificacion, nombre, telefono o email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Identificacion",
                  "Nombre / Razon social",
                  "Telefono",
                  "Email",
                  "Roles",
                  "Estado",
                  "Acciones"
                ].map((column) => (
                  <th key={column} className="px-4 py-3 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan="7">
                    Cargando...
                  </td>
                </tr>
              ) : null}

              {!loading && !people.length ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan="7">
                    Sin personas registradas
                  </td>
                </tr>
              ) : null}

              {!loading
                ? people.map((person) => (
                    <tr key={person.id} className="align-top">
                      <td className="px-4 py-3 font-medium text-ink">
                        <p>{person.identificacion}</p>
                        <p className="text-xs font-normal text-slate-500">{person.tipoIdentificacion}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{person.nombre}</p>
                        <p className="text-slate-500">{person.company?.tradeName}</p>
                      </td>
                      <td className="px-4 py-3">{person.telefono || "-"}</td>
                      <td className="px-4 py-3">{person.email || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {person.roles.map((role) => (
                            <span
                              key={role}
                              className="rounded-md bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800"
                            >
                              {roleLabel(role)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-medium ${
                            person.activo
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {statusText(person.activo)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            className={iconButtonClass}
                            onClick={() => setViewingPerson(person)}
                            title="Ver"
                            type="button"
                          >
                            <Eye size={16} aria-hidden="true" />
                          </button>
                          <button
                            className={iconButtonClass}
                            onClick={() => openEditForm(person)}
                            title="Editar"
                            type="button"
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </button>
                          <button
                            className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm ${
                              person.activo
                                ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                            disabled={saving}
                            onClick={() => toggleActive(person)}
                            title={person.activo ? "Desactivar" : "Activar"}
                            type="button"
                          >
                            {person.activo ? (
                              <PowerOff size={16} aria-hidden="true" />
                            ) : (
                              <Power size={16} aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen ? (
        <PersonFormModal
          disabled={saving}
          form={form}
          onChange={updateForm}
          onClose={closeForm}
          onSubmit={handleSubmit}
          onToggleRole={toggleRole}
          title={title}
        />
      ) : null}

      {viewingPerson ? (
        <PersonDetailModal person={viewingPerson} onClose={() => setViewingPerson(null)} />
      ) : null}
    </div>
  );
}

function PersonFormModal({ disabled, form, onChange, onClose, onSubmit, onToggleRole, title }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
      <form
        className="max-h-full w-full max-w-3xl overflow-y-auto rounded-lg border border-line bg-white shadow-xl"
        onSubmit={onSubmit}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <UserRound size={18} className="text-brand" aria-hidden="true" />
            <h3 className="font-medium text-ink">{title}</h3>
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

function PersonDetailModal({ person, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
      <section className="w-full max-w-2xl rounded-lg border border-line bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <UserRound size={18} className="text-brand" aria-hidden="true" />
            <h3 className="font-medium text-ink">Detalle de persona</h3>
          </div>
          <button className={iconButtonClass} onClick={onClose} type="button" title="Cerrar">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-4 p-4 text-sm md:grid-cols-2">
          <Detail label="Identificacion" value={`${person.tipoIdentificacion} ${person.identificacion}`} />
          <Detail label="Tipo de persona" value={person.tipoPersona} />
          <Detail label="Nombre / Razon social" value={person.nombre} />
          <Detail label="Telefono" value={person.telefono || "-"} />
          <Detail label="Email" value={person.email || "-"} />
          <Detail label="Direccion" value={person.direccion || "-"} />
          <Detail label="Estado" value={statusText(person.activo)} />
          <Detail label="Creacion" value={dateText(person.createdAt)} />
          <Detail label="Actualizacion" value={dateText(person.updatedAt)} />
          <div className="md:col-span-2">
            <p className={labelClass}>Roles</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {person.roles.map((role) => (
                <span key={role} className="rounded-md bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800">
                  {roleLabel(role)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
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

function Detail({ label, value }) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <p className="mt-1 font-medium text-ink">{value}</p>
    </div>
  );
}
