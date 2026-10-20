"use client";

import { useTranslation } from "./TranslationProvider";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  HelpCircle, 
  AlignLeft, 
  Send, 
  Heart, 
  MessageSquare, 
  MoreHorizontal, 
  X, 
  User, 
  Users, 
  Flag, 
  Share2, 
  Check, 
  AlertTriangle, 
  Megaphone, 
  MapPin, 
  Sparkles, 
  Award, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Pencil, 
  Trash2,
  Star,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Reply,
  Lock,
  Bookmark,
  BookmarkCheck,
  SlidersHorizontal,
  Flame,
  Clock,
  ArrowUpDown,
  BarChart3,
  Globe,
  ChevronDown,
  Plus,
  AtSign,
  BookOpen,
  ArrowRight,
  Hash
} from "lucide-react";
import { CommunitySidebar } from "./CommunitySidebar";
import { PostMediaMasonry } from "./PostMediaMasonry";
import FullScreenSuspensionScreen from "./FullScreenSuspensionScreen";
import CodeSnippetRenderer from "./CodeSnippetRenderer";
import CoachHoverCard from "./CoachHoverCard";
import Link from "next/link";
import { useAuthModal } from "@/context/AuthModalContext";
import { 
  toggleLike, 
  createPost, 
  getCommunityPosts, 
  reportPost, 
  CommunityFilter, 
  getMyRecommendableCoaches, 
  recommendCoachInPost, 
  getMyRecommendableCourses,
  recommendCourseInPost,
  deletePost,
  updateUserPresence, 
  updatePost, 
  createComment, 
  deleteComment, 
  updateComment, 
  getPostComments,
  toggleCommentLike,
  getCoachAdQuota,
  markQuestionResolved,
  getSuspensionInfo,
  getSpamStatus,
  searchMentionableEntities,
  canUserCommentOnPost,
  votePollOption,
  toggleSavePost,
  getUserSavedPostIds
} from "@/app/actions/community";
import { getPusherClient } from "@/lib/pusher-client";
import { 
  validateCommunitySafety, 
  canEditPostOrComment,
  parseCommunityMentions,
  type MentionedEntity
} from "@/lib/communitySafety";
import type { SuspensionDetails } from "@/lib/communityStrikes";
import type { PostType } from "@prisma/client";
import { isNetworkFailure } from "@/lib/guardrails";

// Regional Options with Icons (Global y Local)
export const REGION_TABS = [
  { id: "GLOBAL", label: "Global", icon: Globe },
  { id: "LOCAL", label: "Local", icon: MapPin },
];

export interface PostTypeStyle {
  label: string;
  badgeClasses: string;
  icon: typeof HelpCircle;
}

export const DEFAULT_POST_TYPE: PostTypeStyle = {
  label: "General",
  badgeClasses: "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700",
  icon: MessageSquare,
};

export const POST_TYPE_CONFIG: Record<string, PostTypeStyle> = {
  DOUBT: {
    label: "Pregunta",
    badgeClasses: "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60",
    icon: HelpCircle,
  },
  EXPERIENCE: {
    label: "Experiencia",
    badgeClasses: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60",
    icon: Sparkles,
  },
  ANNOUNCEMENT: {
    label: "Anuncio",
    badgeClasses: "bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700",
    icon: Megaphone,
  },
    PROMOTION: {
    label: "Autopromoción",
    badgeClasses: "bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700",
    icon: Megaphone,
  },
  REQ_REC_COACH: {
    label: "Busco Coach",
    badgeClasses: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60",
    icon: Sparkles,
  },
  REQ_REC_COURSE: {
    label: "Busco Curso",
    badgeClasses: "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/60",
    icon: Sparkles,
  },
  GENERAL: {
    label: "General",
    badgeClasses: "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700",
    icon: MessageSquare,
  },
};

export interface ParsedPoll {
  rawMatch: string;
  question: string;
  options: string[];
}

