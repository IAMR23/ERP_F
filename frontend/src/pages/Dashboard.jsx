import {
  ArrowRightLeft,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Files,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  PackagePlus,
  ShieldCheck,
  UsersRound,
  Warehouse
} from "lucide-react";
import { useEffect, useState } from "react";
import Metric from "../components/Metric";
import { api } from "../services/api";
import { logout } from "../services/authService";
import BillingPage from "./BillingPage";
import CatalogPage from "./CatalogPage";
import CompanySettingsPage from "./CompanySettingsPage";
import CreditNotesPage from "./CreditNotesPage";
import DocumentsPage from "./DocumentsPage";
import OrganizationPage from "./OrganizationPage";
import PaymentMethodsPage from "./PaymentMethodsPage";
import PeoplePage from "./PeoplePage";
import ProformaPage from "./ProformaPage";
import WarehousesPage from "./WarehousesPage";

const modules = [
  { id: "dashboard", name: "Dashboard", icon: LayoutDashboard, status: "Resumen" },
  { id: "organization", name: "Organizacion", icon: Building2, status: "Base lista" },
  { id: "people", name: "Personas", icon: UsersRound, status: "Clientes y proveedores" },
  { id: "catalog", name: "Catalogo", icon: Package, status: "Productos" },
  { id: "warehouses", name: "Bodegas", icon: Warehouse, status: "Entradas de stock" },
  { id: "paymentMethods", name: "Formas de pago", icon: CreditCard, status: "Metodos de cobro" },
  { id: "billing", name: "Facturacion", icon: CircleDollarSign, status: "Documento electronico" },
  { id: "creditNotes", name: "Notas de credito", icon: FileText, status: "Devoluciones" },
  { id: "proforma", name: "Proforma", icon: ClipboardList, status: "Cotizaciones" },
  { id: "documents", name: "Documentos", icon: Files, status: "Consulta de documentos" },
  { id: "security", name: "Seguridad", icon: ShieldCheck, status: "Permisos listos" }
];

const warehouseSections = [
  { id: "warehouses", name: "Bodegas", icon: Warehouse },
  { id: "entries", name: "Ingresos de productos", icon: PackagePlus },
  { id: "transfers", name: "Transferencias", icon: ArrowRightLeft }
];

const warehouseSectionRouteValues = {
  warehouses: "bodegas",
  entries: "ingresos",
  transfers: "transferencias"
};

const warehouseSectionByRouteValue = {
  bodegas: "warehouses",
  ingresos: "entries",
  transferencias: "transfers"
};

const routeByView = {
  dashboard: "/dashboard",
  organization: "/organizacion",
  people: "/personas",
  catalog: "/catalogo",
  warehouses: "/bodegas",
  paymentMethods: "/formas-pago",
  billing: "/facturacion",
  creditNotes: "/notas-credito",
  proforma: "/proforma",
  documents: "/documentos",
  companySettings: "/mi-compania"
};

const viewByRoute = {
  "/": "dashboard",
  "/dashboard": "dashboard",
  "/organizacion": "organization",
  "/personas": "people",
  "/catalogo": "catalog",
  "/bodegas": "warehouses",
  "/formas-pago": "paymentMethods",
  "/facturacion": "billing",
  "/notas-credito": "creditNotes",
  "/proforma": "proforma",
  "/documentos": "documents",
  "/mi-compania": "companySettings"
};

function normalizePathname(pathname) {
  return pathname.replace(/\/+$/, "") || "/";
}

function getViewFromPathname(pathname) {
  return viewByRoute[normalizePathname(pathname)] || "dashboard";
}

function getCurrentBrowserRoute() {
  return `${normalizePathname(window.location.pathname)}${window.location.search}`;
}

function getWarehouseSectionFromSearch(search) {
  const section = new URLSearchParams(search).get("seccion");
  return warehouseSectionByRouteValue[section] || "warehouses";
}

function getWarehouseSectionRoute(sectionId) {
  const routeValue = warehouseSectionRouteValues[sectionId] || warehouseSectionRouteValues.warehouses;
  return routeValue === warehouseSectionRouteValues.warehouses
    ? routeByView.warehouses
    : `${routeByView.warehouses}?seccion=${routeValue}`;
}

function shouldUseNativeLinkNavigation(event) {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey
  );
}

