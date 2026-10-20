"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type ConnectionState =
  | "idle"
  | "initializing"
  | "waiting"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed"
  | "disconnected";

export interface RemoteParticipantState {
  id: string;
  name: string;
  role: string;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isAdmitted: boolean;
}

interface UseVideoCallOptions {
  roomId: string | null | undefined;
  currentUser: {
    id: string;
    name: string;
    role?: string;
  } | null;
  enabled?: boolean;
  onChatMessage?: (message: { id: string; sender: string; isMe: boolean; text: string; time: string; role?: string }) => void;
  onCustomData?: (type: string, payload: any) => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
];

/**
 * Genera un stream de video sintético animado (canvas 15fps) en caso de que la cámara
 * esté ocupada por otra pestaña (muy común en pruebas locales Coach vs Alumno en el mismo equipo).
 */
function createSyntheticVideoStream(userName: string): MediaStream {
  if (typeof document === "undefined") return new MediaStream();
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");
  let frame = 0;

  const renderFrame = () => {
    if (!ctx) return;
    frame++;
    ctx.fillStyle = "#0B0F17";
    ctx.fillRect(0, 0, 640, 480);

    const grad = ctx.createRadialGradient(320, 240, 20, 320, 240, 160);
    grad.addColorStop(0, "rgba(16, 185, 129, 0.25)");
    grad.addColorStop(1, "rgba(11, 15, 23, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(320, 240, 160, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#10B981";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(userName || "Cámara Activa", 320, 230);

    ctx.fillStyle = "#94A3B8";
    ctx.font = "14px sans-serif";
    ctx.fillText("Cámara en vivo activa", 320, 260);

    const pulse = 6 + Math.sin(frame * 0.15) * 2.5;
    ctx.fillStyle = "#22C55E";
    ctx.beginPath();
    ctx.arc(320, 295, pulse, 0, Math.PI * 2);
    ctx.fill();
  };

  renderFrame(); // Render synchronously so captureStream has an immediate initial frame
  const interval = setInterval(renderFrame, 100);

  const stream = (canvas as any).captureStream ? (canvas as any).captureStream(15) : new MediaStream();
  const track = stream.getVideoTracks()[0];
  if (track) {
    track.addEventListener("ended", () => clearInterval(interval));
  }
  return stream;
}

/**
 * Genera un track de audio silencioso sintético si el micrófono físico
 * no está disponible o no tiene permisos, permitiendo que la negociación WebRTC fluya.
 */
function createSilentAudioTrack(): MediaStreamTrack {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const dst = ctx.createMediaStreamDestination();
      osc.connect(dst);
      osc.start();
      const track = dst.stream.getAudioTracks()[0];
      if (track) {
        track.enabled = true;
        return track;
      }
    }
  } catch (e) {
    console.warn("Could not create silent audio track:", e);
  }
  return new MediaStreamTrack();
}

/**
 * Optimiza los parámetros de SDP para garantizar audio estéreo de alta fidelidad (Opus 128 kbps)
 * y corrección de pérdida de paquetes (FEC), eliminando el audio comprimido o robótico.
 */
function optimizeSdp(sdp: string): string {
  if (!sdp) return sdp;
  let modified = sdp;
  const opusMatch = modified.match(/a=rtpmap:(\d+)\s+opus\/48000\/2/i);
  if (opusMatch) {
    const pt = opusMatch[1];
    const fmtpRegex = new RegExp(`a=fmtp:${pt}\\s+(.*)`, "i");
    if (fmtpRegex.test(modified)) {
      modified = modified.replace(fmtpRegex, (_match, params) => {
        let p = params;
        if (!p.includes("maxaveragebitrate")) p += ";maxaveragebitrate=128000";
        if (!p.includes("useinbandfec")) p += ";useinbandfec=1";
        if (!p.includes("stereo")) p += ";stereo=1";
        if (!p.includes("sprop-stereo")) p += ";sprop-stereo=1";
        if (!p.includes("minptime")) p += ";minptime=10";
        return `a=fmtp:${pt} ${p}`;
      });
    } else {
      modified = modified.replace(
        opusMatch[0],
        `${opusMatch[0]}\r\na=fmtp:${pt} minptime=10;useinbandfec=1;maxaveragebitrate=128000;stereo=1;sprop-stereo=1`
      );
    }
  }
  return modified;
}

