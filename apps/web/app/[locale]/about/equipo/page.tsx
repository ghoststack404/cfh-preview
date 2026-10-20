import type { Metadata } from "next";
import Link from "next/link";
import { Mail, ArrowRight, ShieldCheck, Code2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Conoce al Equipo | Coaching From Home",
  description: "El equipo detrás de Coaching From Home: fundadores, desarrolladores y coaches que hacen posible la plataforma.",
};

const TEAM_MEMBERS = [
  {
    name: "Santa Mónica",
    role: "Dirección General & Fundadores",
    bio: "Liderazgo y dirección de Coaching From Home. Encargados de la visión pedagógica, metodologías de coaching, desarrollo humano y la supervisión de los más altos estándares de calidad educativa y ética en la plataforma.",
    icon: ShieldCheck,
    iconBg: "bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 text-white shadow-emerald-500/20",
    badge: "Dirección",
    badgeColor: "bg-cfh-dark-green text-white",
    specialties: ["Coaching Ejecutivo", "Desarrollo Humano", "Calidad Educativa"],
  },
  {
    name: "Equipo de Desarrolladores",
    role: "Ingeniería de Software & Soporte Tecnológico",
    bio: "Equipo técnico multidisciplinario a cargo del diseño, arquitectura de software, rendimiento de videollamadas WebRTC, seguridad informática y el mantenimiento tecnológico continuo de la plataforma.",
    icon: Code2,
    iconBg: "bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-900 text-white shadow-blue-500/20",
    badge: "Desarrollo",
    badgeColor: "bg-blue-600 text-white",
    specialties: ["Desarrollo Web Full-Stack", "Infraestructura & Seguridad", "Arquitectura WebRTC"],
  },
];

const STATS = [
  { label: "Año de fundación", value: "2026" },
  { label: "País de origen", value: "México" },
  { label: "Disponible en", value: "LATAM" },
  { label: "Idiomas soportados", value: "5+" },
];

export default function EquipoPage() {
  return (
    <main className="bg-white dark:bg-slate-950 min-h-screen">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-cfh-dark-green text-white overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 25% 25%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.2) 0%, transparent 50%)" }}
        />
        <div className="max-w-4xl mx-auto px-6 py-24 text-center relative z-10">
          <span className="inline-block bg-white/15 text-white text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
            Conoce al Equipo
          </span>
          <h1 className="text-4xl sm:text-5xl font-black mb-6 leading-tight">
            Las personas detrás de<br className="hidden sm:block" /> Coaching From Home
          </h1>
          <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto leading-relaxed">
            Un equipo enfocado en transformar la forma en que las personas aprenden y 
            enseñan, combinando tecnología robusta con la calidez y el estándar del mejor coaching.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-cfh-dark-green/5 dark:bg-slate-900/60 border-b border-gray-100 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="text-2xl sm:text-3xl font-black text-cfh-dark-green dark:text-emerald-400">{s.value}</p>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Equipo */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-black text-gray-900 dark:text-slate-100">Estructura del Equipo</h2>
          <p className="text-gray-500 dark:text-slate-400 mt-3 text-base max-w-xl mx-auto">
            La dirección y el equipo técnico comprometidos con la excelencia de la plataforma.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-8">
          {TEAM_MEMBERS.map((member) => (
            <div
              key={member.name}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden hover:shadow-lg transition-shadow duration-300"
            >
              <div className="flex items-start gap-5 p-6">
                <div className="relative shrink-0">
                  <div className={`w-20 h-20 rounded-2xl ${member.iconBg} flex items-center justify-center shadow-lg border border-white/10`}>
                    <member.icon className="w-10 h-10 drop-shadow-md" />
                  </div>
                  <span className={`absolute -bottom-2 -right-2 text-xs font-black px-2 py-0.5 rounded-lg shadow ${member.badgeColor}`}>
                    {member.badge}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-black text-gray-900 dark:text-slate-100">{member.name}</h3>
                  <p className="text-sm font-semibold text-cfh-dark-green dark:text-emerald-400 mb-2">{member.role}</p>
                  <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">{member.bio}</p>
                </div>
              </div>
              <div className="px-6 pb-5">
                <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                  {member.specialties.map((s) => (
                    <span
                      key={s}
                      className="text-xs font-bold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-3 py-1 rounded-full"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
