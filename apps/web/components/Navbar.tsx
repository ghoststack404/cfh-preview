import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20 sm:h-24">
          
          {/* Logo Section */}
          <div className="flex-shrink-0 flex items-center gap-3 cursor-pointer">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-cfh-sage flex items-center justify-center shadow-lg shadow-cfh-sage/30">
              <span className="text-white font-black text-2xl tracking-tighter">CFH</span>
            </div>
            <span className="font-black text-2xl sm:text-3xl text-cfh-slate tracking-tight">
              Coaching<span className="text-cfh-sage">FromHome</span>
            </span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="#how-it-works" className="text-base font-semibold text-gray-700 hover:text-cfh-sage transition-colors">
              ¿Cómo funciona?
            </Link>
            <Link href="#pricing" className="text-base font-semibold text-gray-700 hover:text-cfh-sage transition-colors">
              Precios
            </Link>
            <Link href="#coaches" className="text-base font-semibold text-gray-700 hover:text-cfh-sage transition-colors">
              Nuestros Coaches
            </Link>
          </div>

          {/* Action Buttons & Language */}
          <div className="flex items-center gap-4">
            {/* Language Selector (Placeholder for i18n) */}
            <div className="hidden sm:flex items-center gap-1 text-base font-medium text-gray-600 cursor-pointer hover:text-cfh-slate transition-colors bg-gray-50 px-3.5 py-2 rounded-full border border-gray-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
              <span>ES</span>
            </div>

            <Link href="/login" className="text-base font-bold text-cfh-slate hover:text-cfh-sage transition-colors">
              Iniciar Sesión
            </Link>
            <Link href="/register" className="hidden sm:inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-base font-bold rounded-full text-white bg-cfh-coral hover:bg-[#d66b50] shadow-lg shadow-cfh-coral/30 hover:shadow-cfh-coral/50 transition-all duration-300 transform hover:-translate-y-0.5">
              Únete como Coach
            </Link>
          </div>
          
        </div>
      </div>
    </nav>
  );
}
