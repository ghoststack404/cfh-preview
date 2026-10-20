"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Heart, 
  MessageSquare, 
  MoreHorizontal, 
  X, 
  User, 
  Share2, 
  Check, 
  Flag, 
  Send, 
  Bookmark, 
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Trash2,
  Lock,
  BarChart3,
  AtSign,
  BookOpen,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  toggleLike, 
  createComment, 
  deleteComment, 
  updateComment, 
  deletePost, 
  updatePost, 
  reportPost, 
  toggleCommentLike,
  markQuestionResolved,
  getSuspensionInfo,
  canUserCommentOnPost,
  votePollOption,
  toggleSavePost,
  getUserSavedPostIds
} from "@/app/actions/community";
import { validateCommunitySafety, canEditPostOrComment, parseCommunityMentions, type MentionedEntity } from "@/lib/communitySafety";
import FullScreenSuspensionScreen from "./FullScreenSuspensionScreen";
import type { SuspensionDetails } from "@/lib/communityStrikes";
import { parsePoll, getOptionVotes } from "./CommunityClient";
import { useAuthModal } from "@/context/AuthModalContext";

export default function PostDetailClient({ 
  post: initialPost, 
  currentUserId,
  suspensionDetails,
  initialIsSaved = false,
}: { 
  post: any; 
  currentUserId?: string;
  suspensionDetails?: SuspensionDetails | null;
  initialIsSaved?: boolean;
}) {
  const router = useRouter();
  const { openLogin } = useAuthModal();
  const [post, setPost] = useState(initialPost);
  const [comments, setComments] = useState(initialPost.comments || []);
  const [newComment, setNewComment] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [commentSafetyError, setCommentSafetyError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(initialIsSaved);

  useEffect(() => {
    if (!currentUserId || !post?.id) {
      setIsSaved(false);
      return;
    }
    getUserSavedPostIds().then((ids) => {
      if (Array.isArray(ids)) {
        setIsSaved(ids.includes(post.id));
      }
    });
  }, [currentUserId, post?.id]);

  const handleToggleSavePost = () => {
    if (!currentUserId) {
      openLogin();
      return;
    }

    const prev = isSaved;
    setIsSaved(!prev); // Optimistic UI update

    toggleSavePost(post.id).then((res) => {
      if (!res.success) {
        setIsSaved(prev); // Rollback
        if (res.requiresAuth) openLogin();
      }
    }).catch(() => {
      setIsSaved(prev); // Rollback on error
    });
  };

  const [activeSuspension, setActiveSuspension] = useState<SuspensionDetails | null>(suspensionDetails || null);
  const isSuspended = Boolean(activeSuspension?.isSuspended);

  const checkSuspensionResponse = async (res: any) => {
    if (res?.isSuspended) {
      const info = await getSuspensionInfo();
      if (info.isSuspended) {
        setActiveSuspension(info);
      }
    }
  };

  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostContent, setEditPostContent] = useState("");

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(null);

  const [openMenuPost, setOpenMenuPost] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [reportingPost, setReportingPost] = useState(false);
  const [reportReason, setReportReason] = useState("Spam o publicidad no deseada");
  const [reportDetails, setReportDetails] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pollVotes, setPollVotes] = useState<Record<string, number>>({});
  const mentionedEntity: MentionedEntity | null = post?.mentionedEntity || parseCommunityMentions(post?.tags);
  const [commentPermission, setCommentPermission] = useState<{ canComment: boolean; reason?: string } | null>(
    initialPost?.canComment !== undefined ? { canComment: initialPost.canComment, reason: initialPost.commentReason } : null
  );

  useEffect(() => {
    if (mentionedEntity && post?.id) {
      canUserCommentOnPost(post.id).then((res) => {
        setCommentPermission(res);
      });
    }
  }, [post?.id, mentionedEntity]);

  useEffect(() => {
    try {
      const storedVotes = localStorage.getItem("cfh_poll_votes");
      if (storedVotes) setPollVotes(JSON.parse(storedVotes));
    } catch (e) {}
  }, []);

  // Si el post tiene mención y el usuario no está verificado, purgar voto inválido
  useEffect(() => {
    if (mentionedEntity && commentPermission?.canComment === false && pollVotes[post.id] !== undefined) {
      setPollVotes((prev) => {
        const next = { ...prev };
        delete next[post.id];
        try {
          localStorage.setItem("cfh_poll_votes", JSON.stringify(next));
        } catch (e) {}
        return next;
      });
    }
  }, [mentionedEntity, commentPermission, post.id, pollVotes]);

  const handleVotePoll = async (postId: string, optionIndex: number) => {
    if (!currentUserId) {
      openLogin();
      return;
    }
    if (isSuspended) {
      setCommentSafetyError("Acción no permitida: Tu cuenta se encuentra suspendida temporalmente.");
      return;
    }
    if (mentionedEntity) {
      const perm = commentPermission ?? await canUserCommentOnPost(postId);
      if (!perm.canComment) {
        setCommentSafetyError(perm.reason || "🔒 Respuestas reservadas: Solo los estudiantes que han tomado clases o cursos con la persona o curso consultado pueden responder o votar.");
        return;
      }
    }
    const res = await votePollOption(postId, optionIndex);
    if (!res.success) {
      setCommentSafetyError(res.error || "No fue posible registrar tu voto.");
      return;
    }
    setPollVotes((prev) => {
      const next = { ...prev, [postId]: optionIndex };
      try {
        localStorage.setItem("cfh_poll_votes", JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  // Like animation
  const [likeAnimation, setLikeAnimation] = useState(false);

  const [isLiking, setIsLiking] = useState(false);

  const handleToggleLike = async () => {
    if (!currentUserId) {
      openLogin();
      return;
    }
    if (isSuspended || isLiking) return;
    setIsLiking(true);
    setLikeAnimation(true);
    setTimeout(() => setLikeAnimation(false), 600);

    const wasLiked = post.hasLiked;
    const nextLiked = !wasLiked;
    let nextLikesCount = post._count.likes;
    if (wasLiked) {
      nextLikesCount = Math.max(0, nextLikesCount - 1);
    } else {
      nextLikesCount = nextLikesCount + 1;
    }

    // Optimistic update
    setPost((prev: any) => ({
      ...prev,
      hasLiked: nextLiked,
      _count: { ...prev._count, likes: nextLikesCount },
    }));

    const res = await toggleLike(post.id);
    if (res.success) {
      setPost((prev: any) => ({
        ...prev,
        hasLiked: res.liked,
      }));
    } else {
      setPost((prev: any) => ({
        ...prev,
        hasLiked: wasLiked,
        _count: { ...prev._count, likes: post._count.likes },
      }));
      await checkSuspensionResponse(res);
    }
    setIsLiking(false);
  };

  const handleToggleCommentLike = async (commentId: string) => {
    if (!currentUserId) {
      openLogin();
      return;
    }
    if (isSuspended) return;
    const res = await toggleCommentLike(commentId);
    if (res.success) {
      setComments((prev: any[]) =>
        prev.map((c: any) =>
          c.id === commentId
            ? { ...c, hasLiked: res.liked, likesCount: c.likesCount + (res.liked ? 1 : -1) }
            : c
        )
      );
    } else {
      await checkSuspensionResponse(res);
    }
  };

  const handleAddComment = async () => {
    if (!currentUserId) {
      openLogin();
      return;
    }
    if (isSuspended) return;
    if (!newComment.trim() || isCommenting) return;
    setCommentSafetyError(null);

    setIsCommenting(true);
    const res = await createComment(post.id, newComment.trim());
    if (res.success) {
      const tempComment = {
        id: res.commentId,
        content: newComment.trim(),
        createdAt: new Date().toISOString(),
        author: { id: currentUserId, name: "Tú", avatarUrl: null, role: "STUDENT" },
        hasLiked: false,
        likesCount: 0,
      };
      setComments((prev: any[]) => [...prev, tempComment]);
      setPost((prev: any) => ({ ...prev, _count: { ...prev._count, comments: prev._count.comments + 1 } }));
      setNewComment("");
      setCommentSafetyError(null);
      router.refresh();
    } else {
      setCommentSafetyError(res.error || "Error al publicar el comentario.");

      await checkSuspensionResponse(res);

    }
    setIsCommenting(false);
  };

  const handleMarkResolved = async (commentId: string) => {
    if (isSuspended) return;
    const res = await markQuestionResolved(post.id, commentId);
    if (res.success) {
      setPost((prev: any) => ({
        ...prev,
        isResolved: res.isResolved,
        resolvedCommentId: res.resolvedCommentId,
      }));
      router.refresh();
    } else {
      await checkSuspensionResponse(res);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (isSuspended) return;
    const res = await deleteComment(commentId);
    if (res.success) {
      setComments((prev: any[]) => prev.filter((c: any) => c.id !== commentId));
      setPost((prev: any) => ({ ...prev, _count: { ...prev._count, comments: prev._count.comments - 1 } }));
    } else {
      await checkSuspensionResponse(res);
    }
  };

  const submitEditComment = async (commentId: string) => {
    if (isSuspended) return;
    if (!editCommentText.trim()) return;
    const res = await updateComment(commentId, editCommentText.trim());
    if (res.success) {
      setComments((prev: any[]) => prev.map((c: any) => (c.id === commentId ? { ...c, content: editCommentText.trim() } : c)));
      setEditingCommentId(null);
    } else {
      alert(res.error || "Error al actualizar comentario.");

      await checkSuspensionResponse(res);

    }
  };

  const handleDeletePost = async () => {
    if (isSuspended) return;
    const res = await deletePost(post.id);
    if (res.success) {
      router.push("/comunidad");
    } else {
      await checkSuspensionResponse(res);
    }
  };

  const submitEditPost = async () => {
    if (isSuspended) return;
    if (!editPostContent.trim()) return;
    const res = await updatePost(post.id, editPostContent.trim());
    if (res.success) {
      setPost((prev: any) => ({ ...prev, content: editPostContent.trim() }));
      setEditingPostId(null);
    } else {
      alert(res.error || "Error al actualizar la publicación.");

      await checkSuspensionResponse(res);

    }
  };

  const handleReport = async () => {
    setIsSubmittingReport(true);
    const res = await reportPost(post.id, reportReason, reportDetails);
    setReportFeedback({ type: res.success ? "success" : "error", message: res.success ? (res as any).message || "Reporte enviado" : (res as any).error || "Error" });
    setIsSubmittingReport(false);
    if (res.success) setTimeout(() => { setReportingPost(false); setReportFeedback(null); }, 2000);
  };

  const timeAgo = (date: string | Date) => {
    const diff = Math.max(0, new Date().getTime() - new Date(date).getTime());
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

  const roleLabel = (role: string) => {
    if (role === "COACH") return { text: "Coach", bg: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" };
    if (role === "ADMIN") return { text: "Admin", bg: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300" };
    return { text: "Aprendiz", bg: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" };
  };

  const postTypeLabel = (type: string) => {
    if (type === "DOUBT") return { text: "💬 Pregunta", style: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" };
    if (type === "PROMOTION") return { text: "📢 Anuncio", style: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300" };
    if (type === "EXPERIENCE") return { text: "✨ Experiencia", style: "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300" };
    return { text: "💡 General", style: "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300" };
  };

  const pt = postTypeLabel(post.postType);
  const authorRole = roleLabel(post.author.role);

  if (isSuspended && activeSuspension) {
    return <FullScreenSuspensionScreen details={activeSuspension} />;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-xl py-3 -mx-4 px-4 mb-2">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-gray-200/70 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-800 dark:text-slate-200" />
          </button>
          <div>
            <h1 className="font-extrabold text-lg text-gray-900 dark:text-slate-100">Publicación</h1>
          </div>
        </div>
      </div>

      {/* Main Post Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden"
      >
        {/* Author Header */}
        <div className="p-6 pb-0">
          <div className="flex justify-between items-start">
            <div className="flex gap-3 items-start">
              <Link href={`/comunidad/perfil/${post.author?.id}`} className="shrink-0 group">
                <img
                  src={post.author?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author?.name)}&background=0D9488&color=fff&bold=true`}
                  alt={post.author?.name}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100 dark:ring-slate-800 group-hover:ring-cfh-light-green transition-all"
                />
              </Link>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/comunidad/perfil/${post.author?.id}`}
                    className="font-extrabold text-gray-900 dark:text-slate-100 hover:text-cfh-light-green transition-colors text-base"
                  >
                    {post.author?.name}
                  </Link>
                  <span className={`text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${authorRole.bg}`}>
                    {authorRole.text}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500 mt-0.5 flex-wrap">
                  <Clock className="w-3 h-3" />
                  <span>{timeAgo(post.createdAt)}</span>
                  <span>·</span>
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${pt.style}`}>{pt.text}</span>
                  {post.isResolved && (
                    <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Resuelta
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Post Menu */}
            <div className="relative">
              <button
                onClick={() => setOpenMenuPost(!openMenuPost)}
                className="p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              <AnimatePresence>
                {openMenuPost && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-1 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-800 py-2 z-20"
                  >
                    <Link href={`/comunidad/perfil/${post.author?.id}`} onClick={() => setOpenMenuPost(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
                      <User className="w-4 h-4 text-gray-400" /> <span>Ver perfil</span>
                    </Link>
                    <button type="button" onClick={() => { if (typeof window !== "undefined") navigator.clipboard.writeText(`${window.location.origin}/comunidad/post/${post.id}`); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2500); setOpenMenuPost(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors text-left">
                      {copiedLink ? <><Check className="w-4 h-4 text-emerald-500" /><span className="text-emerald-500 font-medium">¡Enlace copiado!</span></> : <><Share2 className="w-4 h-4 text-gray-400" /><span>Copiar enlace</span></>}
                    </button>
                    {!isSuspended && currentUserId === post.author?.id && (
                      <>
                        <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />
                        {(() => {
                          const editCheck = canEditPostOrComment(post.createdAt, 15);
                          if (editCheck.canEdit) {
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuPost(false);
                                  setEditingPostId(post.id);
                                  setEditPostContent(post.content);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors text-left"
                              >
                                <Pencil className="w-4 h-4 text-gray-400" />
                                <span>Editar ({editCheck.remainingMinutes} min)</span>
                              </button>
                            );
                          }
                          return (
                            <div className="px-4 py-2 text-xs text-gray-400 dark:text-slate-500 italic">
                              Edición expirada (máx 15 min)
                            </div>
                          );
                        })()}
                        <button type="button" onClick={handleDeletePost} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-medium text-left">
                          <Trash2 className="w-4 h-4" /> <span>Eliminar</span>
                        </button>
                      </>
                    )}
                    {!isSuspended && currentUserId !== post.author?.id && (
                      <>
                        <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />
                        <button 
                          type="button" 
                          onClick={() => { 
                            if (!currentUserId) {
                              openLogin();
                              return;
                            }
                            setOpenMenuPost(false); 
                            setReportingPost(true); 
                          }} 
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-medium text-left"
                        >
                          <Flag className="w-4 h-4" /> <span>Reportar</span>
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Post Content */}
        <div className="px-6 pt-4 pb-2">
          {editingPostId === post.id ? (
            <div className="mb-4">
              <textarea
                value={editPostContent}
                onChange={(e) => setEditPostContent(e.target.value)}
                className="w-full min-h-[120px] p-4 text-base bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 border border-gray-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-cfh-dark-green outline-none resize-y transition-all"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => setEditingPostId(null)} className="px-5 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">Cancelar</button>
                <button onClick={submitEditPost} className="px-5 py-2 text-sm font-bold text-white bg-cfh-dark-green hover:bg-emerald-600 rounded-full transition-colors shadow-sm">Guardar cambios</button>
              </div>
            </div>
          ) : (() => {
            const poll = parsePoll(post.content);
            const cleanContent = post.content.replace(/\[POLL:\s*"?([^":|]+)"?\s*[:|]\s*(.+?)\]/gs, "").trim();
            const isBlockedToInteract = Boolean(
              mentionedEntity &&
              (post.canComment === false || commentPermission?.canComment === false)
            );
            const userVote = isBlockedToInteract ? undefined : pollVotes[post.id];
            const hasVoted = userVote !== undefined;
            const blockReason =
              commentPermission?.reason ||
              post.commentReason ||
              (mentionedEntity?.type === "coach"
                ? `🔒 Respuestas reservadas: Solo los estudiantes que han tomado clases o cursos con @${mentionedEntity.name} pueden votar o responder en esta consulta.`
                : `🔒 Respuestas reservadas: Solo los estudiantes inscritos en el curso "${mentionedEntity?.name}" pueden votar o responder en esta consulta.`);

            return (
              <div className="space-y-3">
                {cleanContent && (
                  <p className="text-gray-800 dark:text-slate-200 whitespace-pre-wrap text-[15px] leading-relaxed">
                    {(() => {
                      const parts = cleanContent.split(/(#[\w\u00C0-\u017F]+)/g);
                      return parts.map((part: string, i: number) => {
                        if (part.startsWith('#')) {
                          return <Link key={i} href={`/comunidad?tag=${part.replace('#', '')}`} className="text-blue-500 dark:text-blue-400 font-medium hover:underline cursor-pointer">{part}</Link>;
                        }
                        return <span key={i}>{part}</span>;
                      });
                    })()}                  </p>
                )}

                {poll && (
                  <div className={`p-4 rounded-2xl border shadow-xs transition-all ${
                    isBlockedToInteract
                      ? "bg-gradient-to-br from-amber-50/40 via-amber-50/20 to-white dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-900 border-amber-500/20"
                      : "bg-gradient-to-br from-emerald-50/60 via-teal-50/40 to-white dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-900 border-emerald-500/20"
                  }`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                        isBlockedToInteract
                          ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                          : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      }`}>
                        {isBlockedToInteract ? <Lock className="w-4 h-4" /> : <BarChart3 className="w-4 h-4" />}
                      </div>
                      <h5 className="font-extrabold text-xs text-gray-900 dark:text-white flex-1">
                        {poll.question}
                      </h5>
                      {isBlockedToInteract && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-black bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Alumnos verificados
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {(() => {
                        const totalVotes = poll.options.reduce((sum, _, idx) => sum + getOptionVotes(post.id, idx, userVote), 0);

                        return poll.options.map((option, idx) => {
                          const votes = getOptionVotes(post.id, idx, userVote);
                          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                          const isSelected = userVote === idx;

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                if (isBlockedToInteract) {
                                  setCommentSafetyError(blockReason);
                                  return;
                                }
                                if (!hasVoted) handleVotePoll(post.id, idx);
                              }}
                              disabled={hasVoted || isBlockedToInteract}
                              className={`relative w-full overflow-hidden p-2.5 rounded-xl border text-left text-xs transition-all ${
                                isBlockedToInteract
                                  ? "border-gray-200 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-800/40 text-gray-500 dark:text-slate-400 cursor-not-allowed"
                                  : hasVoted
                                  ? isSelected
                                    ? "border-emerald-500 bg-emerald-500/10 font-bold text-gray-900 dark:text-white"
                                    : "border-gray-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 text-gray-700 dark:text-slate-300"
                                  : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-slate-700/50 cursor-pointer font-medium"
                              }`}
                            >
                              {hasVoted && (
                                <div
                                  className={`absolute inset-y-0 left-0 transition-all duration-700 ${
                                    isSelected
                                      ? "bg-emerald-500/20"
                                      : "bg-gray-200/50 dark:bg-slate-700/40"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              )}
                              <div className="relative z-10 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 truncate">
                                  {isSelected ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  ) : isBlockedToInteract ? (
                                    <Lock className="w-3 h-3 text-amber-500/70 dark:text-amber-400/70 shrink-0" />
                                  ) : null}
                                  <span className="truncate">{option}</span>
                                </div>
                                {hasVoted && (
                                  <span className="text-xs sm:text-sm font-bold text-gray-600 dark:text-slate-400 shrink-0">
                                    {pct}% ({votes})
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        });
                      })()}
                    </div>

                    {isBlockedToInteract && (
                      <div className="mt-3 p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300/60 dark:border-amber-900/40 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                        <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs sm:text-sm leading-relaxed font-medium">{blockReason}</span>
                      </div>
                    )}

                    <div className="mt-2.5 text-xs text-gray-400 dark:text-slate-500 flex items-center justify-between">
                      <span>
                        {isBlockedToInteract
                          ? "🔒 Encuesta restringida a alumnos verificados"
                          : hasVoted
                          ? "✓ Has votado en esta encuesta"
                          : "Haz clic en una opción para votar"}
                      </span>
                      <span>Encuesta comunitaria</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Image */}
        {post.imageUrl && (
          <div className="mx-6 mt-3 mb-2 overflow-hidden rounded-2xl border border-gray-100 dark:border-slate-800">
            <img src={post.imageUrl} alt="Adjunto" className="w-full max-h-[500px] object-cover hover:scale-[1.01] transition-transform duration-300" />
          </div>
        )}

        

        {/* Mentioned Coach/Course Card */}
        {mentionedEntity && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-amber-50/20 dark:from-slate-800/90 dark:via-slate-800/60 dark:to-slate-900 border border-amber-500/30 shadow-xs">
            <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl overflow-hidden bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-2xs">
                  {mentionedEntity.avatarUrl ? (
                    <img 
                      src={mentionedEntity.avatarUrl} 
                      alt={mentionedEntity.name} 
                      className="w-full h-full object-cover" 
                    />
                  ) : mentionedEntity.type === "coach" ? (
                    <User className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-base text-gray-900 dark:text-white">
                      {mentionedEntity.name}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-800 dark:text-amber-300">
                      <AtSign className="w-2.5 h-2.5" />
                      {mentionedEntity.type === "coach" ? "Coach Consultado" : "Curso Consultado"}
                    </span>
                  </div>
                  {mentionedEntity.headline && (
                    <p className="text-xs text-gray-600 dark:text-slate-300 line-clamp-1 mt-0.5">
                      {mentionedEntity.headline}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      {mentionedEntity.type === "coach"
                        ? `Respuestas verificadas de alumnos de @${mentionedEntity.name.split(" ")[0]}`
                        : `Respuestas verificadas de alumnos inscritos en este curso`}
                    </span>
                  </div>
                </div>
              </div>

              <Link
                href={mentionedEntity.type === "coach" ? `/coaches/${mentionedEntity.slug || mentionedEntity.id}` : `/cursos/${mentionedEntity.slug || mentionedEntity.id}`}
                className="shrink-0 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-amber-900 dark:text-amber-200 border border-amber-500/30 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
              >
                <span>{mentionedEntity.type === "coach" ? "Ver Perfil" : "Ver Curso"}</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </Link>
            </div>
          </div>
        )}

        {/* Time stamp full */}
        <div className="px-6 py-3 mt-2">
          <p className="text-xs text-gray-400 dark:text-slate-500">
            {new Date(post.createdAt).toLocaleDateString("es", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {" · "}
            {new Date(post.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        {/* Engagement Stats Bar */}
          <div className="mx-6 py-3 border-t border-b border-gray-100 dark:border-slate-800 flex items-center gap-6">
            <span className="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2">
              <Heart className="w-4 h-4 text-gray-400" />
              <span>
                <strong className="text-gray-900 dark:text-slate-100">{post._count.likes}</strong> Me gusta
              </span>
            </span>
            <span className="text-sm text-gray-600 dark:text-slate-400">
            <strong className="text-gray-900 dark:text-slate-100">{post._count.comments}</strong> Comentarios
          </span>
        </div>

        {/* Action Buttons */}
        <div className="mx-6 py-2 border-b border-gray-100 dark:border-slate-800 flex items-center justify-around flex-wrap gap-2">
          <button 
            type="button"
            disabled={isLiking}
            onClick={() => handleToggleLike()}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors text-sm font-bold ${
              post.hasLiked 
                ? "bg-red-50 dark:bg-red-900/20 text-red-500" 
                : "hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-500 hover:text-red-500"
            } ${isLiking ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Heart className={`w-5 h-5 ${post.hasLiked ? "fill-current" : ""}`} />
            <span>{post._count.likes}</span>
          </button>
          <button
            onClick={() => {
              if (!currentUserId) {
                openLogin();
                return;
              }
              if (!isSuspended) document.getElementById("comment-input")?.focus();
            }}
            disabled={isSuspended}
            title={isSuspended ? "Inhabilitado por suspensión" : "Comentar"}
            className={`flex items-center gap-2 py-2.5 px-4 rounded-full text-sm font-semibold transition-all ${
              isSuspended
                ? "opacity-40 cursor-not-allowed text-gray-400"
                : "text-gray-500 hover:text-cfh-light-green hover:bg-emerald-50 dark:hover:bg-emerald-950/20 cursor-pointer"
            }`}
          >
            <MessageSquare className="w-[22px] h-[22px]" />
            Comentar
          </button>
          <button
            onClick={() => { if (typeof window !== "undefined") navigator.clipboard.writeText(`${window.location.origin}/comunidad/post/${post.id}`); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2500); }}
            className="flex items-center gap-2 py-2.5 px-4 rounded-full text-sm font-semibold text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all cursor-pointer"
          >
            <Share2 className="w-[22px] h-[22px]" />
            {copiedLink ? "¡Copiado!" : "Compartir"}
          </button>
          <button
            type="button"
            onClick={handleToggleSavePost}
            title={isSaved ? "Quitar de guardados" : "Guardar publicación"}
            className={`flex items-center gap-2 py-2.5 px-4 rounded-full text-sm font-semibold transition-all cursor-pointer ${
              isSaved
                ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                : "text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800"
            }`}
          >
            <Bookmark className={`w-[22px] h-[22px] ${isSaved ? "fill-current text-emerald-500" : ""}`} />
            <span>{isSaved ? "Guardado" : "Guardar"}</span>
          </button>
        </div>

        {/* Comment Input */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800">
          {isSuspended ? (
            <div className="p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/40 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <Lock className="w-4 h-4 shrink-0 text-rose-500" />
              <span>Tu cuenta se encuentra suspendida temporalmente. Los comentarios y respuestas están inhabilitados durante la suspensión.</span>
            </div>
          ) : mentionedEntity && commentPermission?.canComment === false ? (
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-slate-800/90 border border-amber-500/30 flex items-start gap-3 text-xs shadow-xs">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="font-extrabold text-gray-900 dark:text-white">
                  Respuestas reservadas para alumnos verificados
                </p>
                <p className="text-gray-600 dark:text-slate-300 mt-0.5 text-xs leading-relaxed">
                  {commentPermission.reason ||
                    (mentionedEntity.type === "coach"
                      ? `Solo los estudiantes que han tomado clases o cursos con @${mentionedEntity.name} pueden compartir su experiencia en esta consulta.`
                      : `Solo los estudiantes inscritos en el curso "${mentionedEntity.name}" pueden compartir su experiencia.`)}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Micro-aviso de convivencia y seguridad */}
              <div className="mb-3 flex items-start gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 rounded-xl text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-4 h-4 text-cfh-light-green shrink-0 mt-0.5" />
                <span>
                  <strong>Comunidad Segura:</strong> Mantén la cordialidad. Prohibido compartir números de teléfono, redes externas de contacto o datos bancarios. Tienes 15 minutos para editar tus comentarios.
                </span>
              </div>

              {commentSafetyError && (
                <div className="mb-3 flex items-center gap-2 p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{commentSafetyError}</span>
                </div>
              )}

              <div className="flex gap-3 items-start">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cfh-light-green to-emerald-600 flex items-center justify-center shrink-0 text-white font-bold text-xs shadow-sm">
                  T
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    id="comment-input"
                    type="text"
                    value={newComment}
                    onFocus={() => {
                      if (!currentUserId) openLogin();
                    }}
                    onClick={() => {
                      if (!currentUserId) openLogin();
                    }}
                    onChange={(e) => {
                      setNewComment(e.target.value);
                      if (commentSafetyError) setCommentSafetyError(null);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                    placeholder={
                      !currentUserId 
                        ? "Inicia sesión para escribir una respuesta o comentario..." 
                        : "Escribe tu respuesta constructiva..."
                    }
                    className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-full text-sm outline-none focus:ring-2 focus:ring-cfh-dark-green/30 focus:border-cfh-dark-green transition-all placeholder:text-gray-400 text-gray-900 dark:text-slate-100"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={isCommenting || !newComment.trim()}
                    className="w-10 h-10 flex items-center justify-center shrink-0 bg-cfh-dark-green text-white rounded-full hover:bg-[#061528] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Comments List */}
        <div className="px-6 pb-6">
          {comments.length === 0 ? (
            <div className="text-center py-10">
              <MessageSquare className="w-10 h-10 text-gray-200 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-gray-400 dark:text-slate-500 font-medium">Aún no hay comentarios.</p>
              <p className="text-xs text-gray-300 dark:text-slate-600 mt-1">¡Sé el primero en responder!</p>
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-gray-100 dark:divide-slate-800/60">
              {[...comments]
                .sort((a: any, b: any) => (a.id === post.resolvedCommentId ? -1 : b.id === post.resolvedCommentId ? 1 : 0))
                .map((comment: any, idx: number) => {
                const cRole = roleLabel(comment.author.role);
                const isResolvedComment = post.resolvedCommentId === comment.id;
                return (
                  <motion.div
                    key={comment.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={`flex gap-3 py-4 group transition-colors ${
                      isResolvedComment
                        ? "bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-300/80 dark:border-emerald-800/60 rounded-2xl p-4 my-2"
                        : ""
                    }`}
                  >
                    <Link href={`/comunidad/perfil/${comment.author.id}`} className="shrink-0">
                      {comment.author.avatarUrl ? (
                        <img src={comment.author.avatarUrl} alt={comment.author.name} className="w-9 h-9 rounded-full object-cover ring-1 ring-gray-100 dark:ring-slate-800" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-gray-600 dark:text-slate-300 font-bold text-xs">
                          {comment.author.name?.charAt(0).toUpperCase() || "U"}
                        </div>
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link href={`/comunidad/perfil/${comment.author.id}`} className="font-bold text-sm text-gray-900 dark:text-slate-100 hover:text-cfh-light-green transition-colors">
                            {comment.author.name}
                          </Link>
                          <span className={`text-xs uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full ${cRole.bg}`}>
                            {cRole.text}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-slate-500">· {timeAgo(comment.createdAt)}</span>
                          {isResolvedComment && (
                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full border border-emerald-300/60 dark:border-emerald-700/60">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Solución marcada
                            </span>
                          )}
                        </div>
                        {!isSuspended && currentUserId === comment.author.id && (
                          <div className="relative">
                            <button
                              onClick={() => setOpenCommentMenuId(openCommentMenuId === comment.id ? null : comment.id)}
                              className="text-gray-300 dark:text-slate-600 group-hover:text-gray-400 dark:group-hover:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 p-1 rounded-full transition-colors"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            <AnimatePresence>
                              {openCommentMenuId === comment.id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  transition={{ duration: 0.1 }}
                                  className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-800 py-1.5 z-10 overflow-hidden"
                                >
                                  {(() => {
                                    const cEditCheck = canEditPostOrComment(comment.createdAt, 15);
                                    if (cEditCheck.canEdit) {
                                      return (
                                        <button
                                          onClick={() => {
                                            setEditingCommentId(comment.id);
                                            setEditCommentText(comment.content);
                                            setOpenCommentMenuId(null);
                                          }}
                                          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
                                        >
                                          <Pencil className="w-3.5 h-3.5 text-gray-400" />
                                          <span>Editar ({cEditCheck.remainingMinutes} min)</span>
                                        </button>
                                      );
                                    }
                                    return (
                                      <div className="px-4 py-1.5 text-xs text-gray-400 dark:text-slate-500 italic">
                                        Edición expirada (máx 15 min)
                                      </div>
                                    );
                                  })()}
                                  <button onClick={() => { handleDeleteComment(comment.id); setOpenCommentMenuId(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left">
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Eliminar</span>
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>

                      {editingCommentId === comment.id ? (
                        <div className="mt-2">
                          <textarea value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)} className="w-full min-h-[60px] p-3 text-sm bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 border border-gray-200 dark:border-slate-700 rounded-xl outline-none resize-y focus:ring-2 focus:ring-cfh-dark-green/20 transition-all" autoFocus />
                          <div className="flex justify-end gap-2 mt-2">
                            <button onClick={() => setEditingCommentId(null)} className="text-xs font-semibold text-gray-500 px-3 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
                            <button onClick={() => submitEditComment(comment.id)} className="text-xs font-bold text-white bg-cfh-dark-green hover:bg-emerald-600 px-4 py-1.5 rounded-full shadow-sm transition-colors">Guardar</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed mt-1">
                            {comment.content}
                          </p>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {/* Comment Like Button */}
                            <button
                              onClick={() => handleToggleCommentLike(comment.id)}
                              disabled={isSuspended}
                              title={isSuspended ? "Inhabilitado: Tu cuenta está en modo sólo lectura" : "Me gusta"}
                              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                                isSuspended
                                  ? "opacity-40 cursor-not-allowed text-gray-400"
                                  : comment.hasLiked 
                                  ? "text-red-500 cursor-pointer" 
                                  : "text-gray-400 dark:text-slate-500 hover:text-red-500 cursor-pointer"
                              }`}
                            >
                              <Heart className={`w-3.5 h-3.5 ${comment.hasLiked ? "fill-current text-red-500" : ""}`} />
                              {comment.likesCount > 0 && <span>{comment.likesCount}</span>}
                            </button>

                            {/* Mark as Solution Button (Author of consultation post) */}
                            {!isSuspended && currentUserId === post.author?.id && (post.postType === "DOUBT" || (post.postType as string) === "REQ_REC_COACH" || (post.postType as string) === "REQ_REC_COURSE") && (
                              <button
                                onClick={() => handleMarkResolved(comment.id)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                                  isResolvedComment
                                    ? "text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200/80"
                                    : "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-300"
                                }`}
                                title={isResolvedComment ? "Quitar marca de solución" : "Marcar como respuesta útil que resolvió tu duda"}
                              >
                                <CheckCircle2 className={`w-3.5 h-3.5 ${isResolvedComment ? "text-emerald-600 dark:text-emerald-400" : ""}`} />
                                <span>{isResolvedComment ? "Solución marcada" : "Marcar como solución"}</span>
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* Report Modal */}
      <AnimatePresence>
        {reportingPost && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => !isSubmittingReport && setReportingPost(false)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-slate-800 relative" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setReportingPost(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">Reportar publicación</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">Cuéntanos por qué esta publicación no debería estar aquí.</p>
              <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-sm mb-3 outline-none focus:ring-2 focus:ring-cfh-dark-green/20">
                <option>Spam o publicidad no deseada</option>
                <option>Contenido inapropiado</option>
                <option>Acoso o bullying</option>
                <option>Información falsa</option>
                <option>Otro</option>
              </select>
              <textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} placeholder="Detalles adicionales (opcional)..." className="w-full min-h-[80px] px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-sm resize-y mb-4 outline-none focus:ring-2 focus:ring-cfh-dark-green/20" />
              {reportFeedback && (<p className={`text-sm mb-3 font-medium ${reportFeedback.type === "success" ? "text-emerald-600" : "text-red-500"}`}>{reportFeedback.message}</p>)}
              <button onClick={handleReport} disabled={isSubmittingReport} className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-full transition-colors disabled:opacity-50 shadow-sm">{isSubmittingReport ? "Enviando..." : "Enviar reporte"}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
