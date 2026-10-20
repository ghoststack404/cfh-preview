import Pusher from "pusher";

const globalForPusher = globalThis as unknown as {
  pusherServer: Pusher | undefined;
};

export const pusherServer =
  globalForPusher.pusherServer ??
  new Pusher({
    appId: process.env.PUSHER_APP_ID || "cfh_local_app",
    key: process.env.NEXT_PUBLIC_PUSHER_KEY || process.env.PUSHER_KEY || "cfh_local_key",
    secret: process.env.PUSHER_SECRET || "cfh_local_secret",
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || process.env.PUSHER_CLUSTER || "mt1",
    useTLS: true,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPusher.pusherServer = pusherServer;
}

/**
 * Defensive trigger wrapper that guarantees database operations
 * and API responses succeed even if Pusher credentials are mock
 * or external network calls fail.
 */
export async function triggerPusherSafe(channel: string, event: string, data: any) {
  try {
    if (!process.env.PUSHER_APP_ID || process.env.PUSHER_APP_ID === "cfh_local_app") {
      // In development / mock mode, log cleanly
      if (process.env.NODE_ENV === "development") {
        console.log(`[Pusher Mock] Channel: "${channel}", Event: "${event}"`, data);
      }
      return;
    }
    await pusherServer.trigger(channel, event, data);
  } catch (error) {
    console.warn(`[Pusher Server] Failed to trigger event "${event}" on "${channel}":`, error);
  }
}
