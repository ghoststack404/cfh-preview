import twilio from "twilio";
import { env, requireIntegration } from "@/lib/env";

export function videoProvider() {
  return env().VIDEO_PROVIDER;
}

export function createVideoToken(identity: string, roomName: string) {
  if (env().VIDEO_PROVIDER === "mock") {
    return { provider: "mock" as const, token: `mock:${identity}:${roomName}` };
  }
  requireIntegration(["TWILIO_ACCOUNT_SID", "TWILIO_API_KEY_SID", "TWILIO_API_KEY_SECRET"], "Twilio Video");
  const AccessToken = twilio.jwt.AccessToken;
  const VideoGrant = AccessToken.VideoGrant;
  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID as string,
    process.env.TWILIO_API_KEY_SID as string,
    process.env.TWILIO_API_KEY_SECRET as string,
    { identity, ttl: 3600 }
  );
  token.addGrant(new VideoGrant({ room: roomName }));
  return { provider: "twilio" as const, token: token.toJwt() };
}
