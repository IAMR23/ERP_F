import { LockKeyhole, LogIn } from "lucide-react";
import { useState } from "react";
import { login } from "../services/authService";

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("admin@erp.local");
  const [password, setPassword] = useState("Admin123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const session = await login(email, password);
      onLogin(session);
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen grid-cols-1 bg-mist lg:grid-cols-[1fr_460px]">
      <section className="flex items-center px-6 py-10 sm:px-10 lg:px-16">
        <div className="max-w-3xl">
          <div className="mb-8 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-brand text-white">
            <LockKeyhole size={24} aria-hidden="true" />
          </div>
          <h1 className="text-4xl font-semibold tracking-normal text-ink sm:text-5xl">ERP</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
            Gestion operativa para empresas, sucursales, catalogo, inventario, ventas y seguridad
            multi-tenant.
          </p>
          <div className="mt-10 grid max-w-xl grid-cols-2 gap-3 text-sm text-slate-600">
            {["Express API", "PostgreSQL", "React Vite", "Tailwind"].map((item) => (
              <div key={item} className="rounded-lg border border-line bg-white px-4 py-3">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex items-center bg-white px-6 py-10 shadow-panel sm:px-10">
        <form className="w-full" onSubmit={handleSubmit}>
          <h2 className="text-2xl font-semibold text-ink">Ingresar</h2>
          <p className="mt-2 text-sm text-slate-500">Usuario principal cargado por seed.</p>

          <label className="mt-8 block text-sm font-medium text-ink" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="mt-2 h-11 w-full rounded-lg border border-line px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
          />

          <label className="mt-5 block text-sm font-medium text-ink" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="mt-2 h-11 w-full rounded-lg border border-line px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
          />

          {error ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            <LogIn size={18} aria-hidden="true" />
            {loading ? "Ingresando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
