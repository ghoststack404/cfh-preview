"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Globe,
  Award,
  BookOpen,
  Heart,
  MessageSquare,
  Share2,
  Flag,
  MoreHorizontal,
  Check,
  X,
  User as UserIcon,
  Sparkles,
  Target,
  ExternalLink,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { toggleLike, reportPost } from "@/app/actions/community";
import { PostMediaMasonry } from "./PostMediaMasonry";

interface PublicUser {
  id: string;
  name: string;
  role: "STUDENT" | "COACH" | "ADMIN";
  avatarUrl: string | null;
  region: string;
  countryCode: string | null;
  interests: any;
  goals: string | null;
  createdAt: string | Date;
  coachProfile: {
    id: string;
    slug: string;
    headline: string | null;
    biography: string | null;
    currentTier: string;
    approvalStatus: string;
    coachPhotoUrl: string | null;
  } | null;
  stats: {
    totalPosts: number;
    totalComments: number;
    totalLikesReceived: number;
  };
}

interface UserProfileClientProps {
  user: PublicUser;
  initialPosts: any[];
  isCurrentUser: boolean;
}

const REGION_LABELS: Record<string, { name: string; flag: string }> = {
  LATAM: { name: "América Latina", flag: "🌎" },
  NORTH_AMERICA: { name: "Norteamérica", flag: "🌎" },
  EUROPE: { name: "Europa", flag: "🌍" },
  ASIA: { name: "Asia", flag: "🌏" },
  AFRICA: { name: "África", flag: "🌍" },
  OCEANIA: { name: "Oceanía", flag: "🌏" },
  OTHER: { name: "Global", flag: "🌐" },
};