export default function Dashboard({ session, onLogout }) {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState(() => getViewFromPathname(window.location.pathname));
  const [activeWarehouseSection, setActiveWarehouseSection] = useState(() =>
    getWarehouseSectionFromSearch(window.location.search)
  );
  const [warehouseMenuOpen, setWarehouseMenuOpen] = useState(
    () => getViewFromPathname(window.location.pathname) === "warehouses"
  );

  useEffect(() => {
    api("/dashboard")
      .then(setDashboard)
      .catch((apiError) => setError(apiError.message));
  }, []);

  useEffect(() => {
    const currentView = getViewFromPathname(window.location.pathname);
    const currentRoute = routeByView[currentView];

    if (normalizePathname(window.location.pathname) !== currentRoute) {
      window.history.replaceState(null, "", currentRoute);
    }

    function syncViewFromLocation() {
      const nextView = getViewFromPathname(window.location.pathname);

      setActiveView(nextView);

      if (nextView === "warehouses") {
        setActiveWarehouseSection(getWarehouseSectionFromSearch(window.location.search));
        setWarehouseMenuOpen(true);
      }
    }

    window.addEventListener("popstate", syncViewFromLocation);
    return () => window.removeEventListener("popstate", syncViewFromLocation);
  }, []);

  function setViewRoute(view, route = routeByView[view]) {
    const nextRoute = route;

    setActiveView(view);

    if (getCurrentBrowserRoute() !== nextRoute) {
      window.history.pushState(null, "", nextRoute);
    }
  }

  function handleLogout() {
    logout();
    onLogout();
  }

  function handleModuleClick(moduleId) {
    if (!routeByView[moduleId]) {
      setViewRoute("dashboard");
      return;
    }

    if (moduleId === "warehouses") {
      setActiveWarehouseSection("warehouses");
      setWarehouseMenuOpen(true);
    }

    setViewRoute(moduleId);
  }

  function handleWarehouseSectionClick(sectionId) {
    setActiveWarehouseSection(sectionId);
    setWarehouseMenuOpen(true);
    setViewRoute("warehouses", getWarehouseSectionRoute(sectionId));
  }

  function handleModuleLinkClick(event, moduleId) {
    if (shouldUseNativeLinkNavigation(event)) {
      return;
    }

    event.preventDefault();
    handleModuleClick(moduleId);
  }

  function handleWarehouseMenuLinkClick(event) {
    if (shouldUseNativeLinkNavigation(event)) {
      return;
    }

    event.preventDefault();
    setActiveWarehouseSection("warehouses");
    setWarehouseMenuOpen((current) => (activeView === "warehouses" ? !current : true));
    setViewRoute("warehouses");
  }

  function handleWarehouseSectionLinkClick(event, sectionId) {
    if (shouldUseNativeLinkNavigation(event)) {
      return;
    }

    event.preventDefault();
    handleWarehouseSectionClick(sectionId);
  }

  function renderModuleButton(module, isMobile = false) {
    const Icon = module.icon;
    const isActive = activeView === module.id;
    const activeClass = isActive ? "bg-brand text-white" : "text-slate-600 hover:bg-mist";
    const mobileClass = isActive
      ? "border-brand bg-brand text-white"
      : "border-line bg-white text-slate-600";

    if (module.id === "warehouses" && !isMobile) {
      return (
        <div key={module.id}>
          <a
            className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm ${
              isActive ? "bg-brand text-white" : "text-slate-600 hover:bg-mist"
            }`}
            href={routeByView.warehouses}
            onClick={handleWarehouseMenuLinkClick}
            title={module.status}
          >
            <Icon size={18} aria-hidden="true" />
            <span className="min-w-0 flex-1">{module.name}</span>
            <ChevronDown
              className={`shrink-0 transition-transform ${warehouseMenuOpen ? "rotate-180" : ""}`}
              size={16}
              aria-hidden="true"
            />
          </a>

          {warehouseMenuOpen ? (
            <div className="mt-1 space-y-1 pl-7">
              {warehouseSections.map((section) => {
                const SectionIcon = section.icon;
                const isSectionActive =
                  activeView === "warehouses" && activeWarehouseSection === section.id;

                return (
                  <a
                    key={section.id}
                    className={`flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-sm ${
                      isSectionActive
                        ? "bg-mist text-brand"
                        : "text-slate-500 hover:bg-mist hover:text-ink"
                    }`}
                    href={getWarehouseSectionRoute(section.id)}
                    onClick={(event) => handleWarehouseSectionLinkClick(event, section.id)}
                  >
                    <SectionIcon size={16} aria-hidden="true" />
                    {section.name}
                  </a>
                );
              })}
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <a
        key={module.id}
        className={
          isMobile
            ? `inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm ${mobileClass}`
            : `flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm ${activeClass}`
        }
        href={routeByView[module.id] || routeByView.dashboard}
        onClick={(event) => handleModuleLinkClick(event, module.id)}
        title={module.status}
      >
        <Icon size={isMobile ? 17 : 18} aria-hidden="true" />
        {module.name}
      </a>
    );
  }

  return (
    <main className="min-h-screen bg-mist">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white p-5 lg:block">
        <h1 className="text-2xl font-semibold text-ink">ERP</h1>
        <nav className="mt-8 space-y-1">{modules.map((module) => renderModuleButton(module))}</nav>
      </aside>

      <section className="lg:pl-64">
        <header className="flex min-h-16 items-center justify-between border-b border-line bg-white px-5 sm:px-8">
          <div>
            <p className="text-sm text-slate-500">Sesion activa</p>
            <p className="font-medium text-ink">{session.user.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm ${
                activeView === "companySettings"
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-white text-ink hover:bg-mist"
              }`}
              href={routeByView.companySettings}
              onClick={(event) => {
                if (shouldUseNativeLinkNavigation(event)) {
                  return;
                }

                event.preventDefault();
                setViewRoute("companySettings");
              }}
              title="Mi compania"
            >
              <BriefcaseBusiness size={17} aria-hidden="true" />
              <span className="hidden sm:inline">Mi compania</span>
            </a>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm text-ink hover:bg-mist"
              onClick={handleLogout}
              type="button"
            >
              <LogOut size={17} aria-hidden="true" />
              Salir
            </button>
          </div>
        </header>

        <div className="px-5 py-6 sm:px-8">
          <nav className="mb-5 flex gap-2 overflow-x-auto lg:hidden">
            {modules.map((module) => renderModuleButton(module, true))}
          </nav>

          {activeView === "warehouses" ? (
            <nav className="mb-5 flex gap-2 overflow-x-auto lg:hidden">
              {warehouseSections.map((section) => {
                const SectionIcon = section.icon;
                const isActive = activeWarehouseSection === section.id;

                return (
                  <a
                    key={section.id}
                    className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm ${
                      isActive
                        ? "border-brand bg-brand text-white"
                        : "border-line bg-white text-slate-600"
                    }`}
                    href={getWarehouseSectionRoute(section.id)}
                    onClick={(event) => handleWarehouseSectionLinkClick(event, section.id)}
                  >
                    <SectionIcon size={17} aria-hidden="true" />
                    {section.name}
                  </a>
                );
              })}
            </nav>
          ) : null}

          {activeView === "catalog" ? (
            <CatalogPage onBack={() => setViewRoute("dashboard")} />
          ) : activeView === "companySettings" ? (
            <CompanySettingsPage onBack={() => setViewRoute("dashboard")} />
          ) : activeView === "organization" ? (
            <OrganizationPage />
          ) : activeView === "people" ? (
            <PeoplePage />
          ) : activeView === "warehouses" ? (
            <WarehousesPage activeView={activeWarehouseSection} />
          ) : activeView === "paymentMethods" ? (
            <PaymentMethodsPage />
          ) : activeView === "billing" ? (
            <BillingPage session={session} />
          ) : activeView === "creditNotes" ? (
            <CreditNotesPage />
          ) : activeView === "proforma" ? (
            <ProformaPage session={session} />
          ) : activeView === "documents" ? (
            <DocumentsPage />
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-ink">Dashboard</h2>
                <p className="mt-1 text-sm text-slate-500">Datos iniciales creados en PostgreSQL.</p>
              </div>

              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Metric label="Empresas" value={dashboard?.metrics.companies || "..."} />
                <Metric label="Sucursales" value={dashboard?.metrics.branches || "..."} />
                <Metric label="Bodegas" value={dashboard?.metrics.warehouses || "..."} />
                <Metric label="Productos" value={dashboard?.metrics.products || "..."} />
                <Metric label="Saldos stock" value={dashboard?.metrics.stockBalances || "..."} />
                <Metric label="Ventas" value={dashboard?.metrics.sales || "..."} />
              </section>

              <section className="mt-7 grid gap-5 xl:grid-cols-2">
                <div className="rounded-lg border border-line bg-white">
                  <div className="border-b border-line px-4 py-3">
                    <h3 className="font-medium text-ink">Empresas</h3>
                  </div>
                  <div className="divide-y divide-line">
                    {(dashboard?.companies || []).map((company) => (
                      <div key={company.id} className="px-4 py-3 text-sm">
                        <p className="font-medium text-ink">{company.tradeName}</p>
                        <p className="text-slate-500">{company.ruc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-line bg-white">
                  <div className="border-b border-line px-4 py-3">
                    <h3 className="font-medium text-ink">Productos</h3>
                  </div>
                  <div className="divide-y divide-line">
                    {(dashboard?.products || []).map((product) => (
                      <div key={product.id} className="flex items-center justify-between px-4 py-3 text-sm">
                        <div>
                          <p className="font-medium text-ink">{product.name}</p>
                          <p className="text-slate-500">{product.internalCode}</p>
                        </div>
                        <p className="font-medium text-ink">${product.salePrice}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
