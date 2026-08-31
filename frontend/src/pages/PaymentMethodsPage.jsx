import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Edit3,
  RefreshCw,
  Save,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  createPaymentMethod,
  deletePaymentMethod,
  getPaymentMethods,
  updatePaymentMethod
} from "../services/paymentMethodService";

const emptyForm = {
  code: "",
  name: "",
  status: "ACTIVE"
};

const defaultMethods = [
  { code: "TRANSFER", name: "Transferencia" },
  { code: "CASH", name: "Efectivo" },
  { code: "CREDIT_CARD", name: "T. Credito" },
  { code: "DEBIT_CARD", name: "T. Debito" },
  { code: "SHARED_PAYMENTS", name: "P. Compartidos" }
];

const inputClass =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
const labelClass = "text-xs font-medium uppercase text-slate-500";
const iconButtonClass =
  "inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-3 text-sm text-ink hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50";

function dateText(value) {
  return value ? new Date(value).toLocaleString() : "";
}

export default function PaymentMethodsPage() {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  async function loadPaymentMethods() {
    setLoading(true);
    setError("");

    try {
      const data = await getPaymentMethods();
      setPaymentMethods(data.paymentMethods || []);
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: field === "code" ? value.toUpperCase() : value
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function editPaymentMethod(paymentMethod) {
    setEditingId(paymentMethod.id);
    setForm({
      code: paymentMethod.code,
      name: paymentMethod.name,
      status: paymentMethod.status
    });
  }

  async function submitPaymentMethod(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (editingId) {
        await updatePaymentMethod(editingId, form);
        setNotice("Forma de pago actualizada");
      } else {
        await createPaymentMethod(form);
        setNotice("Forma de pago creada");
      }

      resetForm();
      await loadPaymentMethods();
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setSaving(false);
    }
  }

  async function disablePaymentMethod(id) {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await deletePaymentMethod(id);
      setNotice("Forma de pago desactivada");
      await loadPaymentMethods();
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
          <h2 className="text-2xl font-semibold text-ink">Formas de pago</h2>
          <p className="mt-1 text-sm text-slate-500">Metodos disponibles para registrar cobros.</p>
        </div>
        <button className={iconButtonClass} onClick={loadPaymentMethods} type="button" disabled={loading}>
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

      <section className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <form className="rounded-lg border border-line bg-white" onSubmit={submitPaymentMethod}>
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <CreditCard size={18} className="text-brand" aria-hidden="true" />
            <h3 className="font-medium text-ink">
              {editingId ? "Editar forma de pago" : "Nueva forma de pago"}
            </h3>
          </div>

          <div className="space-y-4 p-4">
            <label className="block">
              <span className={labelClass}>Codigo</span>
              <input
                className={`${inputClass} mt-1 uppercase`}
                value={form.code}
                onChange={(event) => updateForm("code", event.target.value)}
                maxLength={40}
                required
              />
            </label>

            <label className="block">
              <span className={labelClass}>Nombre</span>
              <input
                className={`${inputClass} mt-1`}
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                required
              />
            </label>

            <label className="block">
              <span className={labelClass}>Estado</span>
              <select
                className={`${inputClass} mt-1`}
                value={form.status}
                onChange={(event) => updateForm("status", event.target.value)}
              >
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
              </select>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={saving}
              >
                <Save size={17} aria-hidden="true" />
                {editingId ? "Actualizar" : "Guardar"}
              </button>
              {editingId ? (
                <button className={iconButtonClass} onClick={resetForm} type="button" disabled={saving}>
                  <X size={17} aria-hidden="true" />
                  <span className="ml-2">Cancelar</span>
                </button>
              ) : null}
            </div>
          </div>
        </form>

        <div className="space-y-5">
          <div className="rounded-lg border border-line bg-white">
            <div className="border-b border-line px-4 py-3">
              <h3 className="font-medium text-ink">Metodos iniciales</h3>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {defaultMethods.map((method) => (
                <button
                  key={method.code}
                  className="rounded-lg border border-line bg-white px-3 py-2 text-left text-sm hover:bg-mist"
                  onClick={() => setForm({ ...method, status: "ACTIVE" })}
                  type="button"
                >
                  <span className="font-medium text-ink">{method.name}</span>
                  <span className="mt-1 block text-xs text-slate-500">{method.code}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-line bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-line text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    {["Codigo", "Nombre", "Estado", "Creacion", "Actualizacion", "Acciones"].map(
                      (column) => (
                        <th key={column} className="px-4 py-3 font-medium">
                          {column}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {loading ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan="6">
                        Cargando...
                      </td>
                    </tr>
                  ) : null}

                  {!loading && !paymentMethods.length ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan="6">
                        Sin formas de pago registradas
                      </td>
                    </tr>
                  ) : null}

                  {!loading
                    ? paymentMethods.map((paymentMethod) => (
                        <tr key={paymentMethod.id}>
                          <td className="px-4 py-3 font-medium text-ink">{paymentMethod.code}</td>
                          <td className="px-4 py-3">{paymentMethod.name}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-medium ${
                                paymentMethod.status === "ACTIVE"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {paymentMethod.status === "ACTIVE" ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{dateText(paymentMethod.createdAt)}</td>
                          <td className="px-4 py-3 text-slate-500">{dateText(paymentMethod.updatedAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink hover:bg-mist"
                                onClick={() => editPaymentMethod(paymentMethod)}
                                title="Editar"
                                type="button"
                              >
                                <Edit3 size={16} aria-hidden="true" />
                              </button>
                              <button
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => disablePaymentMethod(paymentMethod.id)}
                                title="Desactivar"
                                type="button"
                                disabled={saving || paymentMethod.status === "INACTIVE"}
                              >
                                <Trash2 size={16} aria-hidden="true" />
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
        </div>
      </section>
    </div>
  );
}
