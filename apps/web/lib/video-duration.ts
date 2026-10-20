/**
 * Detección de duración de video en el navegador (sin llaves ni costo).
 * - YouTube: reproductor oculto con la IFrame API (getDuration).
 * - Vimeo: endpoint público oEmbed (devuelve "duration" en segundos).
 * - Archivos directos (.mp4, .webm, subidas): metadatos del elemento <video>.
 * Devuelve segundos, o null si no se pudo detectar (enlace privado, red, timeout).
 */

const YT_REGEX = /(?:youtu\.be\/|(?:www\.)?youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i;
const VIMEO_REGEX = /(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/i;

const TIMEOUT_MS = 10000;

let ytApiPromise: Promise<any> | null = null;

function loadYouTubeApi(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no-window"));
  const w = window as any;
  if (w.YT && w.YT.Player) return Promise.resolve(w.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve, reject) => {
    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      if (typeof previous === "function") previous();
      resolve(w.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      ytApiPromise = null;
      reject(new Error("yt-api-load-failed"));
    };
    document.head.appendChild(script);
  });
  return ytApiPromise;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

async function youtubeDuration(videoId: string): Promise<number | null> {
  const YT = await loadYouTubeApi();
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
  const mount = document.createElement("div");
  host.appendChild(mount);
  document.body.appendChild(host);

  return new Promise<number | null>((resolve) => {
    let player: any;
    const cleanup = () => {
      try { player?.destroy?.(); } catch {}
      host.remove();
    };
    player = new YT.Player(mount, {
      videoId,
      width: "1",
      height: "1",
      playerVars: { autoplay: 0, controls: 0 },
      events: {
        onReady: () => {
          const seconds = Number(player.getDuration?.() || 0);
          cleanup();
          resolve(seconds > 0 ? seconds : null);
        },
        onError: () => {
          cleanup();
          resolve(null);
        },
      },
    });
  });
}

async function vimeoDuration(url: string): Promise<number | null> {
  const res = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const seconds = Number(data?.duration || 0);
  return seconds > 0 ? seconds : null;
}

function fileDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const seconds = Number(video.duration || 0);
      resolve(Number.isFinite(seconds) && seconds > 0 ? seconds : null);
    };
    video.onerror = () => resolve(null);
    video.src = url;
  });
}

export async function getVideoDurationSeconds(rawUrl: string | null | undefined): Promise<number | null> {
  const url = (rawUrl || "").trim();
  if (!url || typeof window === "undefined") return null;

  const yt = url.match(YT_REGEX);
  if (yt?.[1]) return withTimeout(youtubeDuration(yt[1]), TIMEOUT_MS);

  const vimeo = url.match(VIMEO_REGEX);
  if (vimeo?.[1]) return withTimeout(vimeoDuration(url), TIMEOUT_MS);

  return withTimeout(fileDuration(url), TIMEOUT_MS);
}

export function secondsToLessonMinutes(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60));
}
