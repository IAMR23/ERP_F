function money(value) {
  return Number(value || 0).toFixed(2);
}

function quantity(value) {
  return Number(value || 0).toFixed(2);
}

function dateText(value) {
  return value ? new Date(value).toLocaleDateString("es-EC") : "";
}

function dateTimeText(value) {
  return value ? new Date(value).toLocaleString("es-EC") : "";
}

function documentTitle(document) {
  if (document.documentType === "CREDIT_NOTE") return "NOTA DE CREDITO";
  if (document.documentType === "SALES_NOTE") return "NOTA DE VENTA";
  if (document.documentType === "PROFORMA") return "PROFORMA";
  return "FACTURA";
}

function environmentLabel(environment) {
  return String(environment || "").toUpperCase() === "PRODUCTION" ? "PRODUCCION" : "PRUEBAS";
}

function subtotalByRate(document, rate) {
  return (document.lines || []).reduce((sum, line) => {
    if (Number(line.taxRatePercent || 0) !== rate) {
      return sum;
    }

    return sum + Number(line.netSubtotal || 0);
  }, 0);
}

function additionalRows(document) {
  return [
    document.description ? ["Descripcion", document.description] : null,
    document.reference ? ["Referencia", document.reference] : null,
    document.company?.ruc ? ["RUC Proveedor", document.company.ruc] : null
  ].filter(Boolean);
}

export function printInvoiceDocument() {
  window.requestAnimationFrame(() => window.print());
}

function AccessKeyBarcode({ value }) {
  const normalized = String(value || "").replace(/\D/g, "");

  if (!normalized) {
    return <div className="h-16 bg-white text-center text-xs leading-[4rem] text-slate-500">Sin clave de acceso</div>;
  }

  const pattern = Array.from(normalized).flatMap((digit, index) => {
    const base = Number(digit);
    return [
      { black: true, width: 1 + ((base + index) % 4) },
      { black: false, width: 1 + ((base + index * 2) % 3) }
    ];
  });
  const totalUnits = pattern.reduce((sum, bar) => sum + bar.width, 0);
  let cursor = 0;

  return (
    <svg aria-hidden="true" className="h-16 w-full bg-white" preserveAspectRatio="none" viewBox="0 0 520 64">
      {pattern.map((bar, index) => {
        const width = (bar.width / totalUnits) * 520;
        const rect = bar.black ? (
          <rect height="64" key={`${index}-${cursor}`} width={Math.max(1, width)} x={cursor} y="0" />
        ) : null;

        cursor += width;
        return rect;
      })}
    </svg>
  );
}

