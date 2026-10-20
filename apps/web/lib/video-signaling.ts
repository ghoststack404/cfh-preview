/**
 * In-Memory Signaling Store for Private WebRTC Video Rooms
 * Facilitates peer-to-peer WebRTC exchange (offer, answer, ICE candidates, participant state)
 * with zero external dependencies and ultra-low latency.
 */

export interface SignalMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: 'COACH' | 'STUDENT' | 'ADMIN';
  targetId?: string; // If undefined, broadcast to all other peers in the room
  type: 'join' | 'offer' | 'answer' | 'candidate' | 'state' | 'leave' | 'chat' | 'admit';
  payload: any;
  timestamp: number;
}

export interface RoomParticipant {
  userId: string;
  name: string;
  role: 'COACH' | 'STUDENT' | 'ADMIN';
  joinedAt: number;
  lastSeenAt: number;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isAdmitted: boolean;
}

interface RoomState {
  participants: Map<string, RoomParticipant>;
  messages: SignalMessage[];
  createdAt: number;
}

// Global reference across Next.js reloads
declare global {
  var __cfh_video_rooms: Map<string, RoomState> | undefined;
}

if (!globalThis.__cfh_video_rooms) {
  globalThis.__cfh_video_rooms = new Map<string, RoomState>();
}

const rooms = globalThis.__cfh_video_rooms;

// Clean up stale rooms every 5 minutes
const ROOM_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const PARTICIPANT_TIMEOUT_MS = 25 * 1000; // 25 seconds heartbeat
const MAX_MESSAGES_PER_ROOM = 100;

function cleanupOldRooms() {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.createdAt > ROOM_TTL_MS && room.participants.size === 0) {
      rooms.delete(roomId);
      continue;
    }
    // Remove stale participants who haven't pinged in 25 seconds
    for (const [userId, participant] of room.participants.entries()) {
      if (now - participant.lastSeenAt > PARTICIPANT_TIMEOUT_MS) {
        room.participants.delete(userId);
        // Add leave message
        room.messages.push({
          id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
          roomId,
          senderId: userId,
          senderName: participant.name,
          senderRole: participant.role,
          type: 'leave',
          payload: { reason: 'timeout' },
          timestamp: now,
        });
      }
    }
  }
}

function getOrCreateRoom(roomId: string): RoomState {
  cleanupOldRooms();
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      participants: new Map(),
      messages: [],
      createdAt: Date.now(),
    };
    rooms.set(roomId, room);
  }
  return room;
}

export function registerParticipant(
  roomId: string,
  user: { id: string; name: string; role: 'COACH' | 'STUDENT' | 'ADMIN' },
  state?: { isAudioMuted?: boolean; isVideoOff?: boolean; isScreenSharing?: boolean },
  isPreAdmitted?: boolean
): { participants: RoomParticipant[]; messages: SignalMessage[] } {
  const room = getOrCreateRoom(roomId);
  const now = Date.now();

  const existing = room.participants.get(user.id);
  // Auto-admitir a todos los participantes inmediatamente sin sala de espera
  const isAdmitted = true;

  const participant: RoomParticipant = {
    userId: user.id,
    name: user.name,
    role: user.role,
    joinedAt: existing ? existing.joinedAt : now,
    lastSeenAt: now,
    isAudioMuted: state?.isAudioMuted ?? existing?.isAudioMuted ?? false,
    isVideoOff: state?.isVideoOff ?? existing?.isVideoOff ?? false,
    isScreenSharing: state?.isScreenSharing ?? existing?.isScreenSharing ?? false,
    isAdmitted: true,
  };

  room.participants.set(user.id, participant);

  // Limpiar mensajes antiguos de negociación SDP/ICE de sesiones previas para evitar colisiones tras F5
  room.messages = room.messages.filter(
    (m) => m.type !== 'offer' && m.type !== 'answer' && m.type !== 'candidate'
  );

  // Notificar SIEMPRE a los demás participantes (incluso en recargas F5) para reiniciar WebRTC limpiamente
  const joinMsg: SignalMessage = {
    id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
    roomId,
    senderId: user.id,
    senderName: user.name,
    senderRole: user.role,
    type: 'join',
    payload: { participant, isReconnect: !!existing, epoch: now },
    timestamp: now,
  };
  room.messages.push(joinMsg);
  if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
    room.messages.shift();
  }

  return {
    participants: Array.from(room.participants.values()),
    messages: room.messages,
  };
}

export function admitParticipant(roomId: string, targetUserId: string): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  const participant = room.participants.get(targetUserId);
  if (participant) {
    participant.isAdmitted = true;
    const now = Date.now();
    const admitMsg: SignalMessage = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      roomId,
      senderId: 'system',
      senderName: 'Sistema',
      senderRole: 'COACH',
      targetId: targetUserId,
      type: 'admit',
      payload: { admitted: true, targetUserId },
      timestamp: now,
    };
    room.messages.push(admitMsg);
    if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
      room.messages.shift();
    }
    return true;
  }
  return false;
}

export function updateParticipantHeartbeat(
  roomId: string,
  userId: string,
  state?: { isAudioMuted?: boolean; isVideoOff?: boolean; isScreenSharing?: boolean }
) {
  const room = rooms.get(roomId);
  if (!room) return;
  const participant = room.participants.get(userId);
  if (participant) {
    participant.lastSeenAt = Date.now();
    if (state) {
      if (typeof state.isAudioMuted === 'boolean') participant.isAudioMuted = state.isAudioMuted;
      if (typeof state.isVideoOff === 'boolean') participant.isVideoOff = state.isVideoOff;
      if (typeof state.isScreenSharing === 'boolean') participant.isScreenSharing = state.isScreenSharing;
    }
  }
}

export function addSignalMessage(
  roomId: string,
  message: Omit<SignalMessage, 'id' | 'timestamp'>
): SignalMessage {
  const room = getOrCreateRoom(roomId);
  const now = Date.now();

  const fullMessage: SignalMessage = {
    ...message,
    id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
  };

  room.messages.push(fullMessage);
  if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
    room.messages.shift();
  }

  // Also update heartbeat of sender
  updateParticipantHeartbeat(roomId, message.senderId);

  return fullMessage;
}

export function getSignalsForUser(
  roomId: string,
  userId: string,
  since: number = 0
): {
  messages: SignalMessage[];
  participants: RoomParticipant[];
} {
  const room = rooms.get(roomId);
  if (!room) {
    return { messages: [], participants: [] };
  }

  updateParticipantHeartbeat(roomId, userId);

  // Filter messages:
  // 1. timestamp > since
  // 2. not sent by this user
  // 3. targetId is either this user, or undefined (broadcast)
  const messages = room.messages.filter(
    (m) =>
      m.timestamp > since &&
      m.senderId !== userId &&
      (!m.targetId || m.targetId === userId)
  );

  return {
    messages,
    participants: Array.from(room.participants.values()),
  };
}

export function removeParticipant(roomId: string, userId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;

  const participant = room.participants.get(userId);
  if (participant) {
    room.participants.delete(userId);
    const now = Date.now();
    room.messages.push({
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      roomId,
      senderId: userId,
      senderName: participant.name,
      senderRole: participant.role,
      type: 'leave',
      payload: { reason: 'user_left' },
      timestamp: now,
    });
    // Limpiar mensajes antiguos de negociación SDP/ICE
    room.messages = room.messages.filter(
      (m) => m.type !== 'offer' && m.type !== 'answer' && m.type !== 'candidate'
    );
  }
}