export default function UserProfileClient({
  user,
  initialPosts,
  isCurrentUser,
}: UserProfileClientProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Dropdown menu & reporting state
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const [reportingPost, setReportingPost] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState("Spam o publicidad no deseada");
  const [reportDetails, setReportDetails] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  const [copiedProfile, setCopiedProfile] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // Close menus on outside click or escape
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuPostId(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenuPostId(null);
        if (!isSubmittingReport) setReportingPost(null);
        setEnlargedImage(null);
      }
    };
    window.addEventListener("click", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSubmittingReport]);

  const timeAgo = (date: string | Date) => {
    const diff = Math.max(0, Date.now() - new Date(date).getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Ahora";
    if (mins === 1) return "Hace 1 min";
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours === 1) return "Hace 1 h";
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Hace 1 d";
    if (days < 7) return `Hace ${days} d`;
    return new Date(date).toLocaleDateString("es", { day: "numeric", month: "short" });
  };

  const handleToggleLike = async (postId: string) => {
    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost || (targetPost as any).isLiking) return;

    const wasLiked = targetPost.hasLiked;
    const nextLiked = !wasLiked;
    let nextLikesCount = targetPost._count.likes;
    if (wasLiked) {
      nextLikesCount = Math.max(0, nextLikesCount - 1);
    } else {
      nextLikesCount = nextLikesCount + 1;
    }

    setPosts((current) =>
      current.map((p) =>
        p.id === postId
          ? {
              ...p,
              hasLiked: nextLiked,
              isLiking: true,
              _count: { ...p._count, likes: nextLikesCount },
            }
          : p
      )
    );

    const res = await toggleLike(postId);
    if (!res.success && res.error?.includes("iniciar sesión")) {
      setShowAuthModal(true);
      setPosts((current) => current.map((p) => (p.id === postId ? { ...targetPost, isLiking: false } : p)));
      return;
    }

    if (res.success) {
      setPosts((current) =>
        current.map((p) =>
          p.id === postId
            ? { ...p, hasLiked: res.liked, isLiking: false }
            : p
        )
      );
    } else {
      setPosts((current) => current.map((p) => (p.id === postId ? { ...targetPost, isLiking: false } : p)));
    }
  };

  const handleSubmitReport = async () => {
    if (!reportingPost) return;
    setIsSubmittingReport(true);
    setReportFeedback(null);

    try {
      const res = await reportPost(reportingPost.id, reportReason, reportDetails);
      if (!res.success) {
        if (res.error?.includes("iniciar sesión")) {
          setReportingPost(null);
          setShowAuthModal(true);
          return;
        }
        setReportFeedback({ type: "error", message: res.error || "Error al procesar el reporte." });
        return;
      }

      setReportFeedback({
        type: "success",
        message: res.message || "Tu reporte ha sido enviado y será revisado por el equipo.",
      });
    } catch (error) {
      setReportFeedback({ type: "error", message: "Ocurrió un error inesperado al enviar el reporte." });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleCopyProfileLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedProfile(true);
      setTimeout(() => setCopiedProfile(false), 2500);
    }
  };

  const regionInfo = REGION_LABELS[user.region] || { name: user.region, flag: "🌐" };
  const memberDate = new Date(user.createdAt);
  const formattedMemberDate = memberDate.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  // Parse interests
  const interestsList: string[] = Array.isArray(user.interests)
    ? user.interests
    : typeof user.interests === "string"
    ? JSON.parse(user.interests || "[]")
    : [];

  const roleLabel =
    user.role === "COACH"
      ? "Coach"
      : user.role === "ADMIN"
      ? "Administrador"
      : "Aprendiz";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#061528] pt-28 pb-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Link & Action Bar */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/comunidad"
            className="inline-flex items-center text-sm font-semibold text-gray-600 dark:text-slate-300 hover:text-cfh-light-green transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a la comunidad
          </Link>

          <button
            onClick={handleCopyProfileLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:border-cfh-light-green transition-all shadow-sm"
          >
            {copiedProfile ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500">¡Enlace copiado!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Compartir perfil</span>
              </>
            )}
          </button>
        </div>

        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden mb-8"
        >
          {/* Cover Header */}
          <div className="h-36 sm:h-44 bg-gradient-to-r from-teal-700 via-cfh-dark-green to-slate-900 relative">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#00D4B2_1px,transparent_1px)] [background-size:16px_16px]" />
          </div>

          {/* User Info Header */}
          <div className="px-6 sm:px-8 pb-8 relative">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-16 sm:-mt-20 gap-4 mb-6">
              {/* Avatar & Basic Info */}
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
                <img
                  src={
                    user.avatarUrl ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      user.name
                    )}&background=008080&color=fff&size=200`
                  }
                  alt={user.name}
                  className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl border-4 border-white dark:border-slate-900 object-cover shadow-xl bg-white shrink-0"
                />

                <div className="sm:pb-2">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mb-1">
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                      {user.name}
                    </h1>

                    <span
                      className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                        user.role === "COACH"
                          ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
                          : user.role === "ADMIN"
                          ? "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300"
                          : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                      }`}
                    >
                      {user.role === "COACH" ? (
                        <Award className="w-3.5 h-3.5" />
                      ) : user.role === "ADMIN" ? (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      ) : (
                        <BookOpen className="w-3.5 h-3.5" />
                      )}
                      {roleLabel}
                    </span>
                  </div>

                  {user.coachProfile?.headline && (
                    <p className="text-sm font-medium text-cfh-light-green dark:text-cfh-light-green mb-2">
                      {user.coachProfile.headline}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-gray-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-gray-400" />
                      {regionInfo.flag} {regionInfo.name}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      Miembro desde {formattedMemberDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action: Link to Coach Profile if applicable */}
              {user.coachProfile && user.coachProfile.approvalStatus === "APPROVED" && (
                <div className="sm:pb-2 flex justify-center sm:justify-end">
                  <Link
                    href={`/coaches/${user.coachProfile.slug || user.coachProfile.id}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-cfh-dark-green hover:bg-[#061528] text-white text-sm font-bold shadow-md transition-colors"
                  >
                    <span>Ver perfil de Coach</span>
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>

            {/* Metrics Bar */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-100 dark:border-slate-800/80 text-center">
              <div>
                <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
                  {user.stats.totalPosts}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                  Publicaciones
                </p>
              </div>
              <div className="border-x border-gray-200 dark:border-slate-700">
                <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
                  {user.stats.totalComments}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                  Comentarios
                </p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
                  {user.stats.totalLikesReceived}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                  Me gusta recibidos
                </p>
              </div>
            </div>

            {/* About & Interests */}
            {((user.role !== "COACH" && (user.goals || interestsList.length > 0)) || user.coachProfile?.biography) && (
              <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800 space-y-4">
                {user.coachProfile?.biography && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1.5">
                      Acerca de mí
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere] max-h-56 overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar">
                      {user.coachProfile.biography}
                    </p>
                  </div>
                )}

                {user.role !== "COACH" && user.goals && (
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5 mb-1.5">
                        <Target className="w-4 h-4 text-cfh-light-green shrink-0" />
                        Metas de aprendizaje
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere] max-h-48 overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar">
                        {user.goals}
                      </p>
                    </div>
                  )}

                  {user.role !== "COACH" && interestsList.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5 mb-2">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        Áreas de interés
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {interestsList.map((interest, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>
        </motion.div>

        {/* User's Posts Section */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-cfh-light-green" />
            Publicaciones de {user.name.split(" ")[0]}
          </h2>
          <span className="text-xs text-gray-500 dark:text-slate-400 font-semibold">
            {posts.length} {posts.length === 1 ? "publicación" : "publicaciones"}
          </span>
        </div>

        <div className="flex flex-col gap-4">
          {posts.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm p-6">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-400 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="text-base font-bold text-gray-800 dark:text-slate-200 mb-1">
                Aún no hay publicaciones
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto">
                Este miembro todavía no ha compartido mensajes en la comunidad.
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={post.id}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-800"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-3 items-center">
                    <img
                      src={
                        user.avatarUrl ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          user.name
                        )}&background=random`
                      }
                      alt={user.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-gray-900 dark:text-slate-100">
                          {user.name}
                        </h4>
                        <span
                          className={`text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                            (post.authorRole || user.role) === "COACH"
                              ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/40"
                              : (post.authorRole || user.role) === "ADMIN"
                              ? "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/60 dark:border-purple-800/40"
                              : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/40"
                          }`}
                        >
                          {(post.authorRole || user.role) === "COACH"
                            ? "Coach"
                            : (post.authorRole || user.role) === "ADMIN"
                            ? "Admin"
                            : "Aprendiz"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {timeAgo(post.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 text-xs font-bold rounded-full">
                      {post.postType === "DOUBT"
                        ? "Dudas"
                        : post.postType === "EXPERIENCE"
                        ? "Experiencias"
                        : post.postType === "ANNOUNCEMENT"
                        ? "Anuncios"
                        : "General"}
                    </span>

                    {/* 3-dots Dropdown Menu */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuPostId(openMenuPostId === post.id ? null : post.id);
                        }}
                        className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="Opciones de publicación"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>

                      <AnimatePresence>
                        {openMenuPostId === post.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -5 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 mt-1 w-52 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 py-1.5 z-20"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (typeof window !== "undefined") {
                                  navigator.clipboard.writeText(
                                    `${window.location.origin}/comunidad#post-${post.id}`
                                  );
                                }
                                setCopiedPostId(post.id);
                                setTimeout(() => setCopiedPostId(null), 2500);
                                setOpenMenuPostId(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors text-left"
                            >
                              {copiedPostId === post.id ? (
                                <>
                                  <Check className="w-4 h-4 text-emerald-500" />
                                  <span className="text-emerald-500 font-medium">
                                    ¡Enlace copiado!
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Share2 className="w-4 h-4 text-gray-400" />
                                  <span>Copiar enlace</span>
                                </>
                              )}
                            </button>

                            <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />

                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuPostId(null);
                                setReportReason("Spam o publicidad no deseada");
                                setReportDetails("");
                                setReportFeedback(null);
                                setReportingPost(post);
                              }}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-medium text-left"
                            >
                              <Flag className="w-4 h-4" />
                              <span>Reportar publicación</span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <h3 className="font-bold text-lg text-gray-900 dark:text-slate-100 mb-2">
                  {post.title}
                </h3>
                <p className="text-gray-600 dark:text-slate-300 whitespace-pre-wrap mb-4 text-sm sm:text-base">
                  {post.content}
                </p>

                <PostMediaMasonry
                  images={
                    Array.isArray(post.images) && post.images.length > 0
                      ? (post.images as string[])
                      : post.imageUrl
                      ? [post.imageUrl]
                      : []
                  }
                  onOpenLightbox={(imgs, idx) => setEnlargedImage(imgs[idx] || null)}
                />

                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.tags.map((tag: string, i: number) => (
                      <Link
                        key={i}
                        href={`/comunidad?tag=${encodeURIComponent(tag)}`}
                        className="px-2.5 py-1 bg-cfh-light-green/10 text-cfh-dark-green dark:text-cfh-light-green hover:bg-cfh-light-green/25 text-xs font-semibold rounded-md transition-colors"
                        title={`Ver publicaciones con el tema ${tag}`}
                      >
                        {tag}
                      </Link>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                  <button 
                    type="button"
                    disabled={(post as any).isLiking}
                    onClick={() => handleToggleLike(post.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors text-sm font-bold ${
                      post.hasLiked 
                        ? "bg-red-50 dark:bg-red-900/20 text-red-500" 
                        : "hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-500 hover:text-red-500"
                    } ${(post as any).isLiking ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <Heart className={`w-4 h-4 ${post.hasLiked ? "fill-current" : ""}`} />
                    <span>{post._count.likes}</span>
                  </button>
                  <Link
                    href={`/comunidad#post-${post.id}`}
                    className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-cfh-light-green transition-colors"
                    title="Ver publicación y comentarios en la comunidad"
                  >
                    <MessageSquare className="w-5 h-5" />
                    {post._count.comments}
                  </Link>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowAuthModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 text-cfh-dark-green dark:text-cfh-light-green rounded-2xl flex items-center justify-center mx-auto mb-6">
                <UserIcon className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-center text-gray-900 dark:text-slate-100 mb-2">
                Inicia sesión para participar
              </h3>
              <p className="text-gray-500 dark:text-slate-400 text-center mb-8 text-sm">
                Inicia sesión para poder interactuar y reportar publicaciones en la comunidad.
              </p>
              <Link
                href="/?auth=login"
                className="block w-full py-3 px-4 bg-cfh-dark-green text-white text-center font-bold rounded-2xl hover:bg-[#061528] transition-colors"
              >
                Ir al Inicio de Sesión
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {reportingPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => !isSubmittingReport && setReportingPost(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-slate-800 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setReportingPost(null)}
                disabled={isSubmittingReport}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>

              {reportFeedback?.type === "success" ? (
                <div className="py-6 text-center">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Reporte enviado
                  </h3>
                  <p className="text-gray-500 dark:text-slate-400 text-sm max-w-sm mx-auto mb-6">
                    {reportFeedback.message}
                  </p>
                  <button
                    onClick={() => setReportingPost(null)}
                    className="px-6 py-2.5 bg-cfh-dark-green text-white font-bold rounded-2xl hover:bg-[#061528] transition-colors"
                  >
                    Entendido
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center">
                      <Flag className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        Reportar publicación
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Publicado por{" "}
                        <span className="font-semibold text-gray-700 dark:text-slate-300">
                          {user.name}
                        </span>
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                    Ayúdanos a mantener la comunidad segura. Selecciona el motivo del reporte:
                  </p>

                  {reportFeedback?.type === "error" && (
                    <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{reportFeedback.message}</span>
                    </div>
                  )}

                  <div className="space-y-2 mb-4">
                    {[
                      "Spam o publicidad no deseada",
                      "Acoso, insultos o agresión",
                      "Contenido inapropiado o explícito",
                      "Desinformación o fraude",
                      "Otro motivo",
                    ].map((reason) => (
                      <label
                        key={reason}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          reportReason === reason
                            ? "border-cfh-light-green bg-cfh-light-green/10 text-gray-900 dark:text-white font-semibold"
                            : "border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="profileReportReason"
                          value={reason}
                          checked={reportReason === reason}
                          onChange={(e) => setReportReason(e.target.value)}
                          className="accent-cfh-light-green w-4 h-4"
                        />
                        <span className="text-sm">{reason}</span>
                      </label>
                    ))}
                  </div>

                  <div className="mb-6">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                      Detalles adicionales (opcional)
                    </label>
                    <textarea
                      rows={3}
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      placeholder="Explica brevemente por qué reportas esta publicación..."
                      className="w-full text-sm p-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cfh-light-green resize-none"
                    />
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => setReportingPost(null)}
                      disabled={isSubmittingReport}
                      className="px-5 py-2.5 rounded-2xl text-sm font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitReport}
                      disabled={isSubmittingReport}
                      className="px-6 py-2.5 rounded-2xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      {isSubmittingReport ? (
                        "Enviando..."
                      ) : (
                        <>
                          <Flag className="w-4 h-4" /> Enviar reporte
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Lightbox Modal */}
      <AnimatePresence>
        {enlargedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-8"
            onClick={() => setEnlargedImage(null)}
          >
            <div
              className="relative max-w-5xl max-h-[90vh] flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setEnlargedImage(null)}
                className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                title="Cerrar imagen"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={enlargedImage}
                alt="Imagen ampliada"
                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
