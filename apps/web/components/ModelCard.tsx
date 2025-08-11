export default function ModelCard({ model }: { model: any }) {
  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <img src={model.images?.[0]} alt={model.name} className="w-full h-48 object-cover rounded-xl" />
      <h3 className="mt-3 text-xl font-semibold">{model.name}</h3>
      <p className="text-sm text-gray-500">{model.brand} • WLTP {model.rangeWLTP} km • {model.drivetrain}</p>
      <p className="mt-1 text-lg font-bold">€{Number(model.priceEUR ?? 0).toLocaleString()}</p>
    </div>
  );
}
