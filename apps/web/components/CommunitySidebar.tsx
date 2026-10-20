"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Hash, ChevronRight, Flame, ShieldCheck, Sparkles, CheckCircle2, Heart, Lock, MessageSquare, Bookmark } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "./TranslationProvider";

interface CommunitySidebarProps {
  sidebarData: any;
  selectedTag?: string | null;
  onSelectTag?: (tag: string) => void;
  onClearTag?: () => void;
  onSelectMyPosts?: () => void;
  onSelectSaved?: () => void;
  isMyPostsActive?: boolean;
  isSavedActive?: boolean;
  savedCount?: number;
  myPostsCount?: number;
}

export function CommunitySidebar({ 
  sidebarData, 
  selectedTag, 
  onSelectTag,
  onClearTag,
  onSelectMyPosts,
  onSelectSaved,
  isMyPostsActive = false,
  isSavedActive = false,
  savedCount = 0,
  myPostsCount = 0,
}: CommunitySidebarProps) {
  const { t } = useTranslation();

  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");

  const popularTags = sidebarData?.popularTags?.length > 0 
    ? sidebarData.popularTags 
    : ["#Programación", "#Frontend", "#IA", "#Coaching", "#DiseñoUI", "#CursosOnline"];

  const activeMembers = sidebarData?.activeMembers || [];
  const onlineCount = activeMembers.filter((m: any) => m.isOnline).length;
  const offlineCount = activeMembers.filter((m: any) => !m.isOnline).length;

  const displayMembers = activeMembers.filter((m: any) => {
    if (statusFilter === "online") return m.isOnline;
    if (statusFilter === "offline") return !m.isOnline;
    return true;
  });

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Temas en Tendencia */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-gray-200/80 dark:border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-sm shadow-slate-200/50 dark:shadow-none"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-extrabold text-sm sm:text-base text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-500 dark:bg-amber-500/15">
              <Flame className="w-4 h-4" />
            </span>{t("Community.trending_topics", "Temas en tendencia")}</h3>
          {Boolean(selectedTag) && (
            <button
              type="button"
              onClick={() => {
                if (onClearTag) {
                  onClearTag();
                } else if (onSelectTag && selectedTag) {
                  onSelectTag(selectedTag);
                }
              }}
              className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 font-bold transition-colors cursor-pointer hover:underline"
            >
              Limpiar filtro
            </button>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2">
          {popularTags.map((tag: string, i: number) => {
            const cleanTag = tag.replace(/^#/, "").trim();
            const cleanSelected = selectedTag ? selectedTag.replace(/^#/, "").trim() : null;
            const isSelected = cleanSelected !== null && cleanSelected.toLowerCase() === cleanTag.toLowerCase();
            const isHot = i < 2;
            return (
              <button 
                key={i} 
                type="button" 
                onClick={() => {
                  if (isSelected && onClearTag) {
                    onClearTag();
                  } else {
                    onSelectTag?.(tag);
                  }
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/25 ring-2 ring-emerald-400 scale-105"
                    : "bg-slate-100/80 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:hover:text-emerald-400 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 hover:scale-[1.02]"
                }`}
              >
                {isHot && !isSelected && <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                <span>{tag.startsWith("#") ? tag : `#${tag}`}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* 2. Miembros de la Comunidad: Conectados y Desconectados */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-gray-200/80 dark:border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-sm shadow-slate-200/50 dark:shadow-none"
      >
        {/* Cabecera del Widget */}
        <div className="flex justify-between items-center mb-3.5">
          <h3 className="font-extrabold text-sm sm:text-base text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/15">
              <Users className="w-4 h-4" />
            </span>{t("Community.active_community", "Comunidad activa")}</h3>
          <span className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full transition-colors ${
            onlineCount > 0
              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20"
              : "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${onlineCount > 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
            {onlineCount > 0 ? `${onlineCount} en vivo` : "0 en vivo"}
          </span>
        </div>

        {/* Píldoras de Filtro: Todos | En línea | Desconectados */}
        <div className="flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-800/70 rounded-2xl mb-3 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`flex-1 py-1 px-1.5 rounded-xl transition-all cursor-pointer text-center whitespace-nowrap ${
              statusFilter === "all"
                ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-2xs font-extrabold"
                : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
            }`}
          >{t("Community.all", "Todos")} ({activeMembers.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("online")}
            className={`flex-1 py-1 px-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
              statusFilter === "online"
                ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs font-extrabold"
                : "text-gray-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>En línea ({onlineCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("offline")}
            className={`flex-1 py-1 px-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
              statusFilter === "offline"
                ? "bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 shadow-2xs font-extrabold"
                : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" />
            <span>{t("Community.offline", "Fuera")} ({offlineCount})</span>
          </button>
        </div>
        
        {/* Lista de Miembros con Indicador Real de Conectado / Desconectado */}
        {displayMembers.length > 0 ? (
          <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto scrollbar-thin pr-0.5">
            {displayMembers.map((member: any) => (
              <Link 
                key={member.id} 
                href={`/comunidad/perfil/${member.id}`}
                className="flex items-center gap-3 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group"
              >
                {/* Avatar con punto Verde (Online) o Gris (Offline) */}
                <div className="relative shrink-0">
                  <img 
                    src={member.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=047857&color=fff`} 
                    alt={member.name} 
                    className={`w-9 h-9 rounded-full object-cover ring-2 transition-all ${
                      member.isOnline ? "ring-emerald-500/40 group-hover:ring-emerald-500" : "ring-transparent group-hover:ring-slate-400"
                    }`}
                  />
                  <span 
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                      member.isOnline 
                        ? "bg-emerald-500 shadow-xs animate-pulse" 
                        : "bg-slate-400 dark:bg-slate-600"
                    }`}
                    title={member.isOnline ? "En línea ahora" : "Desconectado"}
                  />
                </div>

                {/* Datos del Miembro */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5 mb-0.5">
                    <p className="text-xs font-bold text-gray-800 dark:text-slate-200 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {member.name}
                    </p>
                    {member.isOnline ? (
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded-full shrink-0 border border-emerald-500/20">
                        En línea
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.2 rounded-full shrink-0">
                        Desconectado
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">
                    {member.headline || (member.role === "COACH" ? "Coach CFH" : member.role === "ADMIN" ? "Equipo CFH" : "Aprendiz CFH")}
                  </p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 group-hover:text-emerald-500 transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-center">
            <Users className="w-6 h-6 text-slate-400 mb-2" />
            <p className="text-xs font-bold text-gray-700 dark:text-slate-300">
              {statusFilter === "online" ? "No hay otros miembros en línea" : t("Community.no_offline", "No hay miembros desconectados")}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {statusFilter === "online" ? "¡Sé el primero en iniciar una conversación!" : "Todos los miembros registrados están en línea"}
            </p>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
          <span>{t("Community.learn_with_others", "Aprende con otros hoy")}</span>
          <span className="font-extrabold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
            CFH Hub <Sparkles className="w-3 h-3" />
          </span>
        </div>
      </motion.div>

      {/* Accesos Directos */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-gray-200/80 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm shadow-slate-200/50 dark:shadow-none"
      >
        <h3 className="font-extrabold text-sm sm:text-base text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-4">
          <span className="p-1.5 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/15">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </span>
          Accesos Rápidos
        </h3>
        <div className="flex flex-col gap-2">
          <button 
            type="button"
            onClick={onSelectMyPosts}
            className={`flex items-center justify-between px-3 py-2.5 text-xs font-bold rounded-2xl transition-all cursor-pointer ${
              isMyPostsActive
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-600/25 scale-[1.02]"
                : "text-gray-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80"
            }`}
          >
            <div className="flex items-center gap-3">
              <MessageSquare className={`w-4 h-4 ${isMyPostsActive ? "text-white" : "text-emerald-500 dark:text-emerald-400"}`} />
              <span>{t("Community.my_posts", "Mis Publicaciones")}</span>
            </div>
            {typeof myPostsCount === "number" && myPostsCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                isMyPostsActive
                  ? "bg-white/25 text-white"
                  : "bg-slate-200/80 dark:bg-slate-800 text-gray-600 dark:text-slate-400"
              }`}>
                {myPostsCount}
              </span>
            )}
          </button>
          <button 
            type="button"
            onClick={onSelectSaved}
            className={`flex items-center justify-between px-3 py-2.5 text-xs font-bold rounded-2xl transition-all cursor-pointer ${
              isSavedActive
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-600/25 scale-[1.02]"
                : "text-gray-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80"
            }`}
          >
            <div className="flex items-center gap-3">
              <Bookmark className={`w-4 h-4 ${isSavedActive ? "text-white" : "text-emerald-500 dark:text-emerald-400"}`} />
              <span>{t("Community.saved", "Guardados")}</span>
            </div>
            {typeof savedCount === "number" && savedCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                isSavedActive
                  ? "bg-white/25 text-white"
                  : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
              }`}>
                {savedCount}
              </span>
            )}
          </button>
        </div>
      </motion.div>

      {/* Micro-footer con reglas y enlaces */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="px-4 py-2 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[11px] text-gray-400 dark:text-slate-500 font-medium"
      >
        <a href="#" className="hover:text-emerald-500 transition-colors">{t("Community.rules", "Reglas de la comunidad")}</a>
        <span>·</span>
        <a href="#" className="hover:text-emerald-500 transition-colors">{t("Community.help", "Ayuda")}</a>
        <span>·</span>
        <a href="#" className="hover:text-emerald-500 transition-colors">{t("Community.support", "Soporte")}</a>
        <div className="w-full text-center mt-2 opacity-70">© 2026 CoachingFromHome</div>
      </motion.div>
    </div>
  );
}