export function parsePoll(content: string): ParsedPoll | null {
  if (!content) return null;
  const match = content.match(/\[POLL:\s*"?([^":|]+)"?\s*[:|]\s*(.+?)\]/s);
  if (!match || !match[1] || !match[2]) return null;
  const question = match[1].trim();
  const rawOptions = match[2];
  const options = rawOptions
    .split(/[,|]/)
    .map((o) => o.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  if (options.length < 2) return null;
  return {
    rawMatch: match[0],
    question,
    options,
  };
}

export function getOptionVotes(postId: string, optionIndex: number, userVotedIndex?: number) {
  let hash = 0;
  const str = `${postId}_opt_${optionIndex}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const base = Math.abs(hash % 12) + 3;
  return base + (userVotedIndex === optionIndex ? 1 : 0);
}

export default function CommunityClient({ 
  currentUserId, 
  initialPosts, 
  initialNextCursor = null, 
  sidebarData, 
  currentUserRole, 
  canPromote, 
  currentUserAvatar,
  suspensionDetails,
  initialSavedPostIds = [],
  initialTag = null,
}: { 
  currentUserId?: string;
  initialPosts: any[]; 
  initialNextCursor?: string | null; 
  sidebarData?: any; 
  currentUserRole?: string | null; 
  canPromote?: boolean; 
  currentUserAvatar?: string | null; 
  suspensionDetails?: SuspensionDetails;
  initialSavedPostIds?: string[];
  initialTag?: string | null;
}) {
  const { t } = useTranslation();

  const isCoach = currentUserRole === "COACH";
  const isStudent = !isCoach;

  // Estado de suspensión activa
  const [activeSuspension, setActiveSuspension] = useState<SuspensionDetails | null>(suspensionDetails || null);
  const isSuspended = Boolean(activeSuspension?.isSuspended);

  useEffect(() => {
    if (suspensionDetails) {
      setActiveSuspension(suspensionDetails);
    }
  }, [suspensionDetails]);

  // Estado de restricción temporal por SPAM (1:30h)
  const [spamTimeout, setSpamTimeout] = useState<Awaited<ReturnType<typeof getSpamStatus>> | null>(null);

  useEffect(() => {
    if (!currentUserId) return;
    let isMounted = true;
    const checkSpam = () => {
      getSpamStatus().then((res) => {
        if (!isMounted) return;
        if (res?.isBlocked) {
          setSpamTimeout(res);
        } else {
          setSpamTimeout(null);
        }
      }).catch(() => {});
    };

    checkSpam();
    const interval = setInterval(checkSpam, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentUserId]);

  const [posts, setPosts] = useState(initialPosts);
  useEffect(() => { setPosts(initialPosts); }, [initialPosts]);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  useEffect(() => { setNextCursor(initialNextCursor); }, [initialNextCursor]);
  const [isLoadingMore, setIsLoadingMore] = useState(false); const [isCreatorExpanded, setIsCreatorExpanded] = useState(false);
  
  const [filter, setFilter] = useState<CommunityFilter>("GLOBAL");
  const [activeTab, setActiveTab] = useState<"ALL" | PostType | "UNANSWERED">("ALL");
  const [selectedTag, setSelectedTag] = useState<string | null>(initialTag);
  useEffect(() => { if (initialTag !== undefined) setSelectedTag(initialTag); }, [initialTag]);
  const [searchQuery, setSearchQuery] = useState("");
  const { openLogin } = useAuthModal();

  // Sorting & Bookmarks & Polls State
  const [sortBy, setSortBy] = useState<"RECENT" | "POPULAR" | "MOST_COMMENTED">("RECENT");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [savedPostIds, setSavedPostIds] = useState<string[]>(initialSavedPostIds);
  const [showOnlySaved, setShowOnlySaved] = useState<boolean>(false);
  const [showOnlyMyPosts, setShowOnlyMyPosts] = useState<boolean>(false);
  const [liveActiveMembers, setLiveActiveMembers] = useState<any[]>(sidebarData?.activeMembers || []);
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);
  const [pollVotes, setPollVotes] = useState<Record<string, number>>({});

  // WebSocket Presence via Pusher Presence Channels (presence-community)
  useEffect(() => {
    if (!currentUserId) return;
    
    // Initial heartbeat
    updateUserPresence().catch(() => {});
    
    // Heartbeat every 2 minutes to keep session alive in fallback
    const interval = setInterval(() => {
      updateUserPresence().catch(() => {});
    }, 2 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [currentUserId]);

  useEffect(() => {
    // Unauthenticated guests do not join presence channel
    if (!currentUserId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channel = pusher.subscribe("presence-community");

    channel.bind("pusher:subscription_succeeded", (members: any) => {
      const onlineUserMap = new Map<string, any>();
      if (members && typeof members.each === "function") {
        members.each((member: any) => {
          onlineUserMap.set(member.id, {
            id: member.id,
            name: member.info?.name || "Usuario",
            avatarUrl: member.info?.avatarUrl || null,
            role: member.info?.role || "STUDENT",
            headline:
              member.info?.headline ||
              (member.info?.role === "COACH" ? "Coach CFH" : "Aprendiz CFH"),
            isOnline: true,
            statusText: "En línea",
          });
        });
      }

      setLiveActiveMembers((prev) => {
        const merged = new Map<string, any>();
        for (const [id, user] of onlineUserMap.entries()) {
          merged.set(id, user);
        }
        for (const existing of prev) {
          if (!merged.has(existing.id)) {
            merged.set(existing.id, {
              ...existing,
              isOnline: false,
              statusText: "Desconectado"
            });
          }
        }
        return Array.from(merged.values());
      });
    });

    channel.bind("pusher:member_added", (member: any) => {
      setLiveActiveMembers((prev) => {
        const memberObj = {
          id: member.id,
          name: member.info?.name || "Usuario",
          avatarUrl: member.info?.avatarUrl || null,
          role: member.info?.role || "STUDENT",
          headline:
            member.info?.headline ||
            (member.info?.role === "COACH" ? "Coach CFH" : "Aprendiz CFH"),
          isOnline: true,
          statusText: "En línea",
        };

        const existingIndex = prev.findIndex((m) => m.id === member.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], ...memberObj };
          return updated;
        }
        return [memberObj, ...prev];
      });
    });

    channel.bind("pusher:member_removed", (member: any) => {
      setLiveActiveMembers((prev) =>
        prev.map((m) =>
          m.id === member.id
            ? { ...m, isOnline: false, statusText: "Desconectado" }
            : m
        )
      );
    });

    channel.bind("pusher:subscription_error", (error: any) => {
      console.warn("[Pusher Presence] Subscription error:", error);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe("presence-community");
    };
  }, [currentUserId]);

  // Sincronizar publicaciones guardadas desde la base de datos
  useEffect(() => {
    if (!currentUserId) {
      setSavedPostIds([]);
      return;
    }
    if (initialSavedPostIds && initialSavedPostIds.length > 0) {
      setSavedPostIds(initialSavedPostIds);
    } else {
      getUserSavedPostIds().then((ids) => {
        if (Array.isArray(ids)) setSavedPostIds(ids);
      });
    }

    try {
      const storedVotes = localStorage.getItem("cfh_poll_votes");
      if (storedVotes) setPollVotes(JSON.parse(storedVotes));
    } catch (e) {}
  }, [currentUserId, initialSavedPostIds]);

  const handleToggleSavePost = (postId: string) => {
    if (!currentUserId) {
      openLogin();
      return;
    }

    const wasSaved = savedPostIds.includes(postId);
    const nextSaved = wasSaved
      ? savedPostIds.filter((id) => id !== postId)
      : [...savedPostIds, postId];

    // Optimistic UI update
    setSavedPostIds(nextSaved);

    toggleSavePost(postId).then((res) => {
      if (!res.success) {
        // Rollback on failure
        setSavedPostIds(savedPostIds);
        if (res.requiresAuth) openLogin();
      }
    }).catch(() => {
      // Rollback on network error
      setSavedPostIds(savedPostIds);
    });
  };

  const handleVotePoll = async (postId: string, optionIndex: number) => {
    if (!currentUserId) {
      openLogin();
      return;
    }
    if (isSuspended) {
      setSafetyError("Acción no permitida: Tu cuenta se encuentra suspendida temporalmente (Modo Sólo Lectura).");
      return;
    }

    const targetPost = posts.find((p) => p.id === postId);
    const mention = targetPost?.mentionedEntity || (targetPost?.tags ? parseCommunityMentions(targetPost.tags) : null);

    if (mention) {
      const perm = postCommentPermissions[postId] ?? (targetPost?.canComment !== undefined ? { canComment: targetPost.canComment, reason: targetPost.commentReason } : await canUserCommentOnPost(postId));
      if (!perm.canComment) {
        setSafetyError(perm.reason || "🔒 Respuestas reservadas: Solo los alumnos que han tomado clases o cursos con la persona o curso consultado pueden responder o votar.");
        return;
      }
    }

    const res = await votePollOption(postId, optionIndex);
    if (!res.success) {
      setSafetyError(res.error || "No fue posible registrar tu voto.");
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

  // Coach Ad Quota & Safety State
  const [coachQuota, setCoachQuota] = useState<{
    tierName: string;
    limit: string | number;
    usedThisWeek: number;
    remaining: string | number;
    canPost: boolean;
    isUnlimited: boolean;
  } | null>(null);
  const [safetyError, setSafetyError] = useState<string | null>(null);
  const [uiToast, setUiToast] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  const [editPostError, setEditPostError] = useState<{ [postId: string]: string }>({});
  const [editCommentError, setEditCommentError] = useState<{ [commentId: string]: string }>({});

  useEffect(() => {
    if (!uiToast) return;
    const timer = window.setTimeout(() => setUiToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [uiToast]);

  useEffect(() => {
    if (isCoach && currentUserId) {
      getCoachAdQuota(currentUserId).then((res) => {
        if (res.success && res.quota) {
          setCoachQuota(res.quota);
        }
      });
    }
  }, [isCoach, currentUserId]);

  // Create Post State
  const [isCreating, setIsCreating] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostType, setNewPostType] = useState<PostType>(isCoach ? "PROMOTION" : "DOUBT");
  const [newPostImages, setNewPostImages] = useState<File[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Visual Interactive Poll Builder State
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  // Mentions State (@Coach / @Curso)
  const [selectedMention, setSelectedMention] = useState<MentionedEntity | null>(null);
  const [mentionSearchOpen, setMentionSearchOpen] = useState(false);
  const [mentionSearchQuery, setMentionSearchQuery] = useState("");
  const [mentionActiveTab, setMentionActiveTab] = useState<"coaches" | "courses">("coaches");
  const [mentionSearchResults, setMentionSearchResults] = useState<{ coaches: MentionedEntity[]; courses: MentionedEntity[] }>({ coaches: [], courses: [] });
  const [isLoadingMentions, setIsLoadingMentions] = useState(false);

  // Permisos verificados para comentar en posts con mención
  const [postCommentPermissions, setPostCommentPermissions] = useState<Record<string, { canComment: boolean; reason?: string }>>({});

  const fetchMentionEntities = async (query: string = "") => {
    setIsLoadingMentions(true);
    try {
      const res = await searchMentionableEntities(query);
      if (res.success) {
        setMentionSearchResults({ coaches: res.coaches as MentionedEntity[], courses: res.courses as MentionedEntity[] });
      }
    } catch (e) {
      console.error("Error fetching mention entities:", e);
    } finally {
      setIsLoadingMentions(false);
    }
  };

  const handleSelectMention = (entity: MentionedEntity) => {
    setSelectedMention(entity);
    setMentionSearchOpen(false);
    setMentionSearchQuery("");
    // Si en el texto hay un '@' sin cerrar, reemplazarlo limpiamente
    const lastAtIdx = newPostContent.lastIndexOf("@");
    if (lastAtIdx !== -1) {
      const before = newPostContent.slice(0, lastAtIdx);
      setNewPostContent(`${before}@${entity.name} `);
    }
  };

  const checkPostPermission = async (postId: string) => {
    if (postCommentPermissions[postId]) return;
    try {
      const res = await canUserCommentOnPost(postId);
      setPostCommentPermissions((prev) => ({ ...prev, [postId]: res }));
    } catch (e) {
      console.error("Error checking post comment permission:", e);
    }
  };

  // Sincronizar permisos de interacción verificada para posts en el feed
  useEffect(() => {
    const newPerms: Record<string, { canComment: boolean; reason?: string }> = {};
    const pendingCheckIds: string[] = [];

    posts.forEach((p) => {
      const mention = p.mentionedEntity || (p.tags ? parseCommunityMentions(p.tags) : null);
      if (mention) {
        if (p.canComment !== undefined) {
          newPerms[p.id] = { canComment: p.canComment, reason: p.commentReason };
        } else if (!postCommentPermissions[p.id]) {
          pendingCheckIds.push(p.id);
        }
      }
    });

    if (Object.keys(newPerms).length > 0) {
      setPostCommentPermissions((prev) => ({ ...newPerms, ...prev }));
    }

    if (pendingCheckIds.length > 0 && currentUserId) {
      pendingCheckIds.forEach((id) => {
        canUserCommentOnPost(id).then((res) => {
          setPostCommentPermissions((prev) => ({ ...prev, [id]: res }));
        });
      });
    }
  }, [posts, currentUserId]);

  // Si un post tiene restricciones y el usuario no está verificado para responder, invalidar cualquier voto previo guardado en localStorage
  useEffect(() => {
    if (Object.keys(pollVotes).length === 0) return;
    let hasChanges = false;
    const nextVotes = { ...pollVotes };

    posts.forEach((p) => {
      const mention = p.mentionedEntity || (p.tags ? parseCommunityMentions(p.tags) : null);
      if (mention) {
        const perm = postCommentPermissions[p.id] ?? (p.canComment !== undefined ? { canComment: p.canComment, reason: p.commentReason } : null);
        if (perm && perm.canComment === false && nextVotes[p.id] !== undefined) {
          delete nextVotes[p.id];
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      setPollVotes(nextVotes);
      try {
        localStorage.setItem("cfh_poll_votes", JSON.stringify(nextVotes));
      } catch (e) {}
    }
  }, [posts, postCommentPermissions, pollVotes]);

  // Lightbox State
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);

  const openLightbox = (images: string[], index: number = 0) => {
    if (!images || images.length === 0) return;
    setLightboxImages(images);
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxImages([]);
    setLightboxIndex(0);
  };

  // LocalStorage Draft con protección contra toxicidad y soporte de encuestas
  useEffect(() => {
    try {
      if (isSuspended) {
        localStorage.removeItem("cfh_community_draft");
        setNewPostContent("");
        setShowPollCreator(false);
        setPollQuestion("");
        setPollOptions(["", ""]);
        return;
      }

      const saved = localStorage.getItem("cfh_community_draft");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.content) {
          const safety = validateCommunitySafety(parsed.content);
          if (safety.isValid) {
            // Si el borrador ya tenía encuesta incrustada, extraerla al constructor visual limpio
            const poll = parsePoll(parsed.content);
            if (poll) {
              setShowPollCreator(true);
              setPollQuestion(poll.question);
              setPollOptions(poll.options.length >= 2 ? poll.options : ["", ""]);
              setNewPostContent(parsed.content.replace(/\[POLL:\s*"?([^":|]+)"?\s*[:|]\s*(.+?)\]/gs, "").trim());
            } else {
              setNewPostContent(parsed.content);
            }
            if (parsed?.type) setNewPostType(parsed.type);
          } else {
            // El borrador almacenado contiene términos ofensivos o prohibidos: PURGAR DE INMEDIATO
            localStorage.removeItem("cfh_community_draft");
            setNewPostContent("");
            setShowPollCreator(false);
            setPollQuestion("");
            setPollOptions(["", ""]);
          }
        }
      }
    } catch (e) {
      console.error("Error cargando borrador:", e);
      try {
        localStorage.removeItem("cfh_community_draft");
      } catch (_) {}
    }
  }, [isSuspended]);

  useEffect(() => {
    try {
      if (isSuspended) {
        localStorage.removeItem("cfh_community_draft");
        return;
      }

      let contentToPersist = newPostContent.trim();
      const validOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (showPollCreator && validOptions.length >= 2) {
        const q = pollQuestion.trim() || "¿Qué opinas de este tema?";
        const pollSyntax = `\n\n[POLL: "${q}": ${validOptions.map((o) => `"${o}"`).join(", ")}]`;
        contentToPersist = (contentToPersist ? contentToPersist + pollSyntax : pollSyntax).trim();
      }

      if (contentToPersist) {
        // Solo guardar en almacenamiento local si el contenido es seguro y no viola las normas
        const safety = validateCommunitySafety(contentToPersist);
        if (safety.isValid) {
          localStorage.setItem(
            "cfh_community_draft",
            JSON.stringify({ content: contentToPersist, type: newPostType, updatedAt: Date.now() })
          );
        } else {
          // Si el usuario escribe palabras prohibidías u ofensivas, borrar cualquier borrador previo
          localStorage.removeItem("cfh_community_draft");
        }
      } else {
        localStorage.removeItem("cfh_community_draft");
      }
    } catch (e) {}
  }, [newPostContent, newPostType, isSuspended, showPollCreator, pollQuestion, pollOptions]);

  // Comments State
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [postComments, setPostComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; authorName: string } | null>(null);
  const [commentSafetyError, setCommentSafetyError] = useState<string | null>(null);
  const [offlineBanner, setOfflineBanner] = useState<string | null>(null);

  // Restore comment draft when a post is expanded
  useEffect(() => {
    if (!expandedPostId) return;
    try {
      const saved = localStorage.getItem(`cfh_comment_draft_${expandedPostId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.content) {
          setNewComment(parsed.content);
          setCommentSafetyError("Tenías un borrador guardado de tu último comentario. Puedes editarlo y enviarlo de nuevo.");
        }
      }
    } catch (_) {}
  }, [expandedPostId]);

  // Detect reconnection and notify user their drafts are safe
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => {
      try {
        const postDraft = localStorage.getItem("cfh_community_draft");
        const commentDraft = expandedPostId ? localStorage.getItem(`cfh_comment_draft_${expandedPostId}`) : null;
        if (postDraft || commentDraft) {
          setOfflineBanner("Reconectado. Tu borrador guardado sigue disponible para que lo envíes.");
          setTimeout(() => setOfflineBanner(null), 6000);
        }
      } catch (_) {}
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [expandedPostId]);

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

  const commentRoleBadge = (role?: string) => {
    if (role === "COACH") {
      return {
        label: "Coach",
        classes: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
      };
    }
    if (role === "ADMIN") {
      return {
        label: "Admin",
        classes: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      };
    }
    return {
      label: "Aprendiz",
      classes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    };
  };

  const handleStartReply = (comment: any) => {
    if (!currentUserId) {
      openLogin();
      return;
    }
    const authorName = comment.author?.name || "usuario";
    setReplyingTo({ commentId: comment.id, authorName });
    setNewComment((prev) => {
      const mention = `@${authorName} `;
      return prev.startsWith(mention) ? prev : `${mention}${prev}`;
    });
  };

  const handleMarkResolved = async (postId: string, commentId: string) => {
    if (isSuspended) {
      setSafetyError("Acción no permitida: Tu cuenta se encuentra suspendida temporalmente (Modo Sólo Lectura).");
      return;
    }
    requireAuth(async () => {
      const res = await markQuestionResolved(postId, commentId);
      if ((res as any).isSuspended) {
        getSuspensionInfo().then((s) => s && setActiveSuspension(s));
        setSafetyError(res.error || "Tu cuenta está suspendida.");
        return;
      }
      if (res.success) {
        setPosts((current) =>
          current.map((p) =>
            p.id === postId
              ? { ...p, isResolved: res.isResolved, resolvedCommentId: res.resolvedCommentId }
              : p
          )
        );
      } else {
        alert(res.error || "No se pudo actualizar el estado de la pregunta.");
      }
    });
  };
  
  // Edit State
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostContent, setEditPostContent] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(null);

  // Delete Modals
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [deletingComment, setDeletingComment] = useState<{ commentId: string; postId: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Report & Menu State
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const [reportingPost, setReportingPost] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState("Spam o publicidad no deseada");
  const [reportDetails, setReportDetails] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);

  // Recommend Course Modal
  const [recommendingCoursePostId, setRecommendingCoursePostId] = useState<string | null>(null);
  const [eligibleCourses, setEligibleCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [recommendCourseCommentText, setRecommendCourseCommentText] = useState("");
  const [isLoadingEligibleCourses, setIsLoadingEligibleCourses] = useState(false);
  const [isSubmittingCourseRecommendation, setIsSubmittingCourseRecommendation] = useState(false);
  const [recommendCourseError, setRecommendCourseError] = useState<string | null>(null);

  // Recommend Coach Modal (DER-125)
  const [recommendingPostId, setRecommendingPostId] = useState<string | null>(null);
  const [eligibleCoaches, setEligibleCoaches] = useState<any[]>([]);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [recommendCommentText, setRecommendCommentText] = useState("");
  const [isLoadingEligibleCoaches, setIsLoadingEligibleCoaches] = useState(false);
  const [isSubmittingRecommendation, setIsSubmittingRecommendation] = useState(false);
  const [recommendError, setRecommendError] = useState<string | null>(null);

  // Keyboard navigation & click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".post-menu-container") && !target.closest(".post-menu-btn")) {
        setOpenMenuPostId(null);
      }
      if (!target.closest(".comment-menu-container") && !target.closest(".comment-menu-btn")) {
        setOpenCommentMenuId(null);
      }
      if (!target.closest(".sort-dropdown-container")) {
        setIsSortOpen(false);
      }
      if (!target.closest(".search-container")) {
        setShowSearchDropdown(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenuPostId(null);
        if (!isSubmittingReport) setReportingPost(null);
        if (lightboxImages.length > 0) closeLightbox();
        if (recommendingPostId) setRecommendingPostId(null);
        if (deletingPostId) setDeletingPostId(null);
        if (deletingComment) setDeletingComment(null);
        if (mentionSearchOpen) {
          setMentionSearchOpen(false);
          setMentionSearchQuery("");
        }
      } else if (e.key === "ArrowLeft" && lightboxImages.length > 0) {
        setLightboxIndex((prev) => (prev > 0 ? prev - 1 : lightboxImages.length - 1));
      } else if (e.key === "ArrowRight" && lightboxImages.length > 0) {
        setLightboxIndex((prev) => (prev < lightboxImages.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener("click", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSubmittingReport, lightboxImages.length, recommendingPostId, deletingPostId, deletingComment, mentionSearchOpen]);

  // Lock scroll when modal is open
  useEffect(() => {
    const isAnyModalOpen = Boolean(
      reportingPost || lightboxImages.length > 0 || recommendingPostId || deletingPostId || deletingComment
    );
    if (isAnyModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [reportingPost, lightboxImages.length, recommendingPostId, deletingPostId, deletingComment]);

  // Scroll to hash on load
  useEffect(() => {
    const scrollToHash = () => {
      if (typeof window !== "undefined" && window.location.hash) {
        const hash = window.location.hash;
        const element = document.querySelector(hash);
        if (element) {
          setTimeout(() => {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.classList.add("ring-4", "ring-cfh-light-green", "transition-all", "duration-1000");
            setTimeout(() => element.classList.remove("ring-4", "ring-cfh-light-green"), 2000);
          }, 300);
        }
      }
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  // Helper to parse images
  const getPostImages = (post: any): string[] => {
    if (Array.isArray(post.images) && post.images.length > 0) return post.images;
    if (!post.imageUrl) return [];
    if (typeof post.imageUrl === "string" && post.imageUrl.startsWith("[")) {
      try {
        const parsed = JSON.parse(post.imageUrl);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [post.imageUrl];
  };

  // Auth requirement check
  const requireAuth = (action: () => void) => {
    if (!currentUserId) {
      openLogin();
    } else {
      action();
    }
  };

  // Copy link
  const handleCopyLink = (postId: string) => {
    const url = `${window.location.origin}/comunidad/post/${postId}`;
    navigator.clipboard.writeText(url);
    setCopiedPostId(postId);
    setTimeout(() => setCopiedPostId(null), 2000);
    setOpenMenuPostId(null);
  };

  // Toggle comments expander con fijación de solución destacada
  const toggleComments = async (postId: string) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      setPostComments([]);
    } else {
      setExpandedPostId(postId);
      setIsLoadingComments(true);
      const comments = await getPostComments(postId);
      const targetPost = posts.find((p) => p.id === postId);
      if (targetPost?.mentionedEntity) {
        checkPostPermission(postId);
      }
      if (targetPost?.resolvedCommentId) {
        comments.sort((a, b) => {
          if (a.id === targetPost.resolvedCommentId) return -1;
          if (b.id === targetPost.resolvedCommentId) return 1;
          return 0;
        });
      }
      setPostComments(comments);
      setIsLoadingComments(false);
    }
  };

  // Like Toggle
  const handleToggleLike = async (postId: string) => {
    if (isSuspended) {
      setSafetyError("Acción no permitida: Tu cuenta se encuentra suspendida temporalmente (Modo Sólo Lectura).");
      return;
    }
    requireAuth(async () => {
      const targetPost = posts.find((p) => p.id === postId);
      if (!targetPost || (targetPost as any).isLiking) return;

      const wasLiked = targetPost.hasLiked;
      const nextLiked = !wasLiked;

      // Optimistic update
      setPosts((current) =>
        current.map((p) => {
          if (p.id === postId) {
            let nextLikesCount = p._count.likes;
            if (wasLiked) {
              nextLikesCount = Math.max(0, nextLikesCount - 1);
            } else {
              nextLikesCount = nextLikesCount + 1;
            }

            return {
              ...p,
              hasLiked: nextLiked,
              isLiking: true,
              _count: {
                ...p._count,
                likes: nextLikesCount,
              },
            };
          }
          return p;
        })
      );

      const res = await toggleLike(postId);
      if ((res as any).isSuspended) {
        getSuspensionInfo().then((s) => s && setActiveSuspension(s));
        setSafetyError(res.error || "Tu cuenta está suspendida.");
        setPosts((current) =>
          current.map((p) => (p.id === postId ? { ...targetPost, isLiking: false } : p))
        );
        return;
      }

      if (res.success) {
        setPosts((current) =>
          current.map((p) => {
            if (p.id === postId) {
              return {
                ...p,
                hasLiked: res.liked,
                isLiking: false,
              };
            }
            return p;
          })
        );
      } else {
        setPosts((current) =>
          current.map((p) => (p.id === postId ? { ...targetPost, isLiking: false } : p))
        );
        if (res.error) setSafetyError(res.error);
      }
    });
  };

  // Like Comment Toggle
  const handleToggleCommentLike = async (commentId: string) => {
    if (isSuspended) {
      setSafetyError("Acción no permitida: Tu cuenta se encuentra suspendida temporalmente (Modo Sólo Lectura).");
      return;
    }
    requireAuth(async () => {
      const res = await toggleCommentLike(commentId);
      if ((res as any).isSuspended) {
        getSuspensionInfo().then((s) => s && setActiveSuspension(s));
        setSafetyError(res.error || "Tu cuenta está suspendida.");
        return;
      }
      if (res.success) {
        setPostComments((current) =>
          current.map((c) => {
            if (c.id === commentId) {
              const prevLikes = c.likesCount ?? c._count?.likes ?? 0;
              return {
                ...c,
                hasLiked: res.liked,
                likesCount: prevLikes + (res.liked ? 1 : -1),
                _count: {
                  ...(c._count || {}),
                  likes: prevLikes + (res.liked ? 1 : -1),
                },
              };
            }
            return c;
          })
        );
      }
    });
  };

  // Image Upload for Post
  const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setNewPostImages((prev) => [...prev, ...files].slice(0, 4));
  };

  const handleRemoveImage = (index: number) => {
    setNewPostImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Create Post
  const handleCreatePost = async () => {
    if (isSuspended) {
      setSafetyError("Acción no disponible: No puedes crear publicaciones mientras tu cuenta se encuentre suspendida temporalmente.");
      return;
    }
    if (spamTimeout?.isBlocked) {
      setSafetyError(`Acción no disponible: Tu cuenta está pausada temporalmente por SPAM. Podrás volver a enviar mensajes dentro de ${spamTimeout.remainingText || "1h 30m"} (a las ${spamTimeout.formattedHour || ""}).`);
      return;
    }
    requireAuth(async () => {
      // Validar primero si el contenido o la encuesta violan el reglamento de la comunidad
      if (!postSafetyCheck.isValid) {
        setSafetyError(postSafetyCheck.reason || "Tu publicación o encuesta contiene términos o datos no permitidos por el reglamento.");
        return;
      }

      const validPollOptions = showPollCreator ? pollOptions.map((o) => o.trim()).filter(Boolean) : [];
      if (showPollCreator && validPollOptions.length < 2) {
        setSafetyError("Para crear una encuesta debes ingresar al menos 2 opciones de respuesta.");
        return;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const draft = { content: newPostContent.trim(), type: newPostType, updatedAt: Date.now() };
        localStorage.setItem("cfh_community_draft", JSON.stringify(draft));
        setSafetyError("Parece que perdiste tu conexión a internet. Hemos guardado tu progreso.");
        return;
      }

      let finalContent = newPostContent.trim();
      if (showPollCreator && validPollOptions.length >= 2) {
        const q = pollQuestion.trim() || "¿Qué opinas de este tema?";
        const pollSyntax = `\n\n[POLL: "${q}": ${validPollOptions.map((o) => `"${o}"`).join(", ")}]`;
        finalContent = (finalContent ? finalContent + pollSyntax : pollSyntax).trim();
      }

      const finalSafety = validateCommunitySafety(finalContent);
      if (!finalSafety.isValid) {
        setSafetyError(finalSafety.reason || "El contenido infringe las normas de la comunidad.");
        return;
      }

      if (!finalContent && newPostImages.length === 0) return;
      setSafetyError(null);

      setIsCreating(true);

      try {
        let uploadedUrls: string[] = [];
        if (newPostImages.length > 0) {
          setIsUploadingImages(true);
          try {
            for (const img of newPostImages) {
              const formData = new FormData();
              formData.append("file", img);
              const upRes = await fetch("/api/upload", { 
                method: "POST", 
                body: formData,
                signal: AbortSignal.timeout(12000)
              });
              const upData = await upRes.json().catch(() => ({}));
              if (upRes.ok) {
                if (upData.url) uploadedUrls.push(upData.url);
              } else {
                setSafetyError(upData.error || "Error al subir la imagen. Verifica que sea apta y no contenga datos prohibidos.");
                setNewPostImages([]);
                try {
                  localStorage.removeItem("cfh_community_draft");
                } catch (_) {}
                if (upData.isSuspended) {
                  getSuspensionInfo().then((s) => s && setActiveSuspension(s));
                }
                return;
              }
            }
          } catch (e: any) {
            console.error("Failed to upload image(s)", e);
            if (e?.name === "TimeoutError" || e?.name === "AbortError") {
              setSafetyError("El análisis de la imagen tardó demasiado tiempo. Inténtalo de nuevo o con una imagen más liviana.");
            } else {
              setSafetyError("Error de conexión al subir la imagen.");
            }
            return;
          } finally {
            setIsUploadingImages(false);
          }
        }

        const tags = finalContent.match(/#[\p{L}\d_]+/gu) || [];
        const imagePayload = uploadedUrls.length === 1 ? uploadedUrls[0] : uploadedUrls.length > 1 ? uploadedUrls : undefined;
        const typeToSend = newPostType;
        const res = await createPost(finalContent, typeToSend as any, tags, imagePayload, selectedMention);

        if (res.success) {
          const mentionCopy = selectedMention;
          setNewPostContent("");
          setNewPostImages([]);
          setShowPollCreator(false);
          setPollQuestion("");
          setPollOptions(["", ""]);
          setSelectedMention(null);
          setSafetyError(null);
          if (isCoach && currentUserId) {
            getCoachAdQuota(currentUserId).then((q) => {
              if (q.success && q.quota) setCoachQuota(q.quota);
            });
          }
          try {
            localStorage.removeItem("cfh_community_draft");
          } catch (e) {}


          // Inserción optimista inmediata (0ms de espera, sin necesidad de F5)
          if (res.post) {
            const optimisticPost = {
              ...res.post,
              imageUrl: imagePayload ? (Array.isArray(imagePayload) ? JSON.stringify(imagePayload) : imagePayload) : null,
              mentionedEntity: mentionCopy,
              author: {
                id: currentUserId,
                name: "Tú",
                role: currentUserRole,
                avatarUrl: currentUserAvatar,
              },
              _count: { comments: 0, likes: 0 },
              hasLiked: false,
              comments: [],
              tags: tags,
              isResolved: false,
            };
            setPosts((prev) => [optimisticPost, ...prev.filter((p) => p.id !== res.post.id)]);

            // Si el tab actual filtra por un tipo diferente al recién publicado,
            // conmutar a "ALL" para mantener la publicación visible y consistente en el feed
            if (activeTab !== "ALL" && activeTab !== res.post.postType) {
              setActiveTab("ALL");
              loadFilteredPosts(filter, "ALL", searchQuery, selectedTag);
            } else {
              loadFilteredPosts(filter, activeTab, searchQuery, selectedTag);
            }
          } else {
            loadFilteredPosts(filter, activeTab, searchQuery, selectedTag);
          }
        } else {
          setSafetyError(res.error || "Ocurrióóó un error al crear la publicación.");
          // Purgar de raíz el borrador local y limpiar el formulario para evitar residuos ofensivos
          try {
            localStorage.removeItem("cfh_community_draft");
          } catch (_) {}
          setNewPostContent("");
          setNewPostImages([]);
          setShowPollCreator(false);
          setPollQuestion("");
          setPollOptions(["", ""]);
          if ((res as any).isSuspended) {
            getSuspensionInfo().then((s) => s && setActiveSuspension(s));
          }
          if ((res as any).isSpamBlocked) {
            getSpamStatus().then((s) => s && setSpamTimeout(s));
          }

        }
      } catch (postErr) {
        console.error("Error creating post:", postErr);
        if (isNetworkFailure(postErr)) {
          const draft = { content: finalContent || newPostContent.trim(), type: newPostType, updatedAt: Date.now() };
          localStorage.setItem("cfh_community_draft", JSON.stringify(draft));
          setSafetyError("Parece que perdiste tu conexión a internet. Hemos guardado tu progreso.");
          return;
        }
        setSafetyError("Ocurrió un error inesperado al crear la publicación.");
      } finally {
        setIsCreating(false);
        setIsUploadingImages(false);
      }
    });
  };

  // Filter Posts
  const loadFilteredPosts = async (
    newFilter: CommunityFilter = filter, 
    newTab: "ALL" | PostType | "UNANSWERED" = activeTab, 
    query: string = searchQuery,
    tag?: string | null,
    newSort: "RECENT" | "POPULAR" | "MOST_COMMENTED" = sortBy
  ) => {
    const freshRes = await getCommunityPosts(
      newFilter, 
      newTab !== "ALL" ? newTab : undefined, 
      query, 
      undefined, 
      10, 
      tag !== undefined ? (tag || undefined) : (selectedTag || undefined),
      newSort
    );
    setPosts(freshRes.posts);
    setNextCursor(freshRes.nextCursor ?? null);
  };

  // Sincronización en tiempo real en segundo plano (polling cada 6 segundos sin refresh manual)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (isCreating || editingPostId || editingCommentId) return;

      try {
        const freshRes = await getCommunityPosts(
          filter,
          activeTab === "ALL" ? undefined : activeTab,
          searchQuery,
          undefined,
          15,
          selectedTag || undefined,
          sortBy
        );

        if (freshRes?.posts && freshRes.posts.length > 0) {
          setPosts((prev) => {
            const existingMap = new Map(prev.map((p) => [p.id, p]));
            const newPostsFromOthers: any[] = [];

            for (const post of freshRes.posts) {
              if (!existingMap.has(post.id)) {
                newPostsFromOthers.push(post);
              }
            }

            if (newPostsFromOthers.length === 0) {
              // Actualizar contadores y estados existentes sin mover el scroll
              return prev.map((p) => {
                const updated = freshRes.posts.find((fp) => fp.id === p.id);
                if (updated) {
                  if ((p as any).isLiking) {
                    return {
                      ...p,
                      isResolved: updated.isResolved,
                      resolvedCommentId: updated.resolvedCommentId,
                      content: updated.content,
                      tags: updated.tags,
                    };
                  }
                  return {
                    ...p,
                    _count: updated._count,
                    hasLiked: updated.hasLiked,
                    isResolved: updated.isResolved,
                    resolvedCommentId: updated.resolvedCommentId,
                    content: updated.content,
                    tags: updated.tags,
                  };
                }
                return p;
              });
            }

            // Integrar nuevas publicaciones al inicio
            const updatedExisting = prev.map((p) => {
              const updated = freshRes.posts.find((fp) => fp.id === p.id);
              if (updated) {
                if ((p as any).isLiking) {
                  return { ...p, ...updated, _count: p._count, hasLiked: p.hasLiked };
                }
                return { ...p, ...updated };
              }
              return p;
            });
            const merged = [...newPostsFromOthers, ...updatedExisting];
            if (sortBy === "RECENT") {
              merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            }
            return merged;
          });
        }
      } catch (e) {
        // Silencioso para background polling
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [filter, activeTab, searchQuery, selectedTag, sortBy, isCreating, editingPostId, editingCommentId]);

  // Load More Posts
  const loadMorePosts = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    const res = await getCommunityPosts(
      filter, 
      activeTab !== "ALL" ? activeTab : undefined, 
      searchQuery, 
      nextCursor,
      10,
      selectedTag || undefined,
      sortBy
    );
    if (res.posts) {
      setPosts((current) => [...current, ...res.posts]);
      setNextCursor(res.nextCursor ?? null);
    }
    setIsLoadingMore(false);
  };

  // Visibilidad de feed:
  // En "Todos", "Preguntas" y "Experiencias": NADA de coaches ni autopromociones. Solo publicaciones entre aprendices.
  // Lo de coaches (autopromoción y anuncios) únicamente se muestra al seleccionar la pestaña "Anuncios".
  const visiblePosts = posts
    .filter((p) => {
      if (selectedTag) {
        const cleanSelected = selectedTag.replace(/^#/, "").trim().toLowerCase();
        const unaccentedS = cleanSelected.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        const postTags: string[] = Array.isArray(p.tags) 
          ? p.tags 
          : typeof p.tags === "string" 
            ? (() => { try { const parsed = JSON.parse(p.tags); return Array.isArray(parsed) ? parsed : [p.tags]; } catch { return [p.tags]; } })() 
            : [];
        
        const matchesTag = postTags.some((t: any) => {
          if (typeof t !== "string") return false;
          const clean = t.replace(/^#/, "").trim().toLowerCase();
          const unaccentedT = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return clean === cleanSelected || unaccentedT === unaccentedS;
        });

        const contentLower = (p.content || "").toLowerCase();
        const unaccentedContent = contentLower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        const matchesContent = 
          contentLower.includes(`#${cleanSelected}`) || 
          unaccentedContent.includes(`#${unaccentedS}`);

        if (!matchesTag && !matchesContent) {
          return false;
        }
      }

      if (showOnlyMyPosts) {
        return currentUserId ? p.authorId === currentUserId : false;
      }
      if (showOnlySaved) {
        return savedPostIds.includes(p.id);
      }
      if (activeTab === "UNANSWERED") {
        return p.postType === "DOUBT" && (!p._count?.comments || p._count.comments === 0) && !p.isResolved;
      }
      if (activeTab === "ANNOUNCEMENT" || activeTab === "PROMOTION") {
        return p.postType === "ANNOUNCEMENT" || p.postType === "PROMOTION";
      }
      // En las demás pestañas ("Todos", "Preguntas", etc.): bloquear todo lo de coaches y autopromociones
      if (p.postType === "PROMOTION" || p.postType === "ANNOUNCEMENT") {
        return false;
      }
      if (activeTab !== "ALL") {
        return p.postType === activeTab;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "POPULAR") {
        const diff = (b._count?.likes ?? 0) - (a._count?.likes ?? 0);
        if (diff !== 0) return diff;
      } else if (sortBy === "MOST_COMMENTED") {
        const diff = (b._count?.comments ?? 0) - (a._count?.comments ?? 0);
        if (diff !== 0) return diff;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  // Post Actions
  const submitEditPost = async (postId: string) => {
    if (isSuspended) {
      setEditPostError((prev) => ({ ...prev, [postId]: "Acción no permitida: Tu cuenta está suspendida." }));
      return;
    }
    if (spamTimeout?.isBlocked) {
      setEditPostError((prev) => ({ ...prev, [postId]: `Acción no permitida: Envío pausado por SPAM. Restante: ${spamTimeout.remainingText || "1h 30m"}.` }));
      return;
    }
    if (!editPostContent.trim()) return;
    setEditPostError((prev) => ({ ...prev, [postId]: "" }));
    const res = await updatePost(postId, editPostContent);
    if (res.success) {
      setPosts((current) =>
        current.map((p) => (p.id === postId ? { ...p, content: editPostContent } : p))
      );
      setEditingPostId(null);
      setEditPostContent("");
      setEditPostError((prev) => ({ ...prev, [postId]: "" }));
    } else {
      const errorMsg = res.error || "Error al actualizar la publicación";
      setEditPostError((prev) => ({ ...prev, [postId]: errorMsg }));
      if ((res as any).isSuspended) {
        getSuspensionInfo().then((s) => s && setActiveSuspension(s));
      }
      if ((res as any).isSpamBlocked) {
        getSpamStatus().then((s) => s && setSpamTimeout(s));
      }
    }
  };

  const confirmDeletePost = async () => {
    if (isSuspended) {
      alert("Acción no permitida: Tu cuenta está suspendida.");
      return;
    }
    if (!deletingPostId) return;
    setIsDeleting(true);
    const res = await deletePost(deletingPostId);
    setIsDeleting(false);
    if (res.success) {
      setPosts((current) => current.filter((p) => p.id !== deletingPostId));
      setDeletingPostId(null);
      setUiToast({ type: "success", message: "Publicación eliminada." });
    } else if ((res as any).isSuspended) {
      getSuspensionInfo().then((s) => s && setActiveSuspension(s));
      setUiToast({ type: "warning", message: res.error || "No se pudo eliminar la publicación." });
    }
  };

  // Comment Actions
  const handleCreateComment = async (postId: string) => {
    if (isSuspended) {
      setCommentSafetyError("Acción no permitida: No puedes comentar mientras tu cuenta esté suspendida.");
      return;
    }
    if (spamTimeout?.isBlocked) {
      setCommentSafetyError(`Acción no permitida: Envío de comentarios pausado por SPAM. Restante: ${spamTimeout.remainingText || "1h 30m"}.`);
      return;
    }
    requireAuth(async () => {
      const commentText = newComment.trim();
      if (!commentText) return;
      setIsCommenting(true);
      setCommentSafetyError(null);
      
      const res = await createComment(postId, commentText);
      setIsCommenting(false);
      if (res.success) {
        setNewComment("");
        setReplyingTo(null);
        setCommentSafetyError(null);
        localStorage.removeItem(`cfh_comment_draft_${postId}`);

        // Inserción optimista de comentario instantánea
        if ((res as any).comment) {
          setPostComments((current) => [...current, (res as any).comment]);
        }
        setPosts((current) =>
          current.map((p) =>
            p.id === postId ? { ...p, _count: { ...p._count, comments: p._count.comments + 1 } } : p
          )
        );

        // Refrescar lista completa en background
        getPostComments(postId).then((freshComments) => {
          if (freshComments) setPostComments(freshComments);
        });
      } else {
        const offlineMessage = "Parece que perdiste tu conexión a internet. Hemos guardado tu progreso.";
        setCommentSafetyError((res as any).error && /demasiado rápido|espera un minuto|conexión a internet/i.test(String((res as any).error)) ? (res.error || null) : (res.error || "Error al comentar"));
        if (isNetworkFailure(res.error) || !navigator.onLine) {
          localStorage.setItem(`cfh_comment_draft_${postId}`, JSON.stringify({ content: newComment.trim(), updatedAt: Date.now() }));
          setCommentSafetyError(offlineMessage);
        }
        if ((res as any).isSuspended) {
          getSuspensionInfo().then((s) => s && setActiveSuspension(s));
        }
        if ((res as any).isSpamBlocked) {
          getSpamStatus().then((s) => s && setSpamTimeout(s));
        }
      }
    });
  };

  const submitEditComment = async (commentId: string) => {
    if (isSuspended) {
      setEditCommentError((prev) => ({ ...prev, [commentId]: "Acción no permitida: Tu cuenta está suspendida." }));
      return;
    }
    if (spamTimeout?.isBlocked) {
      setEditCommentError((prev) => ({ ...prev, [commentId]: `Acción no permitida: Envío pausado por SPAM. Restante: ${spamTimeout.remainingText || "1h 30m"}.` }));
      return;
    }
    const text = editCommentText.trim();
    if (!text) return;
    setEditCommentError((prev) => ({ ...prev, [commentId]: "" }));
    const res = await updateComment(commentId, text);
    if (res.success) {
      setPostComments((current) =>
        current.map((c) => (c.id === commentId ? { ...c, content: text } : c))
      );
      setEditingCommentId(null);
      setEditCommentText("");
      setEditCommentError((prev) => ({ ...prev, [commentId]: "" }));
    } else {
      const errorMsg = res.error || "Error al actualizar comentario";
      setEditCommentError((prev) => ({ ...prev, [commentId]: errorMsg }));
      if ((res as any).isSuspended) {
        getSuspensionInfo().then((s) => s && setActiveSuspension(s));
      }
      if ((res as any).isSpamBlocked) {
        getSpamStatus().then((s) => s && setSpamTimeout(s));
      }
    }
  };

  const confirmDeleteComment = async () => {
    if (isSuspended) {
      setUiToast({ type: "warning", message: "Acción no permitida: Tu cuenta está suspendida." });
      return;
    }
    if (!deletingComment) return;
    setIsDeleting(true);
    const res = await deleteComment(deletingComment.commentId);
    setIsDeleting(false);
    if (res.success) {
      setPostComments((current) => current.filter((c) => c.id !== deletingComment.commentId));
      setPosts((current) =>
        current.map((p) =>
          p.id === deletingComment.postId
            ? { ...p, _count: { ...p._count, comments: Math.max(0, p._count.comments - 1) } }
            : p
        )
      );
      setDeletingComment(null);
      setUiToast({ type: "success", message: "Comentario eliminado." });
    } else if ((res as any).isSuspended) {
      getSuspensionInfo().then((s) => s && setActiveSuspension(s));
      setUiToast({ type: "warning", message: res.error || "No se pudo eliminar el comentario." });
    }
  };

  // Report Submission
  const handleSubmitReport = async () => {
    if (!reportingPost) return;
    setIsSubmittingReport(true);
    setReportFeedback(null);
    try {
      const res = await reportPost(reportingPost.id, reportReason, reportDetails);
      if (!res.success) {
        setReportFeedback({ type: "error", message: res.error || "Error al procesar el reporte." });
        return;
      }
      setReportFeedback({
        type: "success",
        message: res.message || "Tu reporte ha sido enviado y será revisado por el equipo.",
      });
    } catch (error) {
      setReportFeedback({ type: "error", message: "Ocurrióóó un error inesperado al enviar el reporte." });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Open Recommend Coach Modal (DER-125)
  const handleOpenRecommendModal = async (postId: string) => {
    if (isSuspended) {
      setSafetyError("Acción no permitida: Tu cuenta se encuentra suspendida temporalmente (Modo Sólo Lectura).");
      return;
    }
    requireAuth(async () => {
      setRecommendingPostId(postId);
      setSelectedCoachId(null);
      setRecommendCommentText("");
      setRecommendError(null);
      setIsLoadingEligibleCoaches(true);
      try {
        const res = await getMyRecommendableCoaches();
        if (res.success && res.coaches) {
          setEligibleCoaches(res.coaches);
          if (res.coaches.length > 0) {
            setSelectedCoachId(res.coaches[0].id);
          }
        } else {
          setRecommendError(res.error || "No se encontraron coaches recomendables.");
        }
      } catch (e) {
        setRecommendError("Error al cargar la lista de coaches.");
      } finally {
        setIsLoadingEligibleCoaches(false);
      }
    });
  };


  // Open Recommend Course Modal (DER-130)
  const handleOpenRecommendCourseModal = async (postId: string) => {
    if (isSuspended) {
      setSafetyError("Acción no permitida: Tu cuenta se encuentra suspendida temporalmente (Modo Sólo Lectura).");
      return;
    }
    requireAuth(async () => {
      setRecommendingCoursePostId(postId);
      setSelectedCourseId(null);
      setRecommendCourseCommentText("");
      setRecommendCourseError(null);
      setIsLoadingEligibleCourses(true);
      try {
        const res = await getMyRecommendableCourses();
        if (res.success && res.courses) {
          setEligibleCourses(res.courses);
          if (res.courses.length > 0) {
            setSelectedCourseId(res.courses[0]?.id || null);
          }
        } else {
          setRecommendCourseError(res.error || "No se encontraron cursos recomendables.");
        }
      } catch (e) {
        setRecommendCourseError("Error al cargar la lista de cursos.");
      } finally {
        setIsLoadingEligibleCourses(false);
      }
    });
  };

  // Submit Course Recommendation
  const handleSubmitCourseRecommendation = async () => {
    if (isSuspended) {
      setRecommendCourseError("Acción no permitida: Tu cuenta se encuentra suspendida temporalmente.");
      return;
    }
    if (!recommendingCoursePostId || !selectedCourseId) return;
    setIsSubmittingCourseRecommendation(true);
    setRecommendCourseError(null);
    try {
      const res = await recommendCourseInPost(
        recommendingCoursePostId, 
        selectedCourseId, 
        recommendCourseCommentText.trim() || "¡Te recomiendo mucho este curso!"
      );
      if (res.success) {
        setRecommendingCoursePostId(null);
        // Refresh comments if expanded
        if (expandedPostId === recommendingCoursePostId) {
          const freshComments = await getPostComments(recommendingCoursePostId);
          setPostComments(freshComments);
        }
        setPosts((current) => current.map((p) => p.id === recommendingCoursePostId ? { ...p, _count: { ...p._count, comments: p._count.comments + 1 } } : p));
      } else {
        setRecommendCourseError(res.error || "Error al recomendar el curso");
        if (res.isSuspended) {
          
          setSafetyError(res.error || "Cuenta suspendida.");
          setRecommendingCoursePostId(null);
        }
      }
    } catch (e) {
      setRecommendCourseError("Ocurrió un error inesperado.");
    } finally {
      setIsSubmittingCourseRecommendation(false);
    }
  };

  // Submit Coach Recommendation
  const handleSubmitRecommendation = async () => {
    if (isSuspended) {
      setRecommendError("Acción no permitida: Tu cuenta se encuentra suspendida temporalmente.");
      return;
    }
    if (!recommendingPostId || !selectedCoachId) return;
    setIsSubmittingRecommendation(true);
    setRecommendError(null);
    try {
      const res = await recommendCoachInPost(
        recommendingPostId, 
        selectedCoachId, 
        recommendCommentText.trim() || "¡Te recomiendo mucho a este coach!"
      );
      if (res.success) {
        setRecommendingPostId(null);
        // Refresh comments if expanded
        if (expandedPostId === recommendingPostId) {
          const freshComments = await getPostComments(recommendingPostId);
          setPostComments(freshComments);
        }
        setPosts((current) =>
          current.map((p) =>
            p.id === recommendingPostId
              ? { ...p, _count: { ...p._count, comments: p._count.comments + 1 } }
              : p
          )
        );
      } else {
        setRecommendError(res.error || "No se pudo registrar la recomendación.");
        if ((res as any).isSuspended) {
          getSuspensionInfo().then((s) => s && setActiveSuspension(s));
        }
      }
    } catch (e) {
      setRecommendError("Error de comunicación al enviar la recomendación.");
    } finally {
      setIsSubmittingRecommendation(false);
    }
  };

  // Evaluación en tiempo real del reglamento y seguridad (Post principal + Pregunta + Opciones de encuesta)
  const contentSafety = newPostContent.trim() ? validateCommunitySafety(newPostContent.trim()) : { isValid: true };
  const questionSafety = (showPollCreator && pollQuestion.trim()) ? validateCommunitySafety(pollQuestion.trim()) : { isValid: true };
  const optionsSafety = showPollCreator 
    ? pollOptions.map((opt) => (opt.trim() ? validateCommunitySafety(opt.trim()) : { isValid: true }))
    : [];
  const firstInvalidOption = optionsSafety.find((s) => !s.isValid);

  const postSafetyCheck: { isValid: boolean; reason?: string } = !contentSafety.isValid
    ? contentSafety
    : !questionSafety.isValid
    ? questionSafety
    : firstInvalidOption
    ? firstInvalidOption
    : { isValid: true };

  const hasTypedAnyPostContent = newPostContent.trim().length > 0 || 
    (showPollCreator && (pollQuestion.trim().length > 0 || pollOptions.some((o) => o.trim().length > 0)));

  // Si la cuenta está suspendida, BLOQUEO TOTAL: solo mostrar la pantalla completa de suspensión
  if (activeSuspension?.isSuspended) {
    return <FullScreenSuspensionScreen details={activeSuspension} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#061528] pt-28 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Banner de Reconexión: se muestra cuando el usuario recupera internet con borradores guardados */}
        {offlineBanner && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl shadow-emerald-900/30 text-sm font-semibold animate-in slide-in-from-bottom-4 duration-300">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12 20.25h.008v.008H12v-.008z" /></svg>
            {offlineBanner}
            <button onClick={() => setOfflineBanner(null)} className="ml-2 opacity-80 hover:opacity-100 transition-opacity text-lg leading-none">&times;</button>
          </div>
        )}

        {/* Lightbox Modal */}
        <AnimatePresence>
          {lightboxImages.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
              onClick={closeLightbox}
            >
              <button
                type="button"
                onClick={closeLightbox}
                className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-50"
              >
                <X className="w-6 h-6" />
              </button>

              {lightboxImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex((prev) => (prev > 0 ? prev - 1 : lightboxImages.length - 1));
                    }}
                    className="absolute left-5 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-50"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex((prev) => (prev < lightboxImages.length - 1 ? prev + 1 : 0));
                    }}
                    className="absolute right-5 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-50"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              <div 
                className="relative max-w-4xl max-h-[85vh] flex flex-col items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={lightboxImages[lightboxIndex]}
                  alt={`Imagen ${lightboxIndex + 1}`}
                  className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
                />
                {lightboxImages.length > 1 && (
                  <div className="mt-4 px-4 py-1.5 rounded-full bg-black/60 text-white/90 text-xs font-semibold">
                    {lightboxIndex + 1} de {lightboxImages.length}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>


        {/* Recommend Course Modal (DER-130) */}
        <AnimatePresence>
          {recommendingCoursePostId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-slate-800"
              >
                <button
                  type="button"
                  onClick={() => setRecommendingCoursePostId(null)}
                  className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6 fill-current" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      Recomendar un Curso
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Comparte la experiencia de tus cursos con este usuario
                    </p>
                  </div>
                </div>

                {recommendCourseError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{recommendCourseError}</span>
                  </div>
                )}

                {isLoadingEligibleCourses ? (
                  <div className="py-12 text-center text-gray-500 dark:text-slate-400 text-sm flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
                    <span>Cargando cursos en los que estás inscrito...</span>
                  </div>
                ) : eligibleCourses.length === 0 ? (
                  <div className="py-8 text-center bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-gray-100 dark:border-slate-800">
                    <Award className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <h4 className="font-bold text-sm text-gray-800 dark:text-slate-200 mb-1">
                      No tienes cursos elegibles
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-slate-400 max-w-xs mx-auto mb-4">
                      Para recomendar un curso debes estar inscrito en él o haberlo completado.
                    </p>
                    <button
                      type="button"
                      onClick={() => setRecommendingCoursePostId(null)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40"
                    >
                      Entendido
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                      Selecciona el curso que deseas recomendar:
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto mb-4 pr-1">
                      {eligibleCourses.map((course) => (
                        <label
                          key={course.id}
                          className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                            selectedCourseId === course.id
                              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                              : "border-gray-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700"
                          }`}
                        >
                          <input
                            type="radio"
                            name="recommendCourse"
                            value={course.id}
                            checked={selectedCourseId === course.id}
                            onChange={(e) => setSelectedCourseId(e.target.value)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-600"
                          />
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-800 shrink-0">
                            {course.thumbnailUrl ? (
                              <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <BookOpen className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-900 dark:text-white truncate">
                              {course.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                              Por {course.coach?.name || "Desconocido"}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>

                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                      Mensaje de recomendación (opcional):
                    </label>
                    <textarea
                      value={recommendCourseCommentText}
                      onChange={(e) => setRecommendCourseCommentText(e.target.value)}
                      placeholder="Ejemplo: Te recomiendo mucho este curso porque me ayudó a dominar el tema..."
                      rows={3}
                      className="w-full p-3 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none mb-6"
                    />

                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setRecommendingCoursePostId(null)}
                        disabled={isSubmittingCourseRecommendation}
                        className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmitCourseRecommendation}
                        disabled={isSubmittingCourseRecommendation || !selectedCourseId}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-600 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmittingCourseRecommendation ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        <span>Recomendar Curso</span>
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Delete Post Confirmation Modal */}
        <AnimatePresence>
          {deletingPostId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
              onClick={() => !isDeleting && setDeletingPostId(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-slate-800"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-14 h-14 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-center text-gray-900 dark:text-white mb-2">
                  ¿Eliminar publicación?
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 text-center mb-6">
                  Esta acción no se puede deshacer y se borrarán todos los comentarios asociados.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDeletingPostId(null)}
                    disabled={isDeleting}
                    className="flex-1 py-2.5 rounded-xl font-bold text-xs text-gray-600 dark:text-slate-300 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeletePost}
                    disabled={isDeleting}
                    className="flex-1 py-2.5 rounded-xl font-bold text-xs text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    {isDeleting ? <Loader2 className="w-4 sm:w-5 h-4 sm:h-5 animate-spin" /> : "Eliminar"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Comment Confirmation Modal */}
        <AnimatePresence>
          {deletingComment && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
              onClick={() => !isDeleting && setDeletingComment(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-slate-800"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-14 h-14 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-center text-gray-900 dark:text-white mb-2">
                  ¿Eliminar comentario?
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 text-center mb-6">
                  El comentario desaparecerá del hilo permanentemente.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDeletingComment(null)}
                    disabled={isDeleting}
                    className="flex-1 py-2.5 rounded-xl font-bold text-xs text-gray-600 dark:text-slate-300 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteComment}
                    disabled={isDeleting}
                    className="flex-1 py-2.5 rounded-xl font-bold text-xs text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Eliminar"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recommend Coach Modal (DER-125) */}
        <AnimatePresence>
          {recommendingPostId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
              onClick={() => !isSubmittingRecommendation && setRecommendingPostId(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-slate-800 relative"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setRecommendingPostId(null)}
                  disabled={isSubmittingRecommendation}
                  className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center">
                    <Star className="w-6 h-6 fill-current" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      Recomendar a un Coach
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Comparte la experiencia de tus cursos o mentorías con este usuario
                    </p>
                  </div>
                </div>

                {recommendError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{recommendError}</span>
                  </div>
                )}

                {isLoadingEligibleCoaches ? (
                  <div className="py-12 text-center text-gray-500 dark:text-slate-400 text-sm flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-cfh-dark-green dark:text-cfh-light-green" />
                    <span>Cargando coaches con los que has tomado clases...</span>
                  </div>
                ) : eligibleCoaches.length === 0 ? (
                  <div className="py-8 text-center bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-gray-100 dark:border-slate-800">
                    <Award className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <h4 className="font-bold text-sm text-gray-800 dark:text-slate-200 mb-1">
                      No tienes coaches elegibles
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-slate-400 max-w-xs mx-auto mb-4">
                      Para recomendar a un coach debes haber completado al menos 2 sesiones con él o estar inscrito en uno de sus cursos.
                    </p>
                    <button
                      type="button"
                      onClick={() => setRecommendingPostId(null)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-cfh-dark-green bg-cfh-light-green/20"
                    >
                      Entendido
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                      Selecciona al coach que deseas recomendar:
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto mb-4 pr-1">
                      {eligibleCoaches.map((coach) => (
                        <label
                          key={coach.id}
                          className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                            selectedCoachId === coach.id
                              ? "border-cfh-light-green bg-cfh-light-green/10"
                              : "border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="coachSelection"
                            value={coach.id}
                            checked={selectedCoachId === coach.id}
                            onChange={() => setSelectedCoachId(coach.id)}
                            className="accent-cfh-light-green"
                          />
                          <img
                            src={coach.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(coach.name)}`}
                            alt={coach.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <h5 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                              {coach.name}
                            </h5>
                            <span className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 truncate block">
                              Coach Verificado en CoachingFromHome
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>

                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                      Mensaje de recomendación (opcional):
                    </label>
                    <textarea
                      rows={3}
                      value={recommendCommentText}
                      onChange={(e) => setRecommendCommentText(e.target.value)}
                      placeholder="Ejemplo: Te recomiendo mucho al profesor porque me ayudó a resolver un problema idéntico en sus sesiones..."
                      className="w-full text-xs p-3 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cfh-light-green resize-none mb-4"
                    />

                    <div className="flex gap-3 justify-end">
                      <button
                        type="button"
                        onClick={() => setRecommendingPostId(null)}
                        disabled={isSubmittingRecommendation}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmitRecommendation}
                        disabled={isSubmittingRecommendation || !selectedCoachId}
                        className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-cfh-dark-green hover:bg-[#061528] disabled:opacity-50 transition-colors flex items-center gap-2"
                      >
                        {isSubmittingRecommendation ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <Star className="w-3.5 h-3.5 fill-current text-amber-400" />
                            <span>Recomendar Coach</span>
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

        {/* Report Modal */}
        <AnimatePresence>
          {reportingPost && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
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
                          Publicado por <span className="font-semibold text-gray-700 dark:text-slate-300">{reportingPost.author.name}</span>
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                      Ayúdanos a mantener la comunidad segura. Selecciona el motivo que mejor describa la infracción:
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
                            name="reportReason"
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
                        placeholder="Escribe detalles adicionales que ayuden a los moderadores a evaluar el reporte..."
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Feed Column */}
          <div className="lg:col-span-8 min-w-0 flex flex-col gap-6">
            
            <div className="flex items-center justify-between mb-2">
  <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
    {t("Community.title", "Comunidad")} <span className="text-emerald-500">{t("Community.cfh", "CFH")}</span>
  </h1>
</div>
              {/* Region Filters & Search Bar */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
                {/* Region Tabs */}
                <div className="flex gap-1.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-1.5 rounded-2xl overflow-x-auto max-w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] border border-gray-200/80 dark:border-slate-800/80 shadow-xs">
                  {REGION_TABS.map((tab) => {
                    const TabIcon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setFilter(tab.id);
                          loadFilteredPosts(tab.id, activeTab, searchQuery, selectedTag, sortBy);
                        }}
                        className={`flex items-center gap-2 px-4.5 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-sm sm:text-base font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                          filter === tab.id
                            ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-600/25 scale-[1.02]"
                            : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 hover:bg-gray-100/60 dark:hover:bg-slate-800/60"
                        }`}
                      >
                        <TabIcon className="w-4 sm:w-5 h-4 sm:h-5" />
                        <span>{t(`Community.${tab.id.toLowerCase()}`, tab.label)}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Search Input & Sort Selector */}
                <div className="flex items-center gap-2 flex-1 sm:max-w-md">
                  <div className="relative flex-1 search-container">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder={t("Community.search_placeholder", "Buscar dudas, tema...")}
                      className="pl-11 pr-10 py-2.5 sm:py-3 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-gray-200/80 dark:border-slate-800/80 rounded-2xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 shadow-2xs transition-all placeholder:text-gray-400"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowSearchDropdown(e.target.value.trim().length >= 2);
                      }}
                      onFocus={() => {
                        if (searchQuery.trim().length >= 2) setShowSearchDropdown(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setShowSearchDropdown(false);
                          loadFilteredPosts(filter, activeTab, searchQuery, selectedTag, sortBy);
                        }
                      }}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setShowSearchDropdown(false);
                          loadFilteredPosts(filter, activeTab, "", selectedTag, sortBy);
                        }}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Live Search Suggestions Dropdown */}
                    {showSearchDropdown && searchQuery.trim().length >= 2 && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl p-2 z-30 animate-in fade-in slide-in-from-top-2">
                        <div className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 px-2 py-1 flex items-center justify-between">
                          <span>Sugerencias rápidas</span>
                          <span className="text-xs sm:text-xs font-normal lowercase">Enter para buscar</span>
                        </div>
                        <div className="space-y-1">
                          {posts
                            .filter((p) => p.content?.toLowerCase().includes(searchQuery.toLowerCase()))
                            .slice(0, 4)
                            .map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setShowSearchDropdown(false);
                                  const el = document.getElementById(`post-${p.id}`);
                                  if (el) {
                                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                                    el.classList.add("ring-4", "ring-emerald-500/50");
                                    setTimeout(() => el.classList.remove("ring-4", "ring-emerald-500/50"), 2000);
                                  }
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-slate-800 text-xs text-gray-700 dark:text-slate-200 truncate flex items-center gap-2 cursor-pointer"
                              >
                                <Search className="w-3 h-3 text-emerald-500 shrink-0" />
                                <span className="truncate">{p.content.slice(0, 50)}...</span>
                              </button>
                            ))}
                          <button
                            type="button"
                            onClick={() => {
                              setShowSearchDropdown(false);
                              loadFilteredPosts(filter, activeTab, searchQuery, selectedTag, sortBy);
                            }}
                            className="w-full text-left px-2.5 py-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-between mt-1 cursor-pointer"
                          >
                            <span>Buscar publicaciones con &ldquo;{searchQuery}&rdquo;</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sort Selector Dropdown */}
                  <div className="relative sort-dropdown-container">
                    <button
                      type="button"
                      onClick={() => setIsSortOpen(!isSortOpen)}
                      className="px-4 sm:px-5 py-2.5 sm:py-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-gray-200/80 dark:border-slate-800/80 rounded-2xl text-sm sm:text-base font-extrabold text-gray-700 dark:text-slate-300 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-800 shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                      title="Ordenar publicaciones"
                    >
                      <ArrowUpDown className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="hidden sm:inline">
                        {sortBy === "RECENT" ? t("Community.most_recent", "Más recientes") : sortBy === "POPULAR" ? t("Community.most_popular", "Más populares") : t("Community.most_commented", "Más comentados")}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isSortOpen ? "rotate-180" : ""}`} />
                    </button>

                    <AnimatePresence>
                      {isSortOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-full mt-2 w-60 min-w-[240px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-gray-200/90 dark:border-slate-800 rounded-2xl shadow-xl p-2 z-30 space-y-1.5"
                        >
                          <div className="px-3 py-1.5 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                            Ordenar por
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSortBy("RECENT");
                              setIsSortOpen(false);
                              loadFilteredPosts(filter, activeTab, searchQuery, selectedTag, "RECENT");
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm sm:text-base transition-colors cursor-pointer ${
                              sortBy === "RECENT"
                                ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold"
                                : "text-gray-700 dark:text-slate-300 hover:bg-gray-100/70 dark:hover:bg-slate-800"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <Clock className="w-4 h-4" />
                              </div>
                              <span className="whitespace-nowrap">{t("Community.most_recent", "Más recientes")}</span>
                            </div>
                            {sortBy === "RECENT" && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSortBy("POPULAR");
                              setIsSortOpen(false);
                              loadFilteredPosts(filter, activeTab, searchQuery, selectedTag, "POPULAR");
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm sm:text-base transition-colors cursor-pointer ${
                              sortBy === "POPULAR"
                                ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold"
                                : "text-gray-700 dark:text-slate-300 hover:bg-gray-100/70 dark:hover:bg-slate-800"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <Flame className="w-4 h-4" />
                              </div>
                              <span className="whitespace-nowrap">{t("Community.most_popular", "Más populares")}</span>
                            </div>
                            {sortBy === "POPULAR" && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSortBy("MOST_COMMENTED");
                              setIsSortOpen(false);
                              loadFilteredPosts(filter, activeTab, searchQuery, selectedTag, "MOST_COMMENTED");
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm sm:text-base transition-colors cursor-pointer ${
                              sortBy === "MOST_COMMENTED"
                                ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold"
                                : "text-gray-700 dark:text-slate-300 hover:bg-gray-100/70 dark:hover:bg-slate-800"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                <MessageSquare className="w-4 h-4" />
                              </div>
                              <span className="whitespace-nowrap">{t("Community.most_commented", "Más comentados")}</span>
                            </div>
                            {sortBy === "MOST_COMMENTED" && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Post Type Chips Bar */}
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 sm:pb-0 sm:flex-wrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <button
                  onClick={() => {
                    setShowOnlySaved(false);
                    setShowOnlyMyPosts(false);
                    setActiveTab("ALL");
                    loadFilteredPosts(filter, "ALL", searchQuery, selectedTag, sortBy);
                  }}
                  className={`px-4.5 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-sm sm:text-base font-extrabold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                    activeTab === "ALL" && !showOnlySaved && !showOnlyMyPosts
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-600/25 scale-[1.02]"
                      : "bg-white/90 dark:bg-slate-900/90 border border-gray-200/80 dark:border-slate-800/80 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:scale-[1.01]"
                  }`}
                >
                  <MessageSquare className="w-4 sm:w-4.5 h-4 sm:h-4.5" />
                  <span>{t("Community.all", "Todos")}</span>
                </button>

                {isStudent ? (
                  <>
                    {/* Aprendiz: Preguntas */}
                    <button
                      onClick={() => {
                        setShowOnlySaved(false);
                        setShowOnlyMyPosts(false);
                        setActiveTab("DOUBT");
                        loadFilteredPosts(filter, "DOUBT", searchQuery, selectedTag, sortBy);
                      }}
                      className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-sm sm:text-base font-extrabold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                        activeTab === "DOUBT" && !showOnlySaved && !showOnlyMyPosts
                          ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-sm shadow-blue-600/25 scale-[1.02]"
                          : "bg-white/90 dark:bg-slate-900/90 border border-gray-200/80 dark:border-slate-800/80 text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 hover:scale-[1.01]"
                      }`}
                    >
                      <HelpCircle className="w-4 sm:w-4.5 h-4 sm:h-4.5" />
                      <span>{t("Community.questions", "Preguntas")}</span>
                    </button>

                    {/* Aprendiz: Dudías sin responder */}
                    <button
                      onClick={() => {
                        setShowOnlySaved(false);
                        setShowOnlyMyPosts(false);
                        setActiveTab("UNANSWERED");
                        loadFilteredPosts(filter, "UNANSWERED", searchQuery, selectedTag, sortBy);
                      }}
                      className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-sm sm:text-base font-extrabold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                        activeTab === "UNANSWERED" && !showOnlySaved && !showOnlyMyPosts
                          ? "bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-sm shadow-rose-500/25 scale-[1.02]"
                          : "bg-white/90 dark:bg-slate-900/90 border border-gray-200/80 dark:border-slate-800/80 text-rose-600 dark:text-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 hover:scale-[1.01]"
                      }`}
                    >
                      <Clock className="w-4 sm:w-4.5 h-4 sm:h-4.5" />
                      <span>{t("Community.unanswered", "Sin responder")}</span>
                    </button>

                    {/* Aprendiz: Anuncios */}
                    <button
                      onClick={() => {
                        setShowOnlySaved(false);
                        setShowOnlyMyPosts(false);
                        setActiveTab("ANNOUNCEMENT");
                        loadFilteredPosts(filter, "ANNOUNCEMENT", searchQuery, selectedTag, sortBy);
                      }}
                      className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-sm sm:text-base font-extrabold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                        (activeTab === "ANNOUNCEMENT" || activeTab === "PROMOTION") && !showOnlySaved && !showOnlyMyPosts
                          ? "bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-sm shadow-purple-600/25 scale-[1.02]"
                          : "bg-white/90 dark:bg-slate-900/90 border border-gray-200/80 dark:border-slate-800/80 text-purple-600 dark:text-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-950/30 hover:scale-[1.01]"
                      }`}
                    >
                      <Megaphone className="w-4 sm:w-4.5 h-4 sm:h-4.5" />
                      <span>{t("Community.announcements", "Anuncios")}</span>
                    </button>

                    {/* Aprendiz: Busco Coach */}
                    <button
                      onClick={() => {
                        setShowOnlySaved(false);
                        setShowOnlyMyPosts(false);
                        setActiveTab("REQ_REC_COACH" as any);
                        loadFilteredPosts(filter, "REQ_REC_COACH" as any, searchQuery, selectedTag, sortBy);
                      }}
                      className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-sm sm:text-base font-extrabold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                        (activeTab as string) === "REQ_REC_COACH" && !showOnlySaved && !showOnlyMyPosts
                          ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm shadow-amber-500/25 scale-[1.02]"
                          : "bg-white/90 dark:bg-slate-900/90 border border-gray-200/80 dark:border-slate-800/80 text-amber-600 dark:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 hover:scale-[1.01]"
                      }`}
                    >
                      <Sparkles className="w-4 sm:w-4.5 h-4 sm:h-4.5" />
                      <span>{t("Community.looking_for_coach", "Busco Coach")}</span>
                    </button>

                    {/* Aprendiz: Busco Curso */}
                    <button
                      onClick={() => {
                        setShowOnlySaved(false);
                        setShowOnlyMyPosts(false);
                        setActiveTab("REQ_REC_COURSE" as any);
                        loadFilteredPosts(filter, "REQ_REC_COURSE" as any, searchQuery, selectedTag, sortBy);
                      }}
                      className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-sm sm:text-base font-extrabold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                        (activeTab as string) === "REQ_REC_COURSE" && !showOnlySaved && !showOnlyMyPosts
                          ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-600/25 scale-[1.02]"
                          : "bg-white/90 dark:bg-slate-900/90 border border-gray-200/80 dark:border-slate-800/80 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 hover:scale-[1.01]"
                      }`}
                    >
                      <Sparkles className="w-4 sm:w-4.5 h-4 sm:h-4.5" />
                      <span>{t("Community.looking_for_course", "Busco Curso")}</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Coach: Publicidad y Actividades */}
                    <button
                      onClick={() => {
                        setShowOnlySaved(false);
                        setShowOnlyMyPosts(false);
                        setActiveTab("ANNOUNCEMENT");
                        loadFilteredPosts(filter, "ANNOUNCEMENT", searchQuery, selectedTag, sortBy);
                      }}
                      className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-sm sm:text-base font-extrabold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                        (activeTab === "ANNOUNCEMENT" || activeTab === "PROMOTION") && !showOnlySaved && !showOnlyMyPosts
                          ? "bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-sm shadow-purple-600/25 scale-[1.02]"
                          : "bg-white/90 dark:bg-slate-900/90 border border-gray-200/80 dark:border-slate-800/80 text-purple-600 dark:text-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-950/30 hover:scale-[1.01]"
                      }`}
                    >
                      <Megaphone className="w-4 sm:w-4.5 h-4 sm:h-4.5" />
                      <span>Publicidad y Actividades</span>
                    </button>
                  </>
                )}

                {/* Guardados Tab */}
                <button
                  onClick={() => {
                    setShowOnlyMyPosts(false);
                    setShowOnlySaved(!showOnlySaved);
                  }}
                  className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-sm sm:text-base font-extrabold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                    showOnlySaved
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-600/25 scale-[1.02]"
                      : "bg-white/90 dark:bg-slate-900/90 border border-gray-200/80 dark:border-slate-800/80 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 hover:scale-[1.01]"
                  }`}
                >
                  <Bookmark className="w-4 sm:w-4.5 h-4 sm:h-4.5" />
                  <span>{t("Community.saved", "Guardados")}</span>
                  {savedPostIds.length > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                      showOnlySaved
                        ? "bg-white/20 text-white"
                        : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                    }`}>
                      {savedPostIds.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Dynamic Hashtag Filter Active Chip */}
              {selectedTag && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-gray-500 dark:text-slate-400">Filtrando por tema:</span>
                  <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cfh-light-green/20 text-cfh-dark-green dark:text-cfh-light-green text-xs sm:text-sm font-black">
                    <span>#{selectedTag.replace(/^#/, "")}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTag(null);
                        loadFilteredPosts(filter, activeTab, searchQuery, null, sortBy);
                      }}
                      className="hover:opacity-75 cursor-pointer"
                      title="Quitar filtro"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              )}

              {/* Dynamic My Posts Filter Active Chip */}
              {showOnlyMyPosts && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-gray-500 dark:text-slate-400">Filtrando por:</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-500/20">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Mis Publicaciones ({posts.filter(p => p.authorId === currentUserId).length})</span>
                    <button
                      type="button"
                      onClick={() => setShowOnlyMyPosts(false)}
                      className="hover:opacity-75 cursor-pointer ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              )}
            </div>

            {/* Create Post Box */}
            <div className={`bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-6 shadow-sm border transition-all focus-within:border-emerald-500/40 focus-within:ring-2 focus-within:ring-emerald-500/20 ${isSuspended ? "border-rose-200/90 dark:border-rose-900/60 ring-2 ring-rose-500/20" : spamTimeout?.isBlocked ? "border-amber-300/90 dark:border-amber-700/60 ring-2 ring-amber-500/20" : "border-gray-200/80 dark:border-slate-800/80"}`}>
              {/* Si está suspendido o en pausa por SPAM */}
              {isSuspended ? (
                <div className="mb-4 p-4 rounded-2xl bg-rose-100/80 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 flex items-center gap-3 text-xs text-rose-900 dark:text-rose-200">
                  <Lock className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <div>
                    <p className="font-extrabold text-rose-950 dark:text-rose-100">Creación de publicaciones inhabilitada</p>
                    <p className="mt-0.5 text-rose-800 dark:text-rose-300">
                      Tu cuenta está suspendida en modo sólo lectura. No es posible crear publicaciones hasta que finalice el período de sanción.
                    </p>
                  </div>
                </div>
              ) : spamTimeout?.isBlocked ? (
                <div className="mb-4 p-4 rounded-2xl bg-amber-50/95 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700/60 flex items-start gap-3.5 text-xs text-amber-950 dark:text-amber-200 shadow-xs">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-extrabold text-xs uppercase tracking-wider border border-amber-500/30">
                        Advertencia de Moderación
                      </span>
                    </div>
                    <p className="font-extrabold text-amber-950 dark:text-amber-100 text-sm mt-1">
                      ⚠️ Pausa temporal por mensajes repetitivos (SPAM)
                    </p>
                    <p className="mt-1 text-amber-900 dark:text-amber-300 leading-relaxed">
                      Has repetido el mismo mensaje más de 3 veces o contenido muy similar. Para mantener la calidad de la comunidad, no puedes enviar publicaciones ni mensajes durante <strong>1 hora y 30 minutos</strong>.
                    </p>
                    <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-200 font-bold text-xs sm:text-sm border border-amber-500/30">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Tiempo restante: {spamTimeout.remainingText || "1h 30m"} (disponible a las {spamTimeout.formattedHour})</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Micro-Aviso de Convivencia y Seguridad Moderno */
                <div className="mb-4 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 flex items-center gap-3 text-sm sm:text-base text-emerald-800 dark:text-emerald-300 shadow-2xs">
                  <ShieldCheck className="w-5 sm:w-6 h-5 sm:h-6 text-emerald-500 shrink-0" />
                  <p className="leading-relaxed text-sm sm:text-base">
                    <strong className="font-extrabold">{t("Community.safe_space_title", "Espacio protegido CFH")}:</strong> {t("Community.safe_space_desc", "Mantén tu seguridad no compartiendo teléfonos personales ni acordando pagos por fuera de la plataforma.")}
                  </p>
                </div>
              )}

              {/* Indicador de cuota de publicidad semanal para Coaches */}
              {isCoach && canPromote && coachQuota && (
                <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-purple-500/10 to-pink-500/5 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-purple-900 dark:text-purple-200">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span>
                      Cuota semanal de anuncios (Plan {coachQuota.tierName}):{" "}
                      <strong>
                        {coachQuota.isUnlimited ? "Ilimitada" : `${coachQuota.usedThisWeek} de ${coachQuota.limit} usados`}
                      </strong>
                    </span>
                  </div>
                  {!coachQuota.isUnlimited && (
                    <span className={`font-bold px-2 py-0.5 rounded-full text-xs sm:text-sm self-start sm:self-auto ${coachQuota.remaining === 0 ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"}`}>
                      {coachQuota.remaining === 0 ? "Sin publicaciones restantes esta semana" : `${coachQuota.remaining} restantes`}
                    </span>
                  )}
                </div>
              )}

              {/* Error de seguridad o validación Anti-Bypass */}
              {safetyError && (
                <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start sm:items-center gap-2.5 text-xs text-rose-800 dark:text-rose-200 shadow-2xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
                  <div className="flex-1">
                    <p className="font-bold">Aviso de Seguridad</p>
                    <p className="mt-0.5">{safetyError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSafetyError(null)}
                    className="text-rose-400 hover:text-rose-600 p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {/* Aviso para Coach sin requisitos cumplidos */}
              {isCoach && !canPromote && (
                <div className="mb-4 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 flex items-start sm:items-center gap-3 text-amber-800 dark:text-amber-300 text-xs font-medium shadow-2xs">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <p className="font-bold text-amber-900 dark:text-amber-200">Requerimientos de publicación no cumplidos</p>
                    <p className="text-amber-700 dark:text-amber-400 mt-0.5">Requieres al menos 1 mes de antigüedad y 5 alumnos activos en la plataforma para poder autopromocionarte y publicar en la comunidad.</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-gray-200 dark:bg-slate-800 overflow-hidden ring-2 ring-emerald-500/30 ring-offset-2 ring-offset-white dark:ring-offset-slate-900">
                  {currentUserAvatar ? (
                    <img src={currentUserAvatar} alt="Mi Perfil" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <textarea 
                    disabled={isSuspended || Boolean(spamTimeout?.isBlocked) || (isCoach && !canPromote)}
                    onFocus={() => {
                      if (!currentUserId) openLogin();
                    }}
                    onClick={() => {
                      if (!currentUserId) openLogin();
                    }}
                    placeholder={
                      !currentUserId
                        ? "Inicia sesión para publicar tu consulta, interactuar o debatir en la comunidad..."
                        : isSuspended
                        ? "⛔ Creación de publicaciones bloqueada mientras tu cuenta se encuentre suspendida."
                        : spamTimeout?.isBlocked
                        ? `⏳ Envío pausado por SPAM: Podrás volver a enviar mensajes dentro de ${spamTimeout.remainingText || "1h 30m"}.`
                        : isCoach && !canPromote
                        ? "Requieres 1 mes de antigüedad y 5 alumnos activos para publicar en la comunidad."
                        : isCoach
                        ? "¿Qué quieres compartir sobre tus servicios o cursos? Publica un anuncio o actividad..."
                        : t("Community.post_placeholder", t("Community.post_placeholder", "¿Tienes alguna duda o pregunta? Escribe aquí tu consulta o usa #etiquetas..."))
                    }
                    maxLength={2000}
                    className="w-full bg-transparent resize-none outline-none text-gray-900 dark:text-slate-100 placeholder-gray-400 text-base sm:text-lg min-h-[90px] disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed"
                    value={newPostContent}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewPostContent(val);
                      // Detección reactiva de '@' para abrir autocompletado de coaches y cursos
                      const lastAtIdx = val.lastIndexOf("@");
                      if (lastAtIdx !== -1 && (lastAtIdx === 0 || /\s/.test(val.charAt(lastAtIdx - 1)))) {
                        const afterAt = val.slice(lastAtIdx + 1);
                        if (!/\s/.test(afterAt) && afterAt.length <= 25) {
                          setMentionSearchQuery(afterAt);
                          setMentionActiveTab((newPostType as string) === "REQ_REC_COURSE" ? "courses" : "coaches");
                          setMentionSearchOpen(true);
                          fetchMentionEntities(afterAt);
                        }
                      }
                    }}
                  />

                  {/* Character counter & draft auto-saved badge */}
                  <div className="flex items-center justify-between text-xs sm:text-sm text-gray-400 dark:text-slate-500 pt-1">
                    {hasTypedAnyPostContent && !isSuspended ? (
                      postSafetyCheck.isValid ? (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <Check className="w-3 h-3" /> Borrador guardado automáticamente
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-rose-500 dark:text-rose-400 font-bold" title={postSafetyCheck.reason}>
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {postSafetyCheck.reason || "Contenido restringido o no permitido"}
                        </span>
                      )
                    ) : (
                      <span></span>
                    )}
                    <span className={`font-mono ${newPostContent.length > 1800 ? "text-amber-500 font-bold" : ""} ${newPostContent.length >= 2000 ? "text-red-500 font-bold" : ""}`}>
                      {newPostContent.length}/2000
                    </span>
                  </div>

                  {/* Mentioned Entity Selected Badge */}
                  {selectedMention && (
                    <div className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-white dark:to-slate-800/80 border border-amber-500/30 text-xs mt-3 shadow-2xs w-full min-w-0">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-amber-500/20 flex items-center justify-center shrink-0 border border-amber-500/40 mt-0.5">
                          {selectedMention.avatarUrl ? (
                            <img src={selectedMention.avatarUrl} alt={selectedMention.name} className="w-full h-full object-cover" />
                          ) : selectedMention.type === "coach" ? (
                            <User className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-gray-900 dark:text-white truncate max-w-full">
                              @{selectedMention.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 uppercase tracking-wide shrink-0">
                              {selectedMention.type === "coach" ? "Coach Consultado" : "Curso Consultado"}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-300 mt-1 leading-relaxed break-words">
                            🔒 <strong>Respuestas verificadas:</strong> Solo los aprendices que hayan tomado clases o cursos con {selectedMention.name} podrán responder a esta publicación.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedMention(null)}
                        className="p-1 hover:bg-amber-500/20 text-gray-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Quitar mención"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Visual Poll Creator Card */}
                  <AnimatePresence>
                    {showPollCreator && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -6 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden mt-3 w-full min-w-0"
                      >
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 space-y-3 shadow-xs w-full min-w-0">
                          {/* Header */}
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                                <BarChart3 className="w-4 h-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-bold text-gray-900 dark:text-slate-100 truncate">
                                  Encuesta interactiva
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-slate-400 leading-snug">
                                  Configura tu pregunta y al menos 2 opciones de respuesta (sujetas al reglamento de seguridad)
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowPollCreator(false)}
                              className="text-xs sm:text-sm font-medium text-gray-400 hover:text-rose-500 dark:hover:text-rose-400 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                              title="Quitar encuesta"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Quitar</span>
                            </button>
                          </div>

                          {/* Poll Question Input */}
                          <div>
                            <input
                              type="text"
                              value={pollQuestion}
                              onChange={(e) => setPollQuestion(e.target.value)}
                              placeholder="Pregunta de la encuesta (ej. ¿Qué opinan de este tema?)..."
                              maxLength={120}
                              className={`w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all font-medium ${
                                !questionSafety.isValid
                                  ? "border-rose-500 ring-1 ring-rose-500/40 text-rose-900 dark:text-rose-200 bg-rose-50/40 dark:bg-rose-950/20"
                                  : "border-emerald-200/90 dark:border-emerald-800/60 focus:ring-emerald-500/30 focus:border-emerald-500"
                              }`}
                            />
                            {!questionSafety.isValid && (
                              <p className="text-xs sm:text-sm text-rose-600 dark:text-rose-400 flex items-center gap-1 font-semibold mt-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" /> {questionSafety.reason}
                              </p>
                            )}
                          </div>

                          {/* Options List */}
                          <div className="space-y-2">
                            {pollOptions.map((opt, idx) => {
                              const optSafety = optionsSafety[idx] || { isValid: true };
                              return (
                                <div key={idx} className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                                      !optSafety.isValid
                                        ? "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                    }`}>
                                      {idx + 1}
                                    </span>
                                    <input
                                      type="text"
                                      value={opt}
                                      onChange={(e) => {
                                        const next = [...pollOptions];
                                        next[idx] = e.target.value;
                                        setPollOptions(next);
                                      }}
                                      placeholder={
                                        idx === 0
                                          ? "Opción 1 (ej. Excelente idea)"
                                          : idx === 1
                                          ? "Opción 2 (ej. Mejorable)"
                                          : `Opción ${idx + 1}`
                                      }
                                      maxLength={80}
                                      className={`flex-1 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all ${
                                        !optSafety.isValid
                                          ? "border-rose-500 ring-1 ring-rose-500/40 text-rose-900 dark:text-rose-200 bg-rose-50/40 dark:bg-rose-950/20"
                                          : "border-gray-200 dark:border-slate-700 focus:ring-emerald-500/30 focus:border-emerald-500"
                                      }`}
                                    />
                                    {pollOptions.length > 2 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPollOptions((prev) => prev.filter((_, i) => i !== idx));
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                        title="Eliminar opción"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                  {!optSafety.isValid && (
                                    <p className="text-xs sm:text-sm text-rose-600 dark:text-rose-400 flex items-center gap-1 font-semibold ml-7">
                                      <AlertTriangle className="w-3 h-3 shrink-0" /> {optSafety.reason}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Add Option & Status */}
                          <div className="flex items-center justify-between pt-1">
                            {pollOptions.length < 5 ? (
                              <button
                                type="button"
                                onClick={() => setPollOptions((prev) => [...prev, ""])}
                                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition-all cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Agregar otra opción
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Máximo 5 opciones</span>
                            )}
                            <span className="text-xs font-medium text-gray-400">
                              {!questionSafety.isValid || firstInvalidOption ? (
                                <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-0.5">
                                  <AlertTriangle className="w-3 h-3" /> Infracción al reglamento
                                </span>
                              ) : pollOptions.filter((o) => o.trim()).length < 2 ? (
                                <span className="text-amber-600 dark:text-amber-400">Mínimo 2 opciones requeridas</span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                                  <Check className="w-3 h-3" /> Encuesta lista
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Previews for attached images */}
                  {newPostImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                      {newPostImages.map((file, idx) => (
                        <div key={idx} className="relative group w-20 h-20 rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-700 shadow-xs">
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt={`Preview ${idx + 1}`} 
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute top-1 right-1 w-5 h-5 bg-black/70 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="mt-4 pt-3.5 border-t border-gray-100 dark:border-slate-800/80 space-y-3.5 w-full min-w-0">
                    {/* Selector de Tipo de Publicación (Fila horizontal dedicada con scroll suave y sin saltos de texto) */}
                    <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto pb-1 sm:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      {isStudent ? (
                        <>
                          <button 
                            type="button"
                            disabled={isSuspended}
                            onClick={() => setNewPostType("DOUBT")}
                            className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl flex items-center gap-2 text-sm sm:text-base font-extrabold whitespace-nowrap shrink-0 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${newPostType === 'DOUBT' ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-sm shadow-blue-600/25 scale-[1.02]' : 'bg-blue-50/80 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60 hover:bg-blue-100/80'}`}
                          >
                            <HelpCircle className="w-4 sm:w-4.5 h-4 sm:h-4.5 shrink-0" />
                            <span>Pregunta</span>
                          </button>
                          <button 
                            type="button"
                            disabled={isSuspended}
                            onClick={() => setNewPostType("REQ_REC_COACH" as any)}
                            className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl flex items-center gap-2 text-sm sm:text-base font-extrabold whitespace-nowrap shrink-0 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${(newPostType as string) === "REQ_REC_COACH" ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm shadow-amber-500/25 scale-[1.02]' : 'bg-amber-50/80 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 hover:bg-amber-100/80'}`}
                          >
                            <Sparkles className="w-4 sm:w-4.5 h-4 sm:h-4.5 shrink-0" />
                            <span>{t("Community.looking_for_coach", "Busco Coach")}</span>
                          </button>
                          <button 
                            type="button"
                            disabled={isSuspended}
                            onClick={() => setNewPostType("REQ_REC_COURSE" as any)}
                            className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl flex items-center gap-2 text-sm sm:text-base font-extrabold whitespace-nowrap shrink-0 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${(newPostType as string) === "REQ_REC_COURSE" ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-600/25 scale-[1.02]' : 'bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 hover:bg-indigo-100/80'}`}
                          >
                            <Sparkles className="w-4 sm:w-4.5 h-4 sm:h-4.5 shrink-0" />
                            <span>{t("Community.looking_for_course", "Busco Curso")}</span>
                          </button>
                        </>
                      ) : canPromote ? (
                        <button 
                          type="button"
                          disabled={isSuspended}
                          onClick={() => setNewPostType("PROMOTION")}
                          className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl flex items-center gap-2 text-sm sm:text-base font-extrabold whitespace-nowrap shrink-0 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-sm shadow-purple-600/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Megaphone className="w-4 sm:w-4.5 h-4 sm:h-4.5 shrink-0" />
                          <span>Publicidad / Autopromoción</span>
                        </button>
                      ) : (
                        <span className="text-xs sm:text-sm text-amber-700 dark:text-amber-400 italic flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Publicación no disponible
                        </span>
                      )}
                    </div>

                    {/* Barra Inferior: Herramientas (Izquierda) + Botón Publicar (Derecha) */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-slate-800/60 w-full min-w-0">
                      <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                        {/* Multi-file input oculto */}
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          accept="image/jpeg,image/png,image/webp" 
                          multiple
                          disabled={isSuspended}
                          className="hidden" 
                          onChange={handleAddImages}
                        />
                        
                        {/* Botón Adjuntar Imagen */}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isSuspended || (isCoach && !canPromote) || newPostImages.length >= 4}
                          className="p-2.5 text-gray-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-2xl transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border border-transparent hover:border-emerald-500/20 shrink-0"
                          title={isSuspended ? "Inhabilitado por suspensión" : newPostImages.length >= 4 ? "Máximo 4 imágenes" : "Adjuntar imágenes (máx 4)"}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                          </svg>
                        </button>

                        {/* Botón Encuesta */}
                        <button
                          type="button"
                          onClick={() => {
                            if (!showPollCreator) {
                              if (pollOptions.length < 2) {
                                setPollOptions(["", ""]);
                              }
                              setShowPollCreator(true);
                            } else {
                              setShowPollCreator(false);
                            }
                          }}
                          disabled={isSuspended || (isCoach && !canPromote)}
                          className={`px-3.5 py-2 sm:py-2.5 rounded-2xl transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border flex items-center gap-2 text-sm sm:text-base font-extrabold shrink-0 whitespace-nowrap ${
                            showPollCreator
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-xs"
                              : "text-gray-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-slate-800 border-transparent hover:border-emerald-500/20"
                          }`}
                          title={isSuspended ? "Inhabilitado por suspensión" : showPollCreator ? "Cerrar encuesta" : "Crear encuesta interactiva"}
                        >
                          <BarChart3 className={`w-4.5 h-4.5 ${showPollCreator ? "text-emerald-600 dark:text-emerald-400" : "text-emerald-500"}`} />
                          <span>Encuesta</span>
                        </button>

                        {/* Botón Mencionar Coach/Curso */}
                        {isStudent && (
                          <button
                            type="button"
                            onClick={() => {
                              setMentionSearchOpen(true);
                              setMentionActiveTab((newPostType as string) === "REQ_REC_COURSE" ? "courses" : "coaches");
                              fetchMentionEntities("");
                            }}
                            disabled={isSuspended}
                            className={`px-3.5 py-2 sm:py-2.5 rounded-2xl transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border flex items-center gap-2 text-sm sm:text-base font-extrabold shrink-0 whitespace-nowrap ${
                              selectedMention
                                ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400 shadow-xs"
                                : "text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 border-transparent hover:border-amber-500/20"
                            }`}
                            title={selectedMention ? `Mencionado: @${selectedMention.name}` : "Mencionar a un Coach o Curso específico"}
                          >
                            <AtSign className={`w-4.5 h-4.5 ${selectedMention ? "text-amber-600 dark:text-amber-400" : "text-amber-500"}`} />
                            <span className="truncate max-w-[120px]">
                              {selectedMention ? `@${selectedMention.name.split(" ")[0]}` : "Mencionar"}
                            </span>
                          </button>
                        )}
                      </div>

                      {/* Botón Publicar Principal */}
                      <div className="flex items-center justify-end shrink-0">
                        <button 
                          onClick={handleCreatePost}
                          disabled={
                            isSuspended || 
                            Boolean(spamTimeout?.isBlocked) ||
                            isCreating || 
                            isUploadingImages || 
                            (isCoach && !canPromote) || 
                            !postSafetyCheck.isValid ||
                            (!newPostContent.trim() && newPostImages.length === 0 && !(showPollCreator && pollOptions.map((o) => o.trim()).filter(Boolean).length >= 2))
                          }
                          className={`px-6 sm:px-7 py-3 sm:py-3.5 disabled:opacity-50 disabled:cursor-not-allowed font-black text-sm sm:text-base rounded-2xl flex items-center gap-2.5 transition-all shadow-md cursor-pointer whitespace-nowrap shrink-0 w-full sm:w-auto justify-center ${
                            isSuspended
                              ? "bg-rose-200 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 shadow-none"
                              : spamTimeout?.isBlocked
                              ? "bg-amber-200 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 shadow-none cursor-not-allowed"
                              : isCoach && !canPromote
                              ? "bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-slate-500 shadow-none"
                              : isCoach
                              ? "bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white shadow-purple-600/25 hover:scale-[1.02] active:scale-[0.98]"
                              : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/25 hover:scale-[1.02] active:scale-[0.98]"
                          }`}
                        >
                          {isCreating || isUploadingImages ? (
                            <>
                              <Loader2 className="w-4 sm:w-5 h-4 sm:h-5 animate-spin" />
                              <span>Publicando...</span>
                            </>
                          ) : isSuspended ? (
                            <>
                              <Lock className="w-4 sm:w-5 h-4 sm:h-5" />
                              <span>Cuenta suspendida</span>
                            </>
                          ) : spamTimeout?.isBlocked ? (
                            <>
                              <Clock className="w-4 sm:w-5 h-4 sm:h-5" />
                              <span>Pausa por spam ({spamTimeout.remainingText || "1h 30m"})</span>
                            </>
                          ) : isCoach && !canPromote ? (
                            <span>Publicación restringida</span>
                          ) : (
                            <>
                              <Send className="w-4 sm:w-5 h-4 sm:h-5" /> 
                              <span>{isCoach ? "Publicar en coaches" : "Publicar pregunta"}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feed List */}
            <div className="flex flex-col gap-4">
              {visiblePosts.length === 0 ? (
                /* Empty States */
                <div className="text-center py-14 px-6 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
                  {searchQuery.trim() ? (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400">
                        <Search className="w-8 h-8" />
                      </div>
                      <h4 className="text-base font-bold text-gray-800 dark:text-slate-100 mb-1.5">
                        No encontramos resultados para &ldquo;{searchQuery}&rdquo;
                      </h4>
                      <p className="text-gray-500 dark:text-slate-400 text-xs max-w-md mx-auto leading-relaxed mb-5">
                        Intenta buscar con otras palabras clave o explora todías las categorías de la comunidad.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          loadFilteredPosts(filter, activeTab, "", selectedTag);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cfh-dark-green hover:bg-[#061528] text-white text-xs font-bold transition-all shadow-xs"
                      >
                        <X className="w-3.5 h-3.5" /> Limpiar búsqueda
                      </button>
                    </>
                  ) : activeTab === "DOUBT" ? (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                        <HelpCircle className="w-8 h-8" />
                      </div>
                      <h4 className="text-base font-bold text-gray-800 dark:text-slate-100 mb-1.5">
                        No hay preguntas pendientes
                      </h4>
                      <p className="text-gray-500 dark:text-slate-400 text-xs max-w-md mx-auto leading-relaxed mb-5">
                        La comunidad está al día con sus dudías. ¿Tienes alguna pregunta sobre tus cursos, sesiones o ejercicios? ¡Sé el primero en preguntar!
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("ALL");
                          loadFilteredPosts(filter, "ALL", searchQuery, selectedTag);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-xs font-bold transition-all"
                      >
                        Ver todías las publicaciones
                      </button>
                    </>
                  ) : activeTab === "PROMOTION" ? (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                        <Megaphone className="w-8 h-8" />
                      </div>
                      <h4 className="text-base font-bold text-gray-800 dark:text-slate-100 mb-1.5">
                        No hay anuncios en este momento
                      </h4>
                      <p className="text-gray-500 dark:text-slate-400 text-xs max-w-md mx-auto leading-relaxed mb-5">
                        Pronto los coaches certificados publicarán talleres, actividades y novedades exclusivas para ti.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("ALL");
                          loadFilteredPosts(filter, "ALL", searchQuery, selectedTag);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs"
                      >
                        Ver publicaciones de la comunidad
                      </button>
                    </>
                  ) : filter === "LOCAL" ? (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/60 text-cfh-dark-green dark:text-cfh-light-green">
                        <MapPin className="w-8 h-8" />
                      </div>
                      <h4 className="text-base font-bold text-gray-800 dark:text-slate-100 mb-1.5">
                        No hay publicaciones en tu región todavía
                      </h4>
                      <p className="text-gray-500 dark:text-slate-400 text-xs max-w-md mx-auto leading-relaxed mb-5">
                        Sé el primero en conectar con estudiantes y coaches de tu localidad o explora la comunidad global.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setFilter("GLOBAL");
                          loadFilteredPosts(filter, activeTab, searchQuery, selectedTag);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cfh-dark-green hover:bg-[#061528] text-white text-xs font-bold transition-all shadow-xs"
                      >
                        Explorar comunidad global
                      </button>
                    </>
                  ) : selectedTag ? (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/60 text-cfh-dark-green dark:text-cfh-light-green">
                        <Hash className="w-8 h-8" />
                      </div>
                      <h4 className="text-base font-bold text-gray-800 dark:text-slate-100 mb-1.5">
                        No hay publicaciones con el tema #{selectedTag.replace(/^#/, "")}
                      </h4>
                      <p className="text-gray-500 dark:text-slate-400 text-xs max-w-md mx-auto leading-relaxed mb-5">
                        No se encontraron publicaciones con esta etiqueta en este momento.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTag(null);
                          loadFilteredPosts(filter, activeTab, searchQuery, null, sortBy);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cfh-dark-green hover:bg-[#061528] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" /> Limpiar filtro
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/60 text-cfh-dark-green dark:text-cfh-light-green">
                        <Users className="w-8 h-8" />
                      </div>
                      <h4 className="text-base font-bold text-gray-800 dark:text-slate-100 mb-1.5">
                        ¡Bienvenido a la Comunidad!
                      </h4>
                      <p className="text-gray-500 dark:text-slate-400 text-xs max-w-md mx-auto leading-relaxed mb-2">
                        Aún no hay publicaciones en esta sección. Comparte una pregunta, duda o experiencia para comenzar la conversación.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                visiblePosts.map((post) => {
                  const postImages = getPostImages(post);
                  const typeConfig: PostTypeStyle = (post.postType && POST_TYPE_CONFIG[post.postType]) || DEFAULT_POST_TYPE;
                  const TypeIcon = typeConfig.icon;

                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={post.id} 
                      id={`post-${post.id}`}
                      className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl p-6 shadow-sm border border-gray-200/80 dark:border-slate-800/80 hover:border-emerald-500/30 hover:shadow-md transition-all duration-200"
                    >
                      {/* Post Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-3 items-center">
                          {(post.author?.role === "COACH" && (post.postType === "PROMOTION" || post.postType === "ANNOUNCEMENT")) ? (
                            <CoachHoverCard coach={post.author!}>
                              <div className="flex gap-3 items-center cursor-pointer group">
                                <div className="shrink-0 relative">
                                  <img 
                                    src={post.author?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author?.name)}&background=7c3aed&color=fff`} 
                                    alt={post.author?.name} 
                                    className="w-11 h-11 rounded-full object-cover ring-2 ring-purple-500/30 group-hover:ring-purple-500 transition-all"
                                  />
                                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs sm:text-xs font-bold shadow-xs">
                                    ✓
                                  </span>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-gray-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                      {post.author?.name}
                                    </span>
                                    <span className="text-xs uppercase font-black tracking-wider px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                                      Coach
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500">
<span>{timeAgo(post.createdAt)}</span>
                                      {post.author?.region && (
                                      <>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                          <MapPin className="w-3 h-3" />
                                          {post.author?.region}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CoachHoverCard>
                          ) : (
                            <>
                              <Link href={`/comunidad/perfil/${post.author?.id}`} className="shrink-0 group">
                                <img 
                                  src={post.author?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author?.name)}&background=047857&color=fff`} 
                                  alt={post.author?.name} 
                                  className="w-11 h-11 rounded-full object-cover ring-2 ring-emerald-500/20 group-hover:ring-emerald-500 transition-all"
                                />
                              </Link>
                              <div>
                                <div className="flex items-center gap-2">
                                  <Link 
                                    href={`/comunidad/perfil/${post.author?.id}`}
                                    className="font-bold text-sm text-gray-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                  >
                                    {post.author?.name}
                                  </Link>
                                  <span className={`text-xs uppercase font-black tracking-wider px-2.5 py-0.5 rounded-full ${
                                    post.author?.role === "ADMIN"
                                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60"
                                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
                                  }`}>
                                    {post.author?.role === "ADMIN" ? "Admin" : "Aprendiz"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500">
<span>{timeAgo(post.createdAt)}</span>
                                      {post.author?.region && (
                                    <>
                                      <span>•</span>
                                      <span className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {post.author?.region}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Post Type Badge */}
                          <span className={`px-2.5 py-1 text-xs font-bold rounded-full flex items-center gap-1 border ${typeConfig.badgeClasses}`}>
                            <TypeIcon className="w-3 h-3" />
                            <span>{typeConfig.label}</span>
                          </span>

                          {/* Resuelta Badge */}
                          {post.isResolved && (
                            <span className="px-2.5 py-1 text-xs font-bold rounded-full flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800 shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Resuelta</span>
                            </span>
                          )}
                          
                          {/* 3-dots Dropdown Menu */}
                          <div className="relative post-menu-container">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuPostId(openMenuPostId === post.id ? null : post.id);
                              }}
                              className="post-menu-btn p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                              aria-label="Opciones de publicación"
                            >
                              <MoreHorizontal className="w-4 h-4" />
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
                                  <Link
                                    href={`/comunidad/post/${post.id}`}
                                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>Ver hilo completo</span>
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyLink(post.id)}
                                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
                                  >
                                    {copiedPostId === post.id ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                                        <span className="text-emerald-500 font-semibold">¡Enlace copiado!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Share2 className="w-3.5 h-3.5" />
                                        <span>Copiar enlace</span>
                                      </>
                                    )}
                                  </button>

                                  {!isSuspended && currentUserId === post.author?.id && (
                                    <>
                                      <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />
                                      {(() => {
                                        const { canEdit, remainingMinutes } = canEditPostOrComment(post.createdAt, 15);
                                        if (canEdit) {
                                          return (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingPostId(post.id);
                                                setEditPostContent(post.content);
                                                setOpenMenuPostId(null);
                                              }}
                                              className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
                                            >
                                              <div className="flex items-center gap-2.5">
                                                <Pencil className="w-3.5 h-3.5" />
                                                <span>Editar publicación</span>
                                              </div>
                                              <span className="text-xs text-amber-600 dark:text-amber-400 font-mono font-bold">{remainingMinutes}m</span>
                                            </button>
                                          );
                                        }
                                        return (
                                          <div className="px-4 py-1.5 text-xs sm:text-sm text-gray-400 dark:text-slate-500 italic">
                                            Edición expirada (máx. 15 min)
                                          </div>
                                        );
                                      })()}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDeletingPostId(post.id);
                                          setOpenMenuPostId(null);
                                        }}
                                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-medium text-left"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Eliminar publicación</span>
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
                                          setOpenMenuPostId(null);
                                          setReportReason("Spam o publicidad no deseada");
                                          setReportDetails("");
                                          setReportFeedback(null);
                                          setReportingPost(post);
                                        }}
                                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-medium text-left"
                                      >
                                        <Flag className="w-3.5 h-3.5" />
                                        <span>Reportar publicación</span>
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
                      {editingPostId === post.id ? (
                        <div className="mb-4">
                          {editPostError[post.id] && (
                            <div className="p-3 mb-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl text-red-700 dark:text-red-300 text-xs font-medium flex items-start gap-2 animate-in fade-in duration-200">
                              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                              <span>{editPostError[post.id]}</span>
                            </div>
                          )}
                          <textarea
                            value={editPostContent}
                            onChange={(e) => setEditPostContent(e.target.value)}
                            className="w-full min-h-[100px] p-3 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cfh-dark-green outline-none resize-y"
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button 
                              onClick={() => {
                                setEditingPostId(null);
                                setEditPostError((prev) => ({ ...prev, [post.id]: "" }));
                              }} 
                              className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
                            >
                              Cancelar
                            </button>
                            <button 
                              onClick={() => submitEditPost(post.id)} 
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-cfh-dark-green hover:bg-emerald-600 rounded-lg"
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      ) : (() => {
                        const poll = parsePoll(post.content);
                        const cleanContent = post.content.replace(/\[POLL:\s*"?([^":|]+)"?\s*[:|]\s*(.+?)\]/gs, "").trim();
                        const isBlockedToInteract = Boolean(
                          post.mentionedEntity &&
                          (post.canComment === false || postCommentPermissions[post.id]?.canComment === false)
                        );
                        const userVote = isBlockedToInteract ? undefined : pollVotes[post.id];
                        const hasVoted = userVote !== undefined;
                        const blockReason =
                          postCommentPermissions[post.id]?.reason ||
                          post.commentReason ||
                          (post.mentionedEntity?.type === "coach"
                            ? `🔒 Respuestas reservadas: Solo los estudiantes que han tomado clases o cursos con @${post.mentionedEntity.name} pueden votar o responder en esta consulta.`
                            : `🔒 Respuestas reservadas: Solo los estudiantes inscritos en el curso "${post.mentionedEntity?.name}" pueden votar o responder en esta consulta.`);

                        return (
                          <div className="mb-3 space-y-3">
                            {cleanContent && (
                              <CodeSnippetRenderer content={cleanContent} onHashtagClick={(tag) => {
                                setSelectedTag(tag);
                                setShowOnlyMyPosts(false);
                                setShowOnlySaved(false);
                                loadFilteredPosts(filter, activeTab, searchQuery, tag, sortBy);
                              }} />
                            )}

                            {/* Poll Card if present */}
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
                                              setSafetyError(blockReason);
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
                                              <span className="text-xs sm:text-sm font-bold text-gray-500 dark:text-slate-400 shrink-0">
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
                      
                      {/* Attached Media with PostMediaMasonry Component */}
                      {postImages.length > 0 && (
                        <div className="mb-3">
                          <PostMediaMasonry 
                            images={postImages} 
                            onOpenLightbox={openLightbox} 
                          />
                        </div>
                      )}
                      
                      

                      {/* Mentioned Coach/Course Card */}
                      {post.mentionedEntity && (
                        <div className="mb-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-amber-50/20 dark:from-slate-800/90 dark:via-slate-800/60 dark:to-slate-900 border border-amber-500/30 shadow-xs">
                          <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-11 h-11 rounded-2xl overflow-hidden bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-2xs">
                                {post.mentionedEntity.avatarUrl ? (
                                  <img 
                                    src={post.mentionedEntity.avatarUrl} 
                                    alt={post.mentionedEntity.name} 
                                    className="w-full h-full object-cover" 
                                  />
                                ) : post.mentionedEntity.type === "coach" ? (
                                  <User className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                ) : (
                                  <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-black text-sm text-gray-900 dark:text-white">
                                    {post.mentionedEntity.name}
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-800 dark:text-amber-300">
                                    <AtSign className="w-2.5 h-2.5" />
                                    {post.mentionedEntity.type === "coach" ? "Coach Consultado" : "Curso Consultado"}
                                  </span>
                                </div>
                                {post.mentionedEntity.headline && (
                                  <p className="text-xs text-gray-600 dark:text-slate-300 line-clamp-1 mt-0.5">
                                    {post.mentionedEntity.headline}
                                  </p>
                                )}
                                <div className="flex items-center gap-1.5 mt-1 text-xs sm:text-sm font-semibold text-amber-800 dark:text-amber-300">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span>
                                    {post.mentionedEntity.type === "coach"
                                      ? `Respuestas verificadas de alumnos de @${post.mentionedEntity.name.split(" ")[0]}`
                                      : `Respuestas verificadas de alumnos inscritos en este curso`}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <Link
                              href={post.mentionedEntity.type === "coach" ? `/coaches/${post.mentionedEntity.slug || post.mentionedEntity.id}` : `/cursos/${post.mentionedEntity.slug || post.mentionedEntity.id}`}
                              className="shrink-0 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-amber-900 dark:text-amber-200 border border-amber-500/30 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
                            >
                              <span>{post.mentionedEntity.type === "coach" ? "Ver Perfil" : "Ver Curso"}</span>
                              <ArrowRight className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            </Link>
                          </div>
                        </div>
                      )}

                      {/* Banner para Coaches: Ofrecer Asesoría en posts REQ_REC_COACH */}
                      {isCoach && (post.postType as string) === "REQ_REC_COACH" && (
                        <div className="mb-3 p-3 rounded-2xl bg-gradient-to-r from-purple-500/10 via-fuchsia-500/10 to-transparent border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                              <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-900 dark:text-white">
                                ¿Puedes ayudar a este alumno?
                              </p>
                              <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
                                Ofrece una asesoría personalizada respondiendo a sus dudas.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (expandedPostId !== post.id) toggleComments(post.id);
                              setNewComment(`¡Hola @${post.author?.name}! Me especializo en este tema y tengo total disponibilidad para ayudarte en una sesión personalizada.`);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-xs font-extrabold hover:from-purple-500 hover:to-fuchsia-500 transition-all shadow-xs cursor-pointer whitespace-nowrap self-start sm:self-auto"
                          >
                            Ofrecer Asesoría
                          </button>
                        </div>
                      )}
                      
                      {/* Action Buttons Footer */}
                      <div className="flex items-center gap-3 sm:gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-slate-800 flex-wrap">
                          {/* Like Button */}
                          <button 
                            type="button"
                            disabled={(post as any).isLiking}
                            onClick={() => handleToggleLike(post.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors text-xs sm:text-sm font-extrabold ${
                              post.hasLiked 
                                ? "bg-red-50 dark:bg-red-900/20 text-red-500" 
                                : "hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-500 hover:text-red-500"
                            } ${(post as any).isLiking ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <Heart className={`w-4 h-4 ${post.hasLiked ? "fill-current" : ""}`} />
                            <span>{post._count.likes}</span>
                          </button>

                        {/* Comment Button */}
                        <button 
                          type="button"
                          onClick={() => toggleComments(post.id)}
                          className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-extrabold transition-colors ${
                            expandedPostId === post.id 
                              ? "text-cfh-dark-green dark:text-cfh-light-green" 
                              : "text-gray-500 hover:text-cfh-light-green"
                          }`}
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>{post._count.comments} comentarios</span>
                        </button>

                        {/* Recommend Coach Button (DER-125) - Only for Doubt Posts & Students */}
                        {isStudent && !isSuspended && (post.postType as string) === "REQ_REC_COACH" && (
                          <button
                            type="button"
                            onClick={() => handleOpenRecommendModal(post.id)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-xs sm:text-sm font-extrabold hover:bg-amber-100 transition-colors"
                            title="Recomienda a un coach que pueda responder esta duda"
                          >
                            <Star className="w-3.5 h-3.5 fill-current text-amber-500" />
                            <span>Recomendar Coach</span>
                          </button>
                        )}

                        {/* Recommend Course Button (DER-130) */}
                        {isStudent && !isSuspended && (post.postType as string) === "REQ_REC_COURSE" && (
                          <button
                            type="button"
                            onClick={() => handleOpenRecommendCourseModal(post.id)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-xs sm:text-sm font-extrabold hover:bg-indigo-100 transition-colors"
                            title="Recomienda un curso en el que te hayas inscrito"
                          >
                            <Sparkles className="w-3.5 h-3.5 fill-current text-indigo-500" />
                            <span>Recomendar Curso</span>
                          </button>
                        )}

                        {/* Direct Booking CTA for Promotion Posts */}
                        {isStudent && post.postType === "PROMOTION" && (
                          <Link
                            href={`/coaches/${post.author?.id}?book=true`}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-cfh-dark-green hover:bg-[#061528] text-white text-xs font-extrabold shadow-xs transition-all hover:scale-105"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>Agendar con {post.author?.name}</span>
                          </Link>
                        )}

                        {/* Bookmark / Guardar Post */}
                        <button
                          type="button"
                          onClick={() => handleToggleSavePost(post.id)}
                          title={savedPostIds.includes(post.id) ? "Quitar de guardados" : "Guardar publicación"}
                          className={`p-1.5 rounded-full transition-colors cursor-pointer ml-auto ${
                            savedPostIds.includes(post.id)
                              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                              : "text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          {savedPostIds.includes(post.id) ? (
                            <BookmarkCheck className="w-4 h-4 fill-current text-emerald-500" />
                          ) : (
                            <Bookmark className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {/* Comments Expansion Drawer */}
                      {expandedPostId === post.id && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }} 
                          animate={{ opacity: 1, height: "auto" }} 
                          className="mt-3.5 border-t border-gray-100 dark:border-slate-800 pt-3"
                        >
                          {/* Header: Conteo y botón Ocultar */}
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-slate-800/80">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
                                Comentarios
                              </span>
                              <span className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.2 rounded-full">
                                {postComments.length}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setExpandedPostId(null)}
                              className="text-xs sm:text-sm font-semibold text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                            >
                              Ocultar
                            </button>
                          </div>

                          {/* Comments List (Contenedor estilo Instagram/Threads con scroll interno para evitar que se desborde infinitamente) */}
                          <div className="space-y-3 mb-3 max-h-[260px] sm:max-h-[300px] overflow-y-auto pr-1 overscroll-contain [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full divide-y divide-gray-100/60 dark:divide-slate-800/40">
                            {isLoadingComments ? (
                              <div className="py-6 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-cfh-light-green" />
                                <span>Cargando comentarios...</span>
                              </div>
                            ) : postComments.length === 0 ? (
                              <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-4">
                                No hay comentarios aún. ¡Sé el primero en responder!
                              </p>
                            ) : (
                            [...postComments]
                              .sort((a, b) => (a.id === post.resolvedCommentId ? -1 : b.id === post.resolvedCommentId ? 1 : 0))
                              .map((comment) => {
                              const isResolvedComment = post.resolvedCommentId === comment.id;
                              const cBadge = commentRoleBadge(comment.author?.role);
                              const authorName = comment.author?.name || "Usuario";
                              const avatarUrl = comment.author?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}`;

                              return (
                                <div 
                                  key={comment.id} 
                                  className={`pt-2.5 first:pt-0 pb-1 transition-colors ${
                                    isResolvedComment
                                      ? "bg-emerald-50/50 dark:bg-emerald-950/25 p-2.5 rounded-xl border border-emerald-200/70 dark:border-emerald-800/60 shadow-2xs"
                                      : ""
                                  }`}
                                >
                                  <div className="flex items-start gap-2.5">
                                    {comment.author?.role === "COACH" ? (
                                      <CoachHoverCard coach={comment.author}>
                                        <div className="shrink-0 pt-0.5 cursor-pointer">
                                          <img 
                                            src={avatarUrl} 
                                            alt={authorName} 
                                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-1 ring-purple-500/40"
                                          />
                                        </div>
                                      </CoachHoverCard>
                                    ) : (
                                      <Link href={comment.author?.id ? `/comunidad/perfil/${comment.author.id}` : "#"} className="shrink-0 pt-0.5">
                                        <img 
                                          src={avatarUrl} 
                                          alt={authorName} 
                                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-1 ring-gray-200 dark:ring-slate-700"
                                        />
                                      </Link>
                                    )}

                                    <div className="flex-1 min-w-0">
                                      {/* Header: Nombre + Badge + Tiempo */}
                                      <div className="flex items-baseline gap-1.5 flex-wrap leading-tight">
                                        {comment.author?.role === "COACH" ? (
                                          <CoachHoverCard coach={comment.author}>
                                            <span className="font-bold text-xs text-gray-900 dark:text-slate-100 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer">
                                              {authorName}
                                            </span>
                                          </CoachHoverCard>
                                        ) : (
                                          <Link 
                                            href={comment.author?.id ? `/comunidad/perfil/${comment.author.id}` : "#"}
                                            className="font-bold text-xs text-gray-900 dark:text-slate-100 hover:text-cfh-light-green transition-colors"
                                          >
                                            {authorName}
                                          </Link>
                                        )}
                                        <span className={`text-xs sm:text-xs font-extrabold px-1.5 py-0.2 rounded uppercase tracking-wider ${cBadge.classes}`}>
                                          {cBadge.label}
                                        </span>
                                        {isResolvedComment && (
                                          <span className="inline-flex items-center gap-0.5 text-xs sm:text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded border border-emerald-300/60 dark:border-emerald-700/60 uppercase tracking-wider">
                                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" /> Solución
                                          </span>
                                        )}
                                        <span className="text-xs text-gray-400 dark:text-slate-500 font-normal">
                                          · {timeAgo(comment.createdAt)}
                                        </span>
                                      </div>

                                      {/* Solución verificada banner */}
                                      {isResolvedComment && (
                                        <div className="my-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/30 flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                          <span>✨ Solución verificada por el autor</span>
                                        </div>
                                      )}

                                      {/* Comment Text or Edit Input */}
                                      {editingCommentId === comment.id ? (
                                        <div className="mt-1.5">
                                          {editCommentError[comment.id] && (
                                            <div className="p-2 mb-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg text-red-700 dark:text-red-300 text-xs sm:text-sm font-medium flex items-start gap-1.5 animate-in fade-in duration-200">
                                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                                              <span>{editCommentError[comment.id]}</span>
                                            </div>
                                          )}
                                          <textarea
                                            value={editCommentText}
                                            onChange={(e) => setEditCommentText(e.target.value)}
                                            className="w-full text-xs p-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-cfh-light-green"
                                            rows={2}
                                          />
                                          <div className="flex justify-end gap-1.5 mt-1">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingCommentId(null);
                                                setEditCommentError((prev) => ({ ...prev, [comment.id]: "" }));
                                              }}
                                              className="px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded cursor-pointer"
                                            >
                                              Cancelar
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => submitEditComment(comment.id)}
                                              className="px-2.5 py-0.5 text-xs text-white bg-cfh-dark-green hover:bg-[#061528] rounded font-bold cursor-pointer transition-colors"
                                            >
                                              Guardar
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        (() => {
                                          const match = comment.content.match(/\[REC_COURSE:({.*})\]$/);
                                          let cleanContent = comment.content;
                                          let recommendedCourse = null;
                                          if (match) {
                                            try {
                                              recommendedCourse = JSON.parse(match[1]);
                                              cleanContent = comment.content.replace(match[0], '').trim();
                                            } catch(e) {}
                                          }

                                          return (
                                            <>
                                              <div className="mt-1 text-xs">
                                                <CodeSnippetRenderer content={cleanContent} onHashtagClick={(tag) => {
                                setSelectedTag(tag);
                                setShowOnlyMyPosts(false);
                                setShowOnlySaved(false);
                                loadFilteredPosts(filter, activeTab, searchQuery, tag, sortBy);
                              }} />
                                              </div>

                                              {/* Recommended Course Card within Comment */}
                                              {recommendedCourse && (
                                                <div className="mt-2 p-2.5 rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 border border-indigo-200/70 dark:border-indigo-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs">
                                                  <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-800 shrink-0 border border-indigo-300 dark:border-indigo-700">
                                                      {recommendedCourse.thumbnailUrl ? (
                                                        <img src={recommendedCourse.thumbnailUrl} alt={recommendedCourse.title} className="w-full h-full object-cover" />
                                                      ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                          <BookOpen className="w-5 h-5 text-indigo-400" />
                                                        </div>
                                                      )}
                                                    </div>
                                                    <div className="min-w-0">
                                                      <div className="flex items-center gap-1">
                                                        <span className="text-xs sm:text-xs font-extrabold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-0.5">
                                                          <Sparkles className="w-2.5 h-2.5 fill-current text-indigo-500" /> Curso Recomendado
                                                        </span>
                                                      </div>
                                                      <h6 className="font-bold text-xs text-gray-900 dark:text-white truncate">
                                                        {recommendedCourse.title}
                                                      </h6>
                                                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-xs">
                                                        Por {recommendedCourse.coachName}
                                                      </p>
                                                    </div>
                                                  </div>

                                                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                                    <Link
                                                      href={`/cursos/${recommendedCourse.id}`}
                                                      className="px-2.5 py-1 rounded-full bg-cfh-dark-green hover:bg-[#061528] text-white text-xs font-bold shadow-xs whitespace-nowrap flex items-center gap-1"
                                                    >
                                                      <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                                                      <span>Ver Curso</span>
                                                    </Link>
                                                  </div>
                                                </div>
                                              )}
                                            </>
                                          );
                                        })()
                                      )}

                                      {/* Recommended Coach Card within Comment */}
                                      {comment.recommendedCoach && (
                                        <div className="mt-2 p-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-emerald-50 dark:from-amber-950/30 dark:to-emerald-950/30 border border-amber-200/70 dark:border-amber-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <img
                                              src={comment.recommendedCoach.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.recommendedCoach.name)}`}
                                              alt={comment.recommendedCoach.name}
                                              className="w-8 h-8 rounded-full object-cover border border-amber-400 shrink-0"
                                            />
                                            <div className="min-w-0">
                                              <div className="flex items-center gap-1">
                                                <span className="text-xs sm:text-xs font-extrabold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-0.5">
                                                  <Star className="w-2.5 h-2.5 fill-current text-amber-500" /> Coach Recomendado
                                                </span>
                                              </div>
                                              <h6 className="font-bold text-xs text-gray-900 dark:text-white truncate">
                                                {comment.recommendedCoach.name}
                                              </h6>
                                              <p className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-xs">
                                                {comment.recommendedCoach.coachProfile?.headline || "Mentor especialista"}
                                              </p>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                            <Link
                                              href={`/coaches/${comment.recommendedCoach.coachProfile?.slug || comment.recommendedCoach.id}`}
                                              className="px-2.5 py-1 rounded-full border border-gray-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 text-xs font-bold shadow-xs whitespace-nowrap"
                                            >
                                              Ver Perfil
                                            </Link>
                                            <Link
                                              href={`/coaches/${comment.recommendedCoach.id}?book=true`}
                                              className="px-2.5 py-1 rounded-full bg-cfh-dark-green hover:bg-[#061528] text-white text-xs font-bold shadow-xs whitespace-nowrap flex items-center gap-1"
                                            >
                                              <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                                              <span>Agendar</span>
                                            </Link>
                                          </div>
                                        </div>
                                      )}

                                      {/* Action Row of Comment: Like, Responder, Marcar Solución, Menú Autor */}
                                      <div className="flex items-center gap-3.5 mt-1.5 text-xs sm:text-sm text-gray-400 dark:text-slate-500">
                                        {/* Like Comment Button */}
                                        <button
                                          type="button"
                                          onClick={() => handleToggleCommentLike(comment.id)}
                                          disabled={isSuspended}
                                          title={isSuspended ? "Inhabilitado: Tu cuenta está en modo sólo lectura" : "Me gusta"}
                                          className={`flex items-center gap-1 font-semibold transition-colors ${
                                            isSuspended
                                              ? "opacity-40 cursor-not-allowed text-gray-400"
                                              : comment.hasLiked 
                                              ? "text-red-500 cursor-pointer" 
                                              : "hover:text-red-500 cursor-pointer"
                                          }`}
                                        >
                                          <Heart className={`w-3 h-3 ${comment.hasLiked ? "fill-current text-red-500" : ""}`} />
                                          <span>{comment.likesCount ?? comment._count?.likes ?? 0}</span>
                                        </button>

                                        {/* Reply Button */}
                                        {isStudent && !isSuspended && (
                                          <button
                                            type="button"
                                            onClick={() => handleStartReply(comment)}
                                            className="font-semibold hover:text-gray-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                          >
                                            Responder
                                          </button>
                                        )}

                                        {/* Mark as Solution Button (Author of consultation post) */}
                                        {!isSuspended && currentUserId === post.author?.id && (post.postType === "DOUBT" || (post.postType as string) === "REQ_REC_COACH" || (post.postType as string) === "REQ_REC_COURSE") && (
                                          <button
                                            type="button"
                                            onClick={() => handleMarkResolved(post.id, comment.id)}
                                            className={`flex items-center gap-1 font-bold text-xs px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                                              isResolvedComment
                                                ? "bg-emerald-600 text-white shadow-2xs"
                                                : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                            }`}
                                            title={isResolvedComment ? "Quitar solución marcada" : "Marcar este comentario como la solución a tu duda"}
                                          >
                                            <CheckCircle2 className="w-3 h-3" />
                                            <span>{isResolvedComment ? "Solución" : "Marcar solución"}</span>
                                          </button>
                                        )}

                                        {/* Menú de autor (Editar / Eliminar) */}
                                        {!isSuspended && currentUserId === comment.author?.id && (
                                          <div className="relative comment-menu-container ml-auto">
                                            <button 
                                              type="button"
                                              onClick={() => setOpenCommentMenuId(openCommentMenuId === comment.id ? null : comment.id)}
                                              className="comment-menu-btn text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5 rounded-full transition-colors cursor-pointer"
                                            >
                                              <MoreHorizontal className="w-3.5 h-3.5" />
                                            </button>
                                            
                                            <AnimatePresence>
                                              {openCommentMenuId === comment.id && (
                                                <motion.div
                                                  initial={{ opacity: 0, scale: 0.95 }}
                                                  animate={{ opacity: 1, scale: 1 }}
                                                  exit={{ opacity: 0, scale: 0.95 }}
                                                  className="absolute right-0 bottom-full mb-1 w-44 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-800 py-1.5 z-20"
                                                >
                                                  {(() => {
                                                    const { canEdit, remainingMinutes } = canEditPostOrComment(comment.createdAt, 15);
                                                    if (canEdit) {
                                                      return (
                                                        <button
                                                          type="button"
                                                          onClick={() => { 
                                                            setEditingCommentId(comment.id); 
                                                            setEditCommentText(comment.content); 
                                                            setOpenCommentMenuId(null); 
                                                          }}
                                                          className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                                                        >
                                                          <div className="flex items-center gap-2">
                                                            <Pencil className="w-3 h-3 text-gray-400" />
                                                            <span>Editar</span>
                                                          </div>
                                                          <span className="text-xs text-amber-600 dark:text-amber-400 font-mono font-bold">{remainingMinutes}m</span>
                                                        </button>
                                                      );
                                                    }
                                                    return (
                                                      <div className="px-3 py-1 text-xs sm:text-sm text-gray-400 dark:text-slate-500 italic">
                                                        Edición expirada (máx 15 min)
                                                      </div>
                                                    );
                                                  })()}
                                                  <button
                                                    type="button"
                                                    onClick={() => { 
                                                      setDeletingComment({ commentId: comment.id, postId: post.id });
                                                      setOpenCommentMenuId(null); 
                                                    }}
                                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left cursor-pointer"
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                    <span>Eliminar</span>
                                                  </button>
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* New Comment Input */}
                        {isSuspended ? (
                          <div className="mt-2 p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/40 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
                            <Lock className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                            <span>No puedes comentar ni responder mientras tu cuenta permanezca suspendida.</span>
                          </div>
                        ) : spamTimeout?.isBlocked ? (
                          <div className="mt-2 p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                            <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                            <span>Envío de mensajes pausado por SPAM: Podrás comentar dentro de <strong>{spamTimeout.remainingText || "1h 30m"}</strong>.</span>
                          </div>
                        ) : post.mentionedEntity && (post.canComment === false || postCommentPermissions[post.id]?.canComment === false) ? (
                          <div className="mt-2 p-3.5 rounded-2xl bg-amber-50/70 dark:bg-slate-800/90 border border-amber-500/30 flex items-start gap-3 text-xs shadow-xs">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                              <Lock className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <p className="font-extrabold text-gray-900 dark:text-white">
                                Respuestas reservadas para alumnos verificados
                              </p>
                              <p className="text-gray-600 dark:text-slate-300 mt-0.5 text-xs sm:text-sm leading-relaxed">
                                {postCommentPermissions[post.id]?.reason ||
                                  post.commentReason ||
                                  (post.mentionedEntity.type === "coach"
                                    ? `Solo los estudiantes que han tomado clases o cursos con @${post.mentionedEntity.name} pueden compartir su experiencia en esta consulta.`
                                    : `Solo los estudiantes inscritos en el curso "${post.mentionedEntity.name}" pueden compartir su experiencia.`)}
                              </p>
                            </div>
                          </div>
                        ) : isStudent ? (
                          <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-slate-800/80">
                            {/* Micro-aviso / Respondiendo a */}
                            {replyingTo && (
                              <div className="flex items-center justify-between px-3 py-1 rounded-xl bg-cfh-light-green/10 border border-cfh-light-green/20 text-xs text-cfh-dark-green dark:text-cfh-light-green">
                                <span className="flex items-center gap-1.5 font-medium">
                                  <Reply className="w-3.5 h-3.5" /> Respondiendo a <strong>@{replyingTo.authorName}</strong>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setReplyingTo(null)}
                                  className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-0.5 cursor-pointer"
                                  title="Cancelar respuesta directa"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            {/* Safety error on comment */}
                            {commentSafetyError && (
                              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200">
                                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                                <span className="flex-1 font-medium">{commentSafetyError}</span>
                                <button type="button" onClick={() => setCommentSafetyError(null)} className="p-0.5 text-rose-400 hover:text-rose-600 cursor-pointer">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full shrink-0 flex items-center justify-center bg-gray-200 dark:bg-slate-800 overflow-hidden border border-gray-200 dark:border-slate-700">
                                {currentUserAvatar ? (
                                  <img src={currentUserAvatar} alt="Mi perfil" className="w-full h-full object-cover" />
                                ) : (
                                  <User className="w-4 h-4 text-gray-400" />
                                )}
                              </div>
                              <div className="relative flex-1 flex items-center">
                                <input
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
                                  onKeyDown={(e) => e.key === "Enter" && !isCommenting && handleCreateComment(post.id)}
                                  placeholder={replyingTo ? `Responde a @${replyingTo.authorName}...` : "Escribe un comentario..."}
                                  maxLength={500}
                                  className="w-full bg-gray-100/80 dark:bg-slate-800/80 border-0 rounded-full pl-3.5 pr-10 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-cfh-light-green placeholder:text-gray-400 dark:placeholder:text-slate-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleCreateComment(post.id)}
                                  disabled={isCommenting || !newComment.trim()}
                                  className="absolute right-1 w-6 h-6 flex items-center justify-center bg-cfh-dark-green hover:bg-[#061528] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full text-xs font-bold transition-all cursor-pointer"
                                  title="Publicar comentario"
                                >
                                  {isCommenting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/40 border border-gray-200/80 dark:border-slate-700/80 text-center text-xs text-gray-500 dark:text-slate-400 italic mt-2">
                            Los coaches solo pueden publicar contenido de publicidad y no comentar en dudías de aprendices.
                          </div>
                        )}
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })
              )}

              {/* Load More Button */}
              {nextCursor && (
                <div className="text-center pt-4">
                  <button
                    onClick={loadMorePosts}
                    disabled={isLoadingMore}
                    className="px-6 py-2.5 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-50 shadow-xs transition-colors inline-flex items-center gap-2"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Cargando más publicaciones...</span>
                      </>
                    ) : (
                      <span>Cargar más publicaciones</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-4 min-w-0">
            <CommunitySidebar 
              sidebarData={{ ...sidebarData, activeMembers: liveActiveMembers }} 
              selectedTag={selectedTag}
              onSelectTag={(tag) => {
                const clean = tag.replace(/^#/, "").trim();
                if (selectedTag && selectedTag.toLowerCase() === clean.toLowerCase()) {
                  setSelectedTag(null);
                  loadFilteredPosts(filter, activeTab, searchQuery, null, sortBy);
                  return;
                }
                setSelectedTag(clean);
                setShowOnlyMyPosts(false);
                setShowOnlySaved(false);
                loadFilteredPosts(filter, activeTab, searchQuery, clean, sortBy);
              }}
              onClearTag={() => {
                setSelectedTag(null);
                loadFilteredPosts(filter, activeTab, searchQuery, null, sortBy);
              }}
              onSelectMyPosts={() => {
                if (!currentUserId) {
                  openLogin();
                  return;
                }
                setShowOnlySaved(false);
                setShowOnlyMyPosts((prev) => !prev);
              }}
              onSelectSaved={() => {
                if (!currentUserId) {
                  openLogin();
                  return;
                }
                setShowOnlyMyPosts(false);
                setShowOnlySaved((prev) => !prev);
              }}
              isMyPostsActive={showOnlyMyPosts}
              isSavedActive={showOnlySaved}
              savedCount={savedPostIds.length}
              myPostsCount={currentUserId ? posts.filter((p) => p.authorId === currentUserId).length : 0}
            />
          </div>
        </div>
      </div>

      {/* Mention Search Modal (@Coach / @Curso) */}
      <AnimatePresence>
        {mentionSearchOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-50/60 via-white to-orange-50/40 dark:from-slate-800/80 dark:to-slate-900">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-2xs">
                    <AtSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-gray-900 dark:text-white">
                      Mencionar Coach o Curso
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Selecciona sobre quién o qué deseas consultar
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMentionSearchOpen(false);
                    setMentionSearchQuery("");
                  }}
                  className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Strict Rule Notice */}
              <div className="px-5 py-2.5 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-900/40 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                <Lock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>Respuestas Verificadas:</strong> Solo los aprendices que hayan tomado clases o cursos con la persona o curso mencionado podrán responder a esta publicación.
                </span>
              </div>

              {/* Tabs: Coaches / Cursos */}
              <div className="px-5 pt-3 flex gap-2 border-b border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setMentionActiveTab("coaches")}
                  className={`pb-2.5 px-3 text-xs font-black border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                    mentionActiveTab === "coaches"
                      ? "border-amber-500 text-amber-600 dark:text-amber-400"
                      : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Coaches</span>
                  <span className="px-1.5 py-0.2 rounded-full text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 font-bold">
                    {mentionSearchResults.coaches.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMentionActiveTab("courses")}
                  className={`pb-2.5 px-3 text-xs font-black border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                    mentionActiveTab === "courses"
                      ? "border-amber-500 text-amber-600 dark:text-amber-400"
                      : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Cursos</span>
                  <span className="px-1.5 py-0.2 rounded-full text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 font-bold">
                    {mentionSearchResults.courses.length}
                  </span>
                </button>
              </div>

              {/* Search input */}
              <div className="p-4 border-b border-gray-100 dark:border-slate-800">
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    value={mentionSearchQuery}
                    onChange={(e) => {
                      const q = e.target.value;
                      setMentionSearchQuery(q);
                      fetchMentionEntities(q);
                    }}
                    placeholder={mentionActiveTab === "coaches" ? "Buscar coach por nombre o especialidad..." : "Buscar curso por título..."}
                    className="w-full bg-gray-50 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                  {mentionSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setMentionSearchQuery("");
                        fetchMentionEntities("");
                      }}
                      className="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Results List */}
              <div className="p-4 overflow-y-auto space-y-2 flex-1 min-h-[220px]">
                {isLoadingMentions ? (
                  <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                    <span className="text-xs">Buscando {mentionActiveTab === "coaches" ? "coaches" : "cursos"}...</span>
                  </div>
                ) : mentionActiveTab === "coaches" ? (
                  mentionSearchResults.coaches.length === 0 ? (
                    <div className="py-12 text-center text-xs text-gray-400 dark:text-slate-500">
                      No se encontraron coaches activos con ese término.
                    </div>
                  ) : (
                    mentionSearchResults.coaches.map((coach) => (
                      <div
                        key={coach.id}
                        onClick={() => handleSelectMention(coach)}
                        className="p-3 rounded-2xl border border-gray-100 dark:border-slate-800 hover:border-amber-500/40 hover:bg-amber-50/30 dark:hover:bg-slate-800/60 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-slate-700 shrink-0 border border-gray-200 dark:border-slate-700">
                            {coach.avatarUrl ? (
                              <img src={coach.avatarUrl} alt={coach.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <User className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                {coach.name}
                              </p>
                              <span className="px-1.5 py-0.2 rounded-full text-xs sm:text-xs font-black bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                Coach
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 truncate mt-0.5">
                              {coach.headline || "Coach en CoachingFromHome"}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-xl bg-amber-500/15 group-hover:bg-amber-500 text-amber-800 dark:text-amber-300 group-hover:text-white text-xs font-extrabold transition-all shrink-0 cursor-pointer"
                        >
                          Mencionar
                        </button>
                      </div>
                    ))
                  )
                ) : (
                  mentionSearchResults.courses.length === 0 ? (
                    <div className="py-12 text-center text-xs text-gray-400 dark:text-slate-500">
                      No se encontraron cursos activos con ese término.
                    </div>
                  ) : (
                    mentionSearchResults.courses.map((course) => (
                      <div
                        key={course.id}
                        onClick={() => handleSelectMention(course)}
                        className="p-3 rounded-2xl border border-gray-100 dark:border-slate-800 hover:border-amber-500/40 hover:bg-amber-50/30 dark:hover:bg-slate-800/60 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-indigo-500/10 shrink-0 border border-indigo-500/20 flex items-center justify-center">
                            {course.avatarUrl ? (
                              <img src={course.avatarUrl} alt={course.name} className="w-full h-full object-cover" />
                            ) : (
                              <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                {course.name}
                              </p>
                              <span className="px-1.5 py-0.2 rounded-full text-xs sm:text-xs font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                Curso
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 truncate mt-0.5">
                              {course.headline}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-xl bg-amber-500/15 group-hover:bg-amber-500 text-amber-800 dark:text-amber-300 group-hover:text-white text-xs font-extrabold transition-all shrink-0 cursor-pointer"
                        >
                          Mencionar
                        </button>
                      </div>
                    ))
                  )
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


