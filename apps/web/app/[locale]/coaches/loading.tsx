export default function CoachesLoading() {
  return (
    <div className="w-full bg-slate-50/60 dark:bg-slate-950 min-h-screen py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div>
          <div className="h-7 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse mb-2" />
          <div className="h-4 w-72 max-w-full bg-slate-200/70 dark:bg-slate-800/70 rounded-lg animate-pulse" />
        </div>
        <div className="h-10 w-40 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Sidebar Filters Skeleton */}
        <div className="hidden lg:flex w-72 shrink-0 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-6 flex-col gap-6 shadow-sm">
          <div className="h-5 w-28 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse" />
                <div className="h-4 w-6 bg-slate-200/60 dark:bg-slate-800/60 rounded-md animate-pulse" />
              </div>
            ))}
          </div>
          <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />
          <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-8 w-full bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
        </div>

        {/* Coach Cards Skeleton List */}
        <div className="flex-1 w-full flex flex-col gap-5">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col lg:flex-row gap-6 items-start"
            >
              {/* Video Thumbnail Placeholder */}
              <div className="w-full lg:w-[260px] h-[160px] bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse shrink-0" />

              {/* Info Placeholder */}
              <div className="flex-1 w-full flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="h-6 w-44 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse mb-1.5" />
                    <div className="h-4 w-60 bg-slate-200/70 dark:bg-slate-800/70 rounded-lg animate-pulse" />
                  </div>
                  <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
                </div>
                <div className="h-4 w-4/5 bg-slate-100 dark:bg-slate-800/60 rounded-lg animate-pulse" />
                <div className="h-4 w-3/5 bg-slate-100 dark:bg-slate-800/60 rounded-lg animate-pulse" />
                <div className="flex gap-2 mt-2">
                  <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse" />
                  <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse" />
                  <div className="h-6 w-16 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse" />
                </div>
              </div>

              {/* CTA Placeholder */}
              <div className="w-full lg:w-40 flex flex-col gap-2.5 shrink-0 justify-end self-stretch border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-slate-800 pt-4 lg:pt-0 lg:pl-6">
                <div className="h-11 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
                <div className="h-10 w-full bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
