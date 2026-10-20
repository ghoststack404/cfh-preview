export default function RootLoading() {
  return (
    <div className="w-full min-h-screen bg-slate-50/60 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Hero Skeleton */}
      <div className="flex flex-col lg:flex-row gap-10 items-center justify-between mb-16 pt-8">
        <div className="flex-1 space-y-5">
          <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse" />
          <div className="h-14 w-4/5 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
          <div className="h-5 w-3/4 bg-slate-200/70 dark:bg-slate-800/70 rounded-xl animate-pulse" />
          <div className="flex gap-4 pt-4">
            <div className="h-12 w-44 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
            <div className="h-12 w-40 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
          </div>
        </div>
        <div className="w-full lg:w-[420px] h-80 bg-slate-200 dark:bg-slate-800 rounded-3xl animate-pulse" />
      </div>

      {/* Cards Skeleton Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-64 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-sm"
          >
            <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
              <div className="h-4 w-full bg-slate-100 dark:bg-slate-800/60 rounded-lg animate-pulse" />
            </div>
            <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