export default function InvoicePrintSheet({ document }) {
  const company = document.company || {};
  const branch = document.branch || {};
  const customer = document.customer || {};
  const payment = document.payments?.[0];
  const accessKey = document.sriAccessKey || document.sriAuthorizationNumber || "";
  const authorizationNumber = document.sriAuthorizationNumber || accessKey || "-";
  const authorizationDate = document.sriAuthorizationDate || document.sriGeneratedAt || document.createdAt;
  const subtotal15 = subtotalByRate(document, 15);
  const subtotal5 = subtotalByRate(document, 5);
  const subtotal0 = subtotalByRate(document, 0);
  const additional = additionalRows(document);

  return (
    <article className="invoice-print-area mx-auto bg-white p-4 text-black shadow-sm">
      <header className="grid gap-5 md:grid-cols-[45%_1fr]">
        <div className="flex min-h-28 flex-col justify-end gap-5">
          <div className="w-fit rounded-sm bg-emerald-600 px-2 py-1 text-sm font-black italic text-white">
            {company.tradeName || company.legalName || "ERP"}
          </div>

          <section className="bg-[#e9e9e9] p-3 text-[13px] leading-tight">
            <p><strong>Emisor:</strong> {company.legalName || company.tradeName || "-"}</p>
            <p><strong>RUC:</strong> {company.ruc || "-"}</p>
            <p><strong>Matriz:</strong> {company.mainAddress || branch.address || "-"}</p>
            <p><strong>Correo:</strong> {company.email || "-"}</p>
            <p><strong>Telefono:</strong> {company.phone || "-"}</p>
            <p>
              <strong>Obligado a llevar contabilidad:</strong> {company.accountingRequired ? "SI" : "NO"}
            </p>
          </section>
        </div>

        <section>
          <div className="mb-2 grid grid-cols-[1fr_auto] items-start gap-3">
            <h1 className="text-base font-bold tracking-normal">{documentTitle(document)}</h1>
            <p className="text-base font-bold">No.{document.documentNumber || "-"}</p>
          </div>

          <div className="bg-[#e9e9e9] p-3 text-[13px] leading-tight">
            <p className="text-sm font-bold">Numero de Autorizacion:</p>
            <p className="mb-4 break-all">{authorizationNumber}</p>

            <p className="text-sm font-bold">Fecha y hora de Autorizacion:</p>
            <p className="mb-4">{dateTimeText(authorizationDate) || "-"}</p>

            <p><strong>Ambiente:</strong> {environmentLabel(company.sriEnvironment)}</p>
            <p><strong>Emision:</strong> NORMAL</p>
            <p className="font-bold">Clave de Acceso:</p>
            <AccessKeyBarcode value={accessKey} />
            <p className="break-all text-[11px]">{accessKey || "-"}</p>
          </div>
        </section>
      </header>

      <section className="mt-1 grid gap-3 bg-[#e9e9e9] p-3 text-[13px] leading-tight md:grid-cols-[1.4fr_1fr]">
        <div>
          <p><strong>Razon Social:</strong> {customer.nombre || "-"}</p>
          <p><strong>Direccion:</strong> {customer.direccion || "-"}</p>
          <p><strong>Fecha Emision:</strong> {dateText(document.issueDate)}</p>
        </div>
        <div>
          <p><strong>RUC/CI:</strong> {customer.identificacion || "-"}</p>
          <p><strong>Telefono:</strong> {customer.telefono || "-"}</p>
          <p className="break-all"><strong>Correo:</strong> {customer.email || "-"}</p>
        </div>
      </section>

      <section className="mt-4 overflow-hidden text-[12px]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#e9e9e9] text-center font-bold">
              <th className="px-2 py-2">Codigo<br />Principal</th>
              <th className="px-2 py-2">Cantidad</th>
              <th className="px-2 py-2">Descripcion</th>
              <th className="px-2 py-2">Detalles<br />Adicionales</th>
              <th className="px-2 py-2">Precio<br />Unitario</th>
              <th className="px-2 py-2">Descuento</th>
              <th className="px-2 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {(document.lines || []).map((line) => (
              <tr className="border-b-2 border-white bg-[#f5f5f5] align-top" key={line.id}>
                <td className="px-2 py-2">{line.catalogItem?.internalCode || "-"}</td>
                <td className="px-2 py-2 text-right">{quantity(line.quantity)}</td>
                <td className="px-2 py-2">{line.catalogItem?.name || "Producto"}</td>
                <td className="px-2 py-2">
                  {line.catalogItem?.description ? (
                    <>
                      <span>Detalle:</span>
                      <br />
                      <span>{line.catalogItem.description}</span>
                    </>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-2 py-2 text-right">{Number(line.unitPrice || 0).toFixed(3)}</td>
                <td className="px-2 py-2 text-right">${money(line.discountAmount)}</td>
                <td className="px-2 py-2 text-right">${money(line.netSubtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-5 grid gap-5 md:grid-cols-[58%_1fr]">
        <div className="text-[13px] leading-tight">
          <div className="bg-[#e9e9e9] px-3 py-2 font-bold">Informacion Adicional</div>
          <div className="min-h-20 bg-[#f5f5f5] px-3 py-4">
            {additional.length ? (
              additional.map(([label, value]) => (
                <div className="grid grid-cols-[150px_1fr] gap-2" key={label}>
                  <span>{label}</span>
                  <span>{value}</span>
                </div>
              ))
            ) : (
              <p>Sin informacion adicional</p>
            )}
          </div>

          <div className="mt-4 bg-[#e9e9e9] px-3 py-2 font-bold">Formas de pago</div>
          <div className="grid min-h-20 grid-cols-[1fr_120px_70px] gap-3 bg-[#f5f5f5] px-3 py-4">
            <span>{payment?.paymentMethod?.name || "Sin forma de pago"}</span>
            <span className="text-right">${money(payment?.amount || document.total)}</span>
            <span className="text-right">0 dias</span>
          </div>
        </div>

        <div className="text-[13px] leading-tight">
          <TotalRow label="Subtotal Sin Impuestos" value={document.taxableSubtotal} />
          <TotalRow label="Subtotal 15%" value={subtotal15} />
          <TotalRow label="Subtotal 5%" value={subtotal5} />
          <TotalRow label="Subtotal 0%" value={subtotal0} />
          <TotalRow label="Subtotal No Objeto IVA" value={0} />
          <TotalRow label="Descuentos" value={document.discountTotal} />
          <TotalRow label="ICE" value={0} />
          <TotalRow label="IVA 15%" value={subtotal15 * 0.15} />
          <TotalRow label="IVA 5%" value={subtotal5 * 0.05} />
          <TotalRow label="Servicio %" value={0} />
          <TotalRow label="Valor Total" value={document.total} />
        </div>
      </section>
    </article>
  );
}

function TotalRow({ label, value }) {
  return (
    <div className="grid grid-cols-[1.2fr_.8fr] border-b-2 border-white">
      <span className="bg-[#f5f5f5] px-3 py-1">{label}:</span>
      <span className="bg-[#e9e9e9] px-3 py-1 text-right">${money(value)}</span>
    </div>
  );
}
