export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-48 bg-surface-container-high rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-surface-container-lowest rounded-2xl shadow-ambient p-5 space-y-3">
            <div className="h-3 w-20 bg-surface-container-high rounded" />
            <div className="h-6 w-28 bg-surface-container-high rounded" />
          </div>
        ))}
      </div>
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 h-64" />
    </div>
  )
}
