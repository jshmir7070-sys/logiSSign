export default function PortalLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div>
        <div className="h-7 w-48 bg-surface-container-high rounded-lg" />
        <div className="h-4 w-72 bg-surface-container-high rounded-lg mt-2" />
      </div>
      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-surface-container-lowest rounded-2xl shadow-ambient p-5 space-y-3">
            <div className="h-3 w-20 bg-surface-container-high rounded" />
            <div className="h-6 w-28 bg-surface-container-high rounded" />
          </div>
        ))}
      </div>
      {/* Content skeleton */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 h-64" />
    </div>
  )
}
