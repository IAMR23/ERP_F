export default function Metric({ label, value }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
    </section>
  );
}
