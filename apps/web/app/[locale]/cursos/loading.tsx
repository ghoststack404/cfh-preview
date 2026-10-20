export default function CursosLoading() {
  return (
    <div className="w-full bg-slate-50/60 dark:bg-slate-950 min-h-screen py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <div className="h-8 w-56 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse mb-2.5" />
          <div className="h-4 w-80 max-w-full bg-slate-200/70 dark:bg-slate-800/70 rounded-xl animate-pulse" />
        </div>
        <div className="h-11 w-44 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
      </div>

      {/* Category Pills Skeleton */}
      <div className="flex gap-2.5 overflow-hidden mb-8 py-1">
        {[80, 110, 95, 120, 100, 130].map((w, i) => (
          <div
            key={i}
            style={{ width: `${w}px` }}
            className="h-9 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse shrink-0"
          />
        ))}
      </div>

      {/* Course Cards Skeleton Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm flex flex-col"
          >
            {/* Thumbnail skeleton */}
            <div className="pt-[56.25%] bg-slate-200 dark:bg-slate-800 animate-pulse relative" />
            <div className="p-5 flex flex-col flex-1 gap-3">
              <div className="flex justify-between items-center">
                <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                <div className="h-4 w-12 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
              </div>
              <div className="h-5 w-4/5 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
              <div className="h-4 w-full bg-slate-100 dark:bg-slate-800/60 rounded-lg animate-pulse" />
              <div className="h-4 w-2/3 bg-slate-100 dark:bg-slate-800/60 rounded-lg animate-pulse" />
              <div className="mt-auto pt-4 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center">
                <div className="h-6 w-16 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
