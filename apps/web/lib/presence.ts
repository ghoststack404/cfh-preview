// apps/web/lib/presence.ts
// DEPRECATED: Presence is now managed via Pusher Presence Channels ('presence-community').
// All on-disk (.tmp/presence.json) caching has been permanently decommissioned.

export interface PresenceUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
  headline?: string | null;
  lastSeen: number;
}

export const getPresenceMap = (): Map<string, PresenceUser> => {
  return new Map<string, PresenceUser>();
};

export const savePresenceMap = (_map: Map<string, PresenceUser>) => {
  // No-op: presence is now event-driven via WebSockets
};