export function useVideoCall({
  roomId,
  currentUser,
  enabled = true,
  onChatMessage,
}: UseVideoCallOptions) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const [remotePeer, setRemotePeer] = useState<RemoteParticipantState | null>(null);
  const [isAdmitted, setIsAdmitted] = useState<boolean>(true);

  // References
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const localAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const lastSignalTimeRef = useRef<number>(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const makingOfferRef = useRef<boolean>(false);
  const activeRoomIdRef = useRef<string | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remotePeerRef = useRef<RemoteParticipantState | null>(null);
  const hasInitiatedOfferRef = useRef<boolean>(false);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  const missedOtherCountRef = useRef<number>(0);

  // Helper to send signal messages to server
  const sendSignal = useCallback(
    async (type: string, payload: any, targetId?: string) => {
      if (!roomId || !currentUser) return;
      try {
        await fetch(`/api/video/signal/${encodeURIComponent(roomId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "signal",
            senderId: currentUser.id,
            senderName: currentUser.name,
            senderRole: currentUser.role || "STUDENT",
            targetId,
            type,
            payload,
          }),
        });
      } catch (err) {
        console.error("Error sending WebRTC signal:", err);
      }
    },
    [roomId, currentUser]
  );

  // Send state update (audio/video mute) to peer via DataChannel and signaling server
  const broadcastState = useCallback(
    (audioMuted: boolean, videoOff: boolean, sharingScreen: boolean) => {
      // 1. DataChannel (instant)
      if (dataChannelRef.current?.readyState === "open") {
        try {
          dataChannelRef.current.send(
            JSON.stringify({
              type: "state",
              payload: {
                isAudioMuted: audioMuted,
                isVideoOff: videoOff,
                isScreenSharing: sharingScreen,
              },
            })
          );
        } catch (e) {
          console.warn("Could not send state via DataChannel:", e);
        }
      }

      // 2. Signaling server fallback
      sendSignal("state", {
        isAudioMuted: audioMuted,
        isVideoOff: videoOff,
        isScreenSharing: sharingScreen,
      });
    },
    [sendSignal]
  );

  // Toggle local audio track (Mute / Unmute)
  const toggleAudio = useCallback(() => {
    const track = localAudioTrackRef.current;
    if (track) {
      const nextMuted = !isMuted;
      track.enabled = !nextMuted;
      setIsMuted(nextMuted);
      broadcastState(nextMuted, isVideoOff, isScreenSharing);
    }
  }, [isMuted, isVideoOff, isScreenSharing, broadcastState]);

  // Toggle local video track (Camera on / off)
  const toggleVideo = useCallback(() => {
    const track = localVideoTrackRef.current;
    if (track) {
      const nextOff = !isVideoOff;
      track.enabled = !nextOff;
      setIsVideoOff(nextOff);
      broadcastState(isMuted, nextOff, isScreenSharing);
    }
  }, [isVideoOff, isMuted, isScreenSharing, broadcastState]);

  // Start / Stop Screen Sharing
  const stopScreenShare = useCallback(async () => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
    }

    // Revert sender back to camera video track
    const pc = peerConnectionRef.current;
    if (pc && localVideoTrackRef.current) {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track?.kind === "video" || s.track === null);
      if (videoSender) {
        await videoSender.replaceTrack(localVideoTrackRef.current);
      }
    }

    setIsScreenSharing(false);
    broadcastState(isMuted, isVideoOff, false);
  }, [screenStream, isMuted, isVideoOff, broadcastState]);

  const startScreenShare = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        alert("Tu navegador no soporta compartir pantalla directamente.");
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          frameRate: { ideal: 30, max: 60 },
        } as any,
        audio: true,
      });

      const screenTrack = stream.getVideoTracks()[0];
      if (!screenTrack) return;

      screenTrack.onended = () => {
        stopScreenShare();
      };

      setScreenStream(stream);
      setIsScreenSharing(true);

      const pc = peerConnectionRef.current;
      if (pc) {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === "video");
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        } else {
          pc.addTrack(screenTrack, stream);
        }
      }

      broadcastState(isMuted, isVideoOff, true);
    } catch (err) {
      console.warn("Screen share cancelado o no permitido:", err);
    }
  }, [isMuted, isVideoOff, broadcastState, stopScreenShare]);

  // Send in-call chat message
  
  const sendCustomData = useCallback((type: string, data: any) => {
    if (dataChannelRef.current?.readyState === "open") {
      try {
        dataChannelRef.current.send(
          JSON.stringify({
            type: "custom",
            payload: { type, data }
          })
        );
      } catch (e) {
        console.warn("Error sending custom data over DataChannel:", e);
      }
    }
  }, []);

  const sendChatMessage = useCallback(
    (text: string) => {
      if (!text.trim() || !currentUser) return;
      const messagePayload = {
        id: Date.now().toString(),
        sender: currentUser.name,
        isMe: false, // For remote
        role: currentUser.role,
        text: text.trim(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      if (dataChannelRef.current?.readyState === "open") {
        try {
          dataChannelRef.current.send(
            JSON.stringify({
              type: "chat",
              payload: messagePayload,
            })
          );
        } catch (e) {
          console.warn("Error sending chat over DataChannel:", e);
        }
      }

      sendSignal("chat", messagePayload);
    },
    [currentUser, sendSignal]
  );

  // Setup DataChannel listeners
  const setupDataChannel = useCallback(
    (dc: RTCDataChannel) => {
      dc.onopen = () => {
        broadcastState(isMuted, isVideoOff, isScreenSharing);
      };

      dc.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "state" && data.payload) {
            setRemotePeer((prev) => (prev ? { ...prev, ...data.payload } : prev));
          } else if (data.type === "chat" && data.payload) {
            onChatMessage?.(data.payload);
          }
        } catch (e) {
          console.warn("Error parsing data channel message:", e);
        }
      };

      dataChannelRef.current = dc;
    },
    [isMuted, isVideoOff, isScreenSharing, broadcastState, onChatMessage]
  );

  // Reset and destroy active RTCPeerConnection to ensure clean renegotiation on reload/F5
  const resetPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.oniceconnectionstatechange = null;
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.ondatachannel = null;
        peerConnectionRef.current.onconnectionstatechange = null;
        peerConnectionRef.current.close();
      } catch (e) {
        console.warn("Error al cerrar RTCPeerConnection en reset:", e);
      }
      peerConnectionRef.current = null;
    }
    if (dataChannelRef.current) {
      try {
        dataChannelRef.current.close();
      } catch (e) {}
      dataChannelRef.current = null;
    }
    makingOfferRef.current = false;
    hasInitiatedOfferRef.current = false;
    pendingCandidatesRef.current = [];
  }, []);

  // Optimize sender bitrates for crystal clear 1080p video and studio speech audio
  const boostSenderBitrates = useCallback((pc: RTCPeerConnection) => {
    try {
      if (pc.connectionState !== "connected" && pc.iceConnectionState !== "connected") {
        return;
      }
      pc.getSenders().forEach((sender) => {
        if (sender.track?.kind === "video") {
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          const encoding = params.encodings[0];
          if (encoding) {
            encoding.maxBitrate = 3500000; // 3.5 Mbps Full HD
            (encoding as any).networkPriority = "high";
          }
          (params as any).degradePreference = "maintain-resolution";
          sender.setParameters(params).catch(() => {});
        } else if (sender.track?.kind === "audio") {
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          const encoding = params.encodings[0];
          if (encoding) {
            encoding.maxBitrate = 128000; // 128 kbps audio de estudio
            (encoding as any).networkPriority = "high";
          }
          sender.setParameters(params).catch(() => {});
        }
      });
    } catch (e) {
      console.warn("Could not set sender parameters:", e);
    }
  }, []);

  // Setup RTCPeerConnection and listeners
  const getOrCreatePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 2,
    });

    // Add local tracks if available directly without duplicate empty transceivers
    const stream = localStreamRef.current || localStream;
    if (stream && stream.getTracks().length > 0) {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    }

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(
          "candidate",
          event.candidate.toJSON(),
          remotePeerRef.current?.id || remotePeer?.id
        );
      }
    };

    // ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE Connection State: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setConnectionState("connected");
        boostSenderBitrates(pc);
      } else if (pc.iceConnectionState === "failed") {
        setConnectionState("reconnecting");
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection State: ${pc.connectionState}`);
      switch (pc.connectionState) {
        case "connected":
          setConnectionState("connected");
          boostSenderBitrates(pc);
          break;
        case "connecting":
          setConnectionState("connecting");
          break;
        case "disconnected":
        case "failed":
          setConnectionState("reconnecting");
          break;
        case "closed":
          setConnectionState("disconnected");
          break;
      }
    };

    // Remote track receiver: clone MediaStream to ensure React triggers re-render
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track: kind=${event.track.kind}, id=${event.track.id}`);
      event.track.enabled = true;

      setRemoteStream((prevStream) => {
        const ms = prevStream ? new MediaStream(prevStream.getTracks()) : new MediaStream();
        const existingTrack = ms.getTracks().find((t) => t.id === event.track.id);
        if (!existingTrack) {
          // Si ya hay una pista anterior del mismo tipo con id diferente (ej. tras reconexión), reemplazarla
          const prevKindTrack = ms.getTracks().find((t) => t.kind === event.track.kind);
          if (prevKindTrack) {
            ms.removeTrack(prevKindTrack);
          }
          ms.addTrack(event.track);
        }
        remoteStreamRef.current = ms;
        return ms;
      });
    };

    // Data channel for answerer
    pc.ondatachannel = (event) => {
      setupDataChannel(event.channel);
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [localStream, remotePeer?.id, sendSignal, setupDataChannel, boostSenderBitrates]);

  // Determinar qué par inicia la oferta (Coach por defecto, o peer con ID mayor)
  const isInitiator = useCallback(
    (peerRole?: string, peerId?: string) => {
      const myRole = (currentUser?.role || "").toUpperCase();
      if (myRole === "COACH") return true;
      if ((peerRole || "").toUpperCase() === "COACH") return false;
      return currentUser ? currentUser.id > (peerId || "") : false;
    },
    [currentUser]
  );

  // Generar y enviar oferta WebRTC al par
  const initiateOffer = useCallback(
    async (targetId: string) => {
      if (!roomId || !currentUser) return;
      if (makingOfferRef.current) return;
      const pc = getOrCreatePeerConnection();
      if (pc.signalingState !== "stable") return;

      // Asegurar que las pistas locales están adjuntas al pc antes de la oferta
      const stream = localStreamRef.current || localStream;
      if (stream) {
        const senders = pc.getSenders();
        stream.getTracks().forEach((track) => {
          const hasSender = senders.some((s) => s.track?.id === track.id || s.track?.kind === track.kind);
          if (!hasSender) {
            pc.addTrack(track, stream);
          }
        });
      }

      try {
        makingOfferRef.current = true;
        hasInitiatedOfferRef.current = true;
        const dc = pc.createDataChannel("cfh-session");
        setupDataChannel(dc);

        const offer = await pc.createOffer();
        const optimizedOffer = new RTCSessionDescription({
          type: offer.type,
          sdp: optimizeSdp(offer.sdp || ""),
        });
        await pc.setLocalDescription(optimizedOffer);
        await sendSignal("offer", optimizedOffer, targetId);
      } catch (err) {
        console.error("Error al crear oferta WebRTC:", err);
      } finally {
        makingOfferRef.current = false;
      }
    },
    [roomId, currentUser, getOrCreatePeerConnection, localStream, setupDataChannel, sendSignal]
  );

  // Admitir a un estudiante a la llamada (Coach/Admin) - Siempre auto-admitido de forma instantánea
  const admitStudent = useCallback(
    async (targetId: string) => {
      setRemotePeer((prev) => (prev && prev.id === targetId ? { ...prev, isAdmitted: true } : prev));
      if (!roomId) return;
      try {
        await fetch(`/api/video/signal/${encodeURIComponent(roomId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "admit",
            targetId,
          }),
        });
        await initiateOffer(targetId);
      } catch (err) {
        console.error("Error al admitir al estudiante:", err);
      }
    },
    [roomId, initiateOffer]
  );

  // Notificar salida inmediata al servidor al recargar (F5) o cerrar la pestaña
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (activeRoomIdRef.current && currentUser?.id) {
        const payload = JSON.stringify({
          action: "leave",
          senderId: currentUser.id,
        });
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon(
            `/api/video/signal/${encodeURIComponent(activeRoomIdRef.current)}`,
            new Blob([payload], { type: "application/json" })
          );
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [currentUser?.id]);

  // Main effect: acquire camera/mic and register into room
  useEffect(() => {
    if (!enabled || !roomId || !currentUser) return;
    activeRoomIdRef.current = roomId;

    let isMounted = true;

    async function initCall() {
      setConnectionState("initializing");

      let audioTrack: MediaStreamTrack | null = null;
      let videoTrack: MediaStreamTrack | null = null;

      const HIGH_QUALITY_AUDIO: MediaTrackConstraints = {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
        channelCount: { ideal: 1 },
        sampleRate: { ideal: 48000 },
        // Mejoras de reducción de ruido, eco acústico y filtrado paso alto en Chromium
        ...({
          googEchoCancellation: true,
          googAutoGainControl: true,
          googNoiseSuppression: true,
          googHighpassFilter: true,
          googTypingNoiseDetection: true,
        } as any),
      };

      const FULL_HD_VIDEO: MediaTrackConstraints = {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
        facingMode: "user",
      };

      const HD_720_VIDEO: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
        facingMode: "user",
      };

      // 1. Intentar acceso combinado nativo en Full HD 1080p primero
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const combined = await navigator.mediaDevices.getUserMedia({
            video: FULL_HD_VIDEO,
            audio: HIGH_QUALITY_AUDIO,
          });
          videoTrack = combined.getVideoTracks()[0] || null;
          audioTrack = combined.getAudioTracks()[0] || null;
        }
      } catch (fhdErr) {
        console.warn("Fallo acceso combinado 1080p, intentando 720p:", fhdErr);
        try {
          if (navigator.mediaDevices?.getUserMedia) {
            const combined720 = await navigator.mediaDevices.getUserMedia({
              video: HD_720_VIDEO,
              audio: HIGH_QUALITY_AUDIO,
            });
            videoTrack = combined720.getVideoTracks()[0] || null;
            audioTrack = combined720.getAudioTracks()[0] || null;
          }
        } catch (combined720Err) {
          console.warn("Acceso combinado 720p falló, intentando dispositivos individuales:", combined720Err);
        }
      }

      // 2. Si falló audio, intentar micrófono individual
      if (!audioTrack) {
        try {
          if (navigator.mediaDevices?.getUserMedia) {
            const aStream = await navigator.mediaDevices.getUserMedia({
              audio: HIGH_QUALITY_AUDIO,
            });
            audioTrack = aStream.getAudioTracks()[0] || null;
          }
        } catch (aErr) {
          console.warn("No se pudo obtener micrófono físico individual:", aErr);
        }
      }

      // 3. Si falló video, intentar cámara individual (1080p o 720p)
      if (!videoTrack) {
        try {
          if (navigator.mediaDevices?.getUserMedia) {
            const vStream = await navigator.mediaDevices.getUserMedia({
              video: FULL_HD_VIDEO,
            });
            videoTrack = vStream.getVideoTracks()[0] || null;
          }
        } catch (vErr) {
          try {
            if (navigator.mediaDevices?.getUserMedia) {
              const vStream720 = await navigator.mediaDevices.getUserMedia({
                video: HD_720_VIDEO,
              });
              videoTrack = vStream720.getVideoTracks()[0] || null;
            }
          } catch (v720Err) {
            console.warn("No se pudo obtener cámara física individual:", v720Err);
          }
        }
      }

      // 4. Fallbacks sintéticos garantizados si el hardware está en uso por otra ventana en pruebas
      if (!videoTrack) {
        const syntheticVideoStream = createSyntheticVideoStream(currentUser?.name || "Participante");
        videoTrack = syntheticVideoStream.getVideoTracks()[0] || null;
      }

      if (!audioTrack) {
        audioTrack = createSilentAudioTrack();
      }

      if (!isMounted) {
        videoTrack?.stop();
        audioTrack?.stop();
        return;
      }

      if (audioTrack) {
        audioTrack.enabled = true;
        localAudioTrackRef.current = audioTrack;
      }
      if (videoTrack) {
        videoTrack.enabled = true;
        localVideoTrackRef.current = videoTrack;
      }

      const tracks: MediaStreamTrack[] = [];
      if (videoTrack) tracks.push(videoTrack);
      if (audioTrack) tracks.push(audioTrack);

      const fullStream = new MediaStream(tracks);
      localStreamRef.current = fullStream;
      setLocalStream(fullStream);

      // Si ya hay un peerConnection creado, sincronizar pistas
      if (peerConnectionRef.current) {
        const pc = peerConnectionRef.current;
        const senders = pc.getSenders();
        tracks.forEach((track) => {
          const matchingSender = senders.find((s) => s.track?.kind === track.kind);
          if (matchingSender) {
            matchingSender.replaceTrack(track);
          } else {
            pc.addTrack(track, fullStream);
          }
        });
      }

      // 5. Unirse a la sala con auto-admisión para sesiones confirmadas
      try {
        const joinRes = await fetch(`/api/video/signal/${encodeURIComponent(roomId!)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "join",
            senderId: currentUser!.id,
            senderName: currentUser!.name,
            senderRole: currentUser!.role || "STUDENT",
            state: { isAudioMuted: false, isVideoOff: false, isScreenSharing: false },
            isPreAdmitted: true,
          }),
        });

        if (joinRes.ok) {
          const joinData = await joinRes.json();
          const me = joinData.participants?.find((p: any) => p.userId === currentUser!.id);
          if (me && typeof me.isAdmitted === "boolean") {
            setIsAdmitted(me.isAdmitted);
          }

          const otherParticipant = joinData.participants?.find(
            (p: any) => p.userId !== currentUser!.id
          );

          // Re-despachar mensajes de chat históricos almacenados en la sala
          if (Array.isArray(joinData.messages)) {
            for (const msg of joinData.messages) {
              if (msg.type === "chat" && msg.payload) {
                const msgId = msg.payload.id || msg.id;
                if (!processedMessageIdsRef.current.has(msgId)) {
                  processedMessageIdsRef.current.add(msgId);
                  onChatMessage?.(msg.payload);
                }
              }
            }
          }

          if (otherParticipant) {
            const nextRemote: RemoteParticipantState = {
              id: otherParticipant.userId,
              name: otherParticipant.name,
              role: otherParticipant.role,
              isAudioMuted: otherParticipant.isAudioMuted || false,
              isVideoOff: otherParticipant.isVideoOff || false,
              isScreenSharing: otherParticipant.isScreenSharing || false,
              isAdmitted: otherParticipant.isAdmitted ?? true,
            };
            remotePeerRef.current = nextRemote;
            setRemotePeer(nextRemote);
            setConnectionState("connecting");

            if (isInitiator(otherParticipant.role, otherParticipant.userId) && !hasInitiatedOfferRef.current) {
              initiateOffer(otherParticipant.userId);
            }
          } else {
            setConnectionState("waiting");
          }
        }
      } catch (e) {
        console.error("Error al unirse a la sala de señalización:", e);
        setConnectionState("waiting");
      }
    }

    initCall();

    return () => {
      isMounted = false;
      if (activeRoomIdRef.current && currentUser?.id) {
        fetch(`/api/video/signal/${encodeURIComponent(activeRoomIdRef.current)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "leave",
            senderId: currentUser.id,
          }),
        }).catch(() => {});
      }

      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStream?.getTracks().forEach((t) => t.stop());
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      processedMessageIdsRef.current.clear();
      hasInitiatedOfferRef.current = false;
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [roomId, currentUser?.id, enabled]);

  // Signaling polling and message handler con velocidad adaptativa
  useEffect(() => {
    if (!enabled || !roomId || !currentUser?.id) return;

    const pollSignals = async () => {
      try {
        const sinceTime = Math.max(0, lastSignalTimeRef.current - 5000);
        const res = await fetch(
          `/api/video/signal/${encodeURIComponent(roomId)}?userId=${encodeURIComponent(
            currentUser.id
          )}&since=${sinceTime}`
        );

        if (!res.ok) return;
        const data = await res.json();
        if (data.serverTime) {
          lastSignalTimeRef.current = Math.max(lastSignalTimeRef.current, data.serverTime);
        }

        // Check active participants
        if (data.participants) {
          const me = data.participants.find((p: any) => p.userId === currentUser.id);
          if (me && typeof me.isAdmitted === "boolean") {
            setIsAdmitted(me.isAdmitted);
          }

          const other = data.participants.find((p: any) => p.userId !== currentUser.id);
          if (other) {
            missedOtherCountRef.current = 0;
            const nextRemote: RemoteParticipantState = {
              id: other.userId,
              name: other.name,
              role: other.role,
              isAudioMuted: other.isAudioMuted ?? false,
              isVideoOff: other.isVideoOff ?? false,
              isScreenSharing: other.isScreenSharing ?? false,
              isAdmitted: other.isAdmitted ?? true,
            };
            remotePeerRef.current = nextRemote;
            setRemotePeer((prev) => ({
              id: other.userId,
              name: other.name,
              role: other.role,
              isAudioMuted: other.isAudioMuted ?? prev?.isAudioMuted ?? false,
              isVideoOff: other.isVideoOff ?? prev?.isVideoOff ?? false,
              isScreenSharing: other.isScreenSharing ?? prev?.isScreenSharing ?? false,
              isAdmitted: other.isAdmitted ?? prev?.isAdmitted ?? true,
            }));
            if (connectionState === "waiting" || connectionState === "idle") {
              setConnectionState("connecting");
            }

            const pc = getOrCreatePeerConnection();
            if (
              isInitiator(other.role, other.userId) &&
              pc.signalingState === "stable" &&
              !pc.currentRemoteDescription &&
              !hasInitiatedOfferRef.current &&
              !makingOfferRef.current &&
              connectionState !== "connected"
            ) {
              initiateOffer(other.userId);
            }
          } else {
            // Prevenir desconexión prematura: si WebRTC P2P ya está conectado, no destruir streams por jitter de señal
            missedOtherCountRef.current += 1;
            const isP2PConnected = peerConnectionRef.current?.connectionState === "connected" ||
                                  peerConnectionRef.current?.iceConnectionState === "connected";

            if (missedOtherCountRef.current >= 20 && !isP2PConnected) {
              resetPeerConnection();
              hasInitiatedOfferRef.current = false;
              remotePeerRef.current = null;
              setRemotePeer(null);
              setRemoteStream(null);
              if (connectionState === "connected" || connectionState === "connecting") {
                setConnectionState("waiting");
              }
            }
          }
        }

        // Process incoming signaling messages
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          const pc = getOrCreatePeerConnection();

          for (const msg of data.messages) {
            const msgId = msg.id || `${msg.type}_${msg.senderId}_${msg.timestamp || Date.now()}`;
            if (processedMessageIdsRef.current.has(msgId)) {
              continue;
            }
            processedMessageIdsRef.current.add(msgId);
            if (processedMessageIdsRef.current.size > 200) {
              const iter = processedMessageIdsRef.current.values();
              for (let i = 0; i < 50; i++) {
                const val = iter.next().value;
                if (val) processedMessageIdsRef.current.delete(val);
              }
            }

            if (msg.type === "admit") {
              if (msg.payload?.targetUserId === currentUser.id || !msg.payload?.targetUserId) {
                setIsAdmitted(true);
              }
            } else if (msg.type === "join") {
              const nextRemote: RemoteParticipantState = {
                id: msg.senderId,
                name: msg.senderName,
                role: msg.senderRole,
                isAudioMuted: false,
                isVideoOff: false,
                isScreenSharing: false,
                isAdmitted: true,
              };
              remotePeerRef.current = nextRemote;
              setRemotePeer(nextRemote);
              setConnectionState("connecting");

              // Si el par reingresó explícitamente (ej. F5 con isReconnect), reiniciar la conexión previa
              if (msg.payload?.isReconnect) {
                resetPeerConnection();
                hasInitiatedOfferRef.current = false;
              }

              if (isInitiator(msg.senderRole, msg.senderId) && !hasInitiatedOfferRef.current && !makingOfferRef.current) {
                await initiateOffer(msg.senderId);
              }
            } else if (msg.type === "offer") {
              const amIInitiator = isInitiator(msg.senderRole, msg.senderId);
              const offerCollision = makingOfferRef.current || pc.signalingState !== "stable";

              // Polite peer pattern: If not initiator and collision happens, rollback
              if (offerCollision) {
                if (!amIInitiator) {
                  try {
                    await pc.setLocalDescription({ type: "rollback" });
                  } catch (e) {
                    console.warn("Rollback failed, recreating pc:", e);
                    resetPeerConnection();
                    hasInitiatedOfferRef.current = false;
                  }
                } else {
                  // Polite peer initiator: ignore the collision offer
                  continue;
                }
              }

              const freshPc = getOrCreatePeerConnection();

              // Adjuntar pistas locales al peerConnection antes de generar respuesta
              const stream = localStreamRef.current || localStream;
              if (stream) {
                const senders = freshPc.getSenders();
                stream.getTracks().forEach((track) => {
                  const hasSender = senders.some((s) => s.track?.id === track.id || s.track?.kind === track.kind);
                  if (!hasSender) {
                    freshPc.addTrack(track, stream);
                  }
                });
              }

              await freshPc.setRemoteDescription(new RTCSessionDescription(msg.payload));

              // Drenar candidatos ICE pendientes
              if (pendingCandidatesRef.current.length > 0) {
                for (const cand of pendingCandidatesRef.current) {
                  try {
                    await freshPc.addIceCandidate(new RTCIceCandidate(cand));
                  } catch (e) {}
                }
                pendingCandidatesRef.current = [];
              }

              const answer = await freshPc.createAnswer();
              const optimizedAnswer = new RTCSessionDescription({
                type: answer.type,
                sdp: optimizeSdp(answer.sdp || ""),
              });
              await freshPc.setLocalDescription(optimizedAnswer);
              await sendSignal("answer", optimizedAnswer, msg.senderId);
            } else if (msg.type === "answer") {
              const targetPc = peerConnectionRef.current || pc;
              if (targetPc.signalingState === "have-local-offer") {
                await targetPc.setRemoteDescription(new RTCSessionDescription(msg.payload));

                // Drenar candidatos ICE pendientes
                if (pendingCandidatesRef.current.length > 0) {
                  for (const cand of pendingCandidatesRef.current) {
                    try {
                      await targetPc.addIceCandidate(new RTCIceCandidate(cand));
                    } catch (e) {}
                  }
                  pendingCandidatesRef.current = [];
                }
              }
            } else if (msg.type === "candidate") {
              const targetPc = peerConnectionRef.current || pc;
              try {
                if (msg.payload) {
                  if (targetPc.remoteDescription && targetPc.remoteDescription.type) {
                    await targetPc.addIceCandidate(new RTCIceCandidate(msg.payload));
                  } else {
                    pendingCandidatesRef.current.push(msg.payload);
                  }
                }
              } catch (candidateErr) {
                console.warn("Error adding ICE candidate:", candidateErr);
              }
            } else if (msg.type === "state" && msg.payload) {
              setRemotePeer((prev) => (prev ? { ...prev, ...msg.payload } : prev));
            } else if (msg.type === "chat" && msg.payload) {
              onChatMessage?.(msg.payload);
            } else if (msg.type === "leave") {
              resetPeerConnection();
              hasInitiatedOfferRef.current = false;
              remotePeerRef.current = null;
              setRemotePeer(null);
              setRemoteStream(null);
              setConnectionState("waiting");
            }
          }
        }
      } catch (pollErr) {
        console.warn("Polling signal error:", pollErr);
      }
    };

    // Polling ultra rápido (250ms) durante la fase de negociación para conexión casi instantánea
    const pollInterval = connectionState === "connected" ? 1200 : 250;
    pollingIntervalRef.current = setInterval(pollSignals, pollInterval);

    // Heartbeat cada 8s
    heartbeatIntervalRef.current = setInterval(() => {
      fetch(`/api/video/signal/${encodeURIComponent(roomId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "heartbeat",
          senderId: currentUser.id,
          state: { isAudioMuted: isMuted, isVideoOff, isScreenSharing },
        }),
      }).catch(() => {});
    }, 8000);

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [
    enabled,
    roomId,
    currentUser?.id,
    currentUser?.role,
    connectionState,
    getOrCreatePeerConnection,
    resetPeerConnection,
    boostSenderBitrates,
    sendSignal,
    setupDataChannel,
    isMuted,
    isVideoOff,
    isInitiator,
    initiateOffer,
    onChatMessage,
  ]);

  // Clean exit method
  const leaveCall = useCallback(() => {
    if (roomId && currentUser?.id) {
      fetch(`/api/video/signal/${encodeURIComponent(roomId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "leave",
          senderId: currentUser.id,
        }),
      }).catch(() => {});
    }

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStream?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    setConnectionState("disconnected");
  }, [roomId, currentUser?.id, localStream, screenStream]);

  return {
    connectionState,
    localStream,
    remoteStream,
    screenStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    remotePeer,
    isAdmitted,
    admitStudent,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    sendChatMessage,
    sendCustomData,
    leaveCall,
  };
}
