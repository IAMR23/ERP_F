import { ArrowLeft, Edit3, ImagePlus, PackagePlus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { API_ORIGIN, api, apiForm } from "../services/api";

const emptyCategory = { name: "", description: "", status: "ACTIVE" };
const emptySubcategory = { categoryId: "", name: "", description: "", status: "ACTIVE" };
const emptyProduct = {
  internalCode: "",
  name: "",
  description: "",
  categoryId: "",
  subcategoryId: "",
  status: "ACTIVE",
  barcode: "",
  model: "",
  pvp1: "",
  pvp2: "",
  pvp3: "",
  hasIva: true,
  companyId: "",
  image: null
};

function dateText(value) {
  return value ? new Date(value).toLocaleString() : "";
}

export default function CatalogPage({ onBack }) {
  const [tab, setTab] = useState("products");
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [subcategoryForm, setSubcategoryForm] = useState(emptySubcategory);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingSubcategoryId, setEditingSubcategoryId] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const filteredSubcategories = useMemo(
    () =>
      subcategories.filter((subcategory) => {
        return !productForm.categoryId || subcategory.categoryId === productForm.categoryId;
      }),
    [productForm.categoryId, subcategories]
  );

  useEffect(() => {
    loadCatalog();
  }, []);

  async function loadCatalog() {
    setError("");
    try {
      const [categoryData, subcategoryData, productData, companyData] = await Promise.all([
        api("/catalog/categories"),
        api("/catalog/subcategories"),
        api("/catalog/products"),
        api("/catalog/companies")
      ]);
      setCategories(categoryData.categories);
      setSubcategories(subcategoryData.subcategories);
      setProducts(productData.products);
      setCompanies(companyData.companies);
      setProductForm((current) => ({
        ...current,
        companyId: current.companyId || companyData.companies[0]?.id || ""
      }));
    } catch (apiError) {
      setError(apiError.message);
    }
  }

  function updateCategoryForm(field, value) {
    setCategoryForm((current) => ({ ...current, [field]: value }));
  }

  function updateSubcategoryForm(field, value) {
    setSubcategoryForm((current) => ({ ...current, [field]: value }));
  }

  function updateProductForm(field, value) {
    setProductForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "categoryId") {
        next.subcategoryId = "";
      }
      return next;
    });
  }

  async function submitCategory(event) {
    event.preventDefault();
    await submitJson({
      path: editingCategoryId ? `/catalog/categories/${editingCategoryId}` : "/catalog/categories",
      method: editingCategoryId ? "PUT" : "POST",
      body: categoryForm,
      onDone() {
        setCategoryForm(emptyCategory);
        setEditingCategoryId(null);
      }
    });
  }

  async function submitSubcategory(event) {
    event.preventDefault();
    await submitJson({
      path: editingSubcategoryId
        ? `/catalog/subcategories/${editingSubcategoryId}`
        : "/catalog/subcategories",
      method: editingSubcategoryId ? "PUT" : "POST",
      body: subcategoryForm,
      onDone() {
        setSubcategoryForm(emptySubcategory);
        setEditingSubcategoryId(null);
      }
    });
  }

  async function submitProduct(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const formData = new FormData();
      Object.entries(productForm).forEach(([key, value]) => {
        if (key === "image") {
          if (value) formData.append("image", value);
          return;
        }
        formData.append(key, value);
      });

      await apiForm(
        editingProductId ? `/catalog/products/${editingProductId}` : "/catalog/products",
        formData,
        { method: editingProductId ? "PUT" : "POST" }
      );

      setMessage(editingProductId ? "Producto actualizado" : "Producto creado");
      setEditingProductId(null);
      setProductForm({ ...emptyProduct, companyId: companies[0]?.id || "" });
      await loadCatalog();
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitJson({ path, method, body, onDone }) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await api(path, {
        method,
        body: JSON.stringify(body)
      });
      setMessage(method === "POST" ? "Registro creado" : "Registro actualizado");
      onDone();
      await loadCatalog();
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  }

  async function remove(path, label) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await api(path, { method: "DELETE" });
      setMessage(`${label} desactivado`);
      await loadCatalog();
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  }

  function editCategory(category) {
    setTab("categories");
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name,
      description: category.description || "",
      status: category.status
    });
  }

  function editSubcategory(subcategory) {
    setTab("subcategories");
    setEditingSubcategoryId(subcategory.id);
    setSubcategoryForm({
      categoryId: subcategory.categoryId,
      name: subcategory.name,
      description: subcategory.description || "",
      status: subcategory.status
    });
  }

  function editProduct(product) {
    setTab("products");
    setEditingProductId(product.id);
    setProductForm({
      internalCode: product.internalCode,
      name: product.name,
      description: product.description || "",
      categoryId: product.subcategory.category.id,
      subcategoryId: product.subcategoryId,
      status: product.status,
      barcode: product.barcode || "",
      model: product.model || "",
      pvp1: product.pvp1,
      pvp2: product.pvp2,
      pvp3: product.pvp3,
      hasIva: product.hasIva,
      companyId: product.companyId,
      image: null
    });
  }

  return (
    <main className="min-h-screen bg-mist">
      <header className="border-b border-line bg-white px-5 py-4 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Catalogo</h1>
            <p className="text-sm text-slate-500">Categorias, subcategorias y productos.</p>
          </div>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm text-ink hover:bg-mist"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            Volver
          </button>
        </div>

        <nav className="mt-5 flex flex-wrap gap-2">
          {[
            ["products", "Productos"],
            ["categories", "Categorias"],
            ["subcategories", "Subcategorias"]
          ].map(([key, label]) => (
            <button
              key={key}
              className={`h-10 rounded-lg border px-4 text-sm ${
                tab === key
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-white text-slate-600 hover:bg-mist"
              }`}
              onClick={() => setTab(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <section className="px-5 py-6 sm:px-8">
        {error ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {message}
          </p>
        ) : null}

        {tab === "categories" ? (
          <CategorySection
            categories={categories}
            disabled={loading}
            editingId={editingCategoryId}
            form={categoryForm}
            onCancel={() => {
              setCategoryForm(emptyCategory);
              setEditingCategoryId(null);
            }}
            onChange={updateCategoryForm}
            onDelete={(id) => remove(`/catalog/categories/${id}`, "Categoria")}
            onEdit={editCategory}
            onSubmit={submitCategory}
          />
        ) : null}

        {tab === "subcategories" ? (
          <SubcategorySection
            categories={categories}
            disabled={loading}
            editingId={editingSubcategoryId}
            form={subcategoryForm}
            onCancel={() => {
              setSubcategoryForm(emptySubcategory);
              setEditingSubcategoryId(null);
            }}
            onChange={updateSubcategoryForm}
            onDelete={(id) => remove(`/catalog/subcategories/${id}`, "Subcategoria")}
            onEdit={editSubcategory}
            onSubmit={submitSubcategory}
            subcategories={subcategories}
          />
        ) : null}

        {tab === "products" ? (
          <ProductSection
            categories={categories}
            companies={companies}
            disabled={loading}
            editingId={editingProductId}
            filteredSubcategories={filteredSubcategories}
            form={productForm}
            onCancel={() => {
              setProductForm({ ...emptyProduct, companyId: companies[0]?.id || "" });
              setEditingProductId(null);
            }}
            onChange={updateProductForm}
            onDelete={(id) => remove(`/catalog/products/${id}`, "Producto")}
            onEdit={editProduct}
            onSubmit={submitProduct}
            products={products}
          />
        ) : null}
      </section>
    </main>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm font-medium text-ink">
      <span>{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className="h-10 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className="min-h-24 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
    />
  );
}

function FormActions({ disabled, editingId, onCancel }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        disabled={disabled}
        type="submit"
      >
        <Save size={16} aria-hidden="true" />
        {editingId ? "Actualizar" : "Guardar"}
      </button>
      {editingId ? (
        <button
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-4 text-sm text-ink hover:bg-mist"
          onClick={onCancel}
          type="button"
        >
          <X size={16} aria-hidden="true" />
          Cancelar
        </button>
      ) : null}
    </div>
  );
}

function CategorySection(props) {
  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <form className="rounded-lg border border-line bg-white p-4" onSubmit={props.onSubmit}>
        <h2 className="mb-4 font-semibold text-ink">Categoria</h2>
        <div className="space-y-4">
          <Field label="Nombre">
            <Input
              value={props.form.name}
              onChange={(event) => props.onChange("name", event.target.value)}
              required
            />
          </Field>
          <Field label="Descripcion">
            <Textarea
              value={props.form.description}
              onChange={(event) => props.onChange("description", event.target.value)}
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
          <FormActions
            disabled={props.disabled}
            editingId={props.editingId}
            onCancel={props.onCancel}
          />
        </div>
      </form>
      <SimpleTable
        columns={["Nombre", "Estado", "Actualizacion", "Acciones"]}
        rows={props.categories.map((category) => [
          category.name,
          category.status,
          dateText(category.updatedAt),
          <RowActions
            key={category.id}
            onDelete={() => props.onDelete(category.id)}
            onEdit={() => props.onEdit(category)}
          />
        ])}
      />
    </div>
  );
}

function SubcategorySection(props) {
  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <form className="rounded-lg border border-line bg-white p-4" onSubmit={props.onSubmit}>
        <h2 className="mb-4 font-semibold text-ink">Subcategoria</h2>
        <div className="space-y-4">
          <Field label="Categoria">
            <Select
              value={props.form.categoryId}
              onChange={(event) => props.onChange("categoryId", event.target.value)}
              required
            >
              <option value="">Seleccione</option>
              {props.categories
                .filter((category) => category.status === "ACTIVE")
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Nombre">
            <Input
              value={props.form.name}
              onChange={(event) => props.onChange("name", event.target.value)}
              required
            />
          </Field>
          <Field label="Descripcion">
            <Textarea
              value={props.form.description}
              onChange={(event) => props.onChange("description", event.target.value)}
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
          <FormActions
            disabled={props.disabled}
            editingId={props.editingId}
            onCancel={props.onCancel}
          />
        </div>
      </form>
      <SimpleTable
        columns={["Nombre", "Categoria", "Estado", "Acciones"]}
        rows={props.subcategories.map((subcategory) => [
          subcategory.name,
          subcategory.category?.name,
          subcategory.status,
          <RowActions
            key={subcategory.id}
            onDelete={() => props.onDelete(subcategory.id)}
            onEdit={() => props.onEdit(subcategory)}
          />
        ])}
      />
    </div>
  );
}

function ProductSection(props) {
  return (
    <div className="space-y-5">
      <form className="rounded-lg border border-line bg-white p-4" onSubmit={props.onSubmit}>
        <div className="mb-4 flex items-center gap-2">
          <PackagePlus size={19} aria-hidden="true" />
          <h2 className="font-semibold text-ink">Producto</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Empresa">
            <Select
              value={props.form.companyId}
              onChange={(event) => props.onChange("companyId", event.target.value)}
              required
            >
              <option value="">Seleccione</option>
              {props.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.tradeName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Codigo ID">
            <Input
              value={props.form.internalCode}
              onChange={(event) => props.onChange("internalCode", event.target.value)}
              required
            />
          </Field>
          <Field label="Nombre">
            <Input
              value={props.form.name}
              onChange={(event) => props.onChange("name", event.target.value)}
              required
            />
          </Field>
          <Field label="Modelo">
            <Input
              value={props.form.model}
              onChange={(event) => props.onChange("model", event.target.value)}
            />
          </Field>
          <Field label="Codigo de barras">
            <Input
              value={props.form.barcode}
              onChange={(event) => props.onChange("barcode", event.target.value)}
            />
          </Field>
          <Field label="Categoria">
            <Select
              value={props.form.categoryId}
              onChange={(event) => props.onChange("categoryId", event.target.value)}
              required
            >
              <option value="">Seleccione</option>
              {props.categories
                .filter((category) => category.status === "ACTIVE")
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Subcategoria">
            <Select
              value={props.form.subcategoryId}
              onChange={(event) => props.onChange("subcategoryId", event.target.value)}
              required
            >
              <option value="">Seleccione</option>
              {props.filteredSubcategories
                .filter((subcategory) => subcategory.status === "ACTIVE")
                .map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
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
          <Field label="IVA">
            <Select
              value={String(props.form.hasIva)}
              onChange={(event) => props.onChange("hasIva", event.target.value === "true")}
            >
              <option value="true">IVA 15%</option>
              <option value="false">Sin IVA</option>
            </Select>
          </Field>
          <Field label="PVP 1">
            <Input
              min="0"
              step="0.01"
              type="number"
              value={props.form.pvp1}
              onChange={(event) => props.onChange("pvp1", event.target.value)}
              required
            />
          </Field>
          <Field label="PVP 2">
            <Input
              min="0"
              step="0.01"
              type="number"
              value={props.form.pvp2}
              onChange={(event) => props.onChange("pvp2", event.target.value)}
            />
          </Field>
          <Field label="PVP 3">
            <Input
              min="0"
              step="0.01"
              type="number"
              value={props.form.pvp3}
              onChange={(event) => props.onChange("pvp3", event.target.value)}
            />
          </Field>
          <Field label="Imagen referencial">
            <div className="flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm">
              <ImagePlus size={16} aria-hidden="true" />
              <input
                accept="image/*"
                className="w-full text-sm"
                onChange={(event) => props.onChange("image", event.target.files?.[0] || null)}
                type="file"
              />
            </div>
          </Field>
          <div className="md:col-span-2 xl:col-span-4">
            <Field label="Descripcion">
              <Textarea
                value={props.form.description}
                onChange={(event) => props.onChange("description", event.target.value)}
              />
            </Field>
          </div>
        </div>
        <div className="mt-4">
          <FormActions
            disabled={props.disabled}
            editingId={props.editingId}
            onCancel={props.onCancel}
          />
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Imagen",
                  "Codigo ID",
                  "Nombre",
                  "Codigo barras",
                  "Categoria",
                  "PVP",
                  "IVA",
                  "Estado",
                  "Empresa",
                  "Creacion",
                  "Actualizacion",
                  "Acciones"
                ].map((column) => (
                  <th key={column} className="px-4 py-3 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {props.products.map((product) => (
                <tr key={product.id} className="align-top">
                  <td className="px-4 py-3">
                    {product.imageUrl ? (
                      <img
                        alt={product.name}
                        className="h-12 w-12 rounded-lg object-cover"
                        src={`${API_ORIGIN}${product.imageUrl}`}
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-mist" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">{product.internalCode}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{product.name}</p>
                    <p className="text-slate-500">{product.model || "Sin modelo"}</p>
                  </td>
                  <td className="px-4 py-3">{product.barcode || "-"}</td>
                  <td className="px-4 py-3">
                    <p>{product.subcategory?.category?.name}</p>
                    <p className="text-slate-500">{product.subcategory?.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>${product.pvp1}</p>
                    <p className="text-slate-500">${product.pvp2} / ${product.pvp3}</p>
                  </td>
                  <td className="px-4 py-3">{product.hasIva ? "15%" : "No"}</td>
                  <td className="px-4 py-3">{product.status}</td>
                  <td className="px-4 py-3">{product.company?.tradeName}</td>
                  <td className="px-4 py-3 text-slate-500">{dateText(product.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-500">{dateText(product.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <RowActions
                      onDelete={() => props.onDelete(product.id)}
                      onEdit={() => props.onEdit(product)}
                    />
                  </td>
                </tr>
              ))}
              {!props.products.length ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan="12">
                    Sin productos registrados
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RowActions({ onDelete, onEdit }) {
  return (
    <div className="flex gap-2">
      <button
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink hover:bg-mist"
        onClick={onEdit}
        title="Editar"
        type="button"
      >
        <Edit3 size={16} aria-hidden="true" />
      </button>
      <button
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
        onClick={onDelete}
        title="Desactivar"
        type="button"
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function SimpleTable({ columns, rows }) {
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
              <tr key={rowIndex}>
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
                  Sin registros
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
