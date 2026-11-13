"use client";

import { upload } from "@vercel/blob/client";

let modePromise: Promise<"blob" | "local"> | null = null;
function uploadMode() {
  modePromise ??= fetch("/api/local-upload")
    .then((r) => r.json())
    .then((j) => (j.mode === "local" ? "local" : "blob"))
    .catch(() => "blob" as const);
  return modePromise;
}

export type Uploaded = { url: string; size: number; contentType: string };

/** Upload a file straight from the browser to storage, reporting progress 0–100. */
export async function uploadFile(file: File | Blob, pathname: string, onProgress?: (pct: number) => void): Promise<Uploaded> {
  const contentType = file.type || "application/octet-stream";
  if ((await uploadMode()) === "local") {
    const url = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", `/api/local-upload?name=${encodeURIComponent(pathname)}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => (xhr.status < 300 ? resolve(JSON.parse(xhr.responseText).url) : reject(new Error(xhr.responseText)));
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(file);
    });
    return { url, size: file.size, contentType };
  }
  const res = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
    contentType,
    multipart: file.size > 50 * 1024 * 1024,
    onUploadProgress: (e) => onProgress?.(Math.round(e.percentage)),
  });
  return { url: res.url, size: file.size, contentType };
}

function brightness(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const d = ctx.getImageData(0, 0, w, h).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 64) sum += d[i] + d[i + 1] + d[i + 2];
  return sum / (Math.ceil(d.length / 64) * 3);
}

/**
 * Grab a poster frame (+ duration) from a video file or URL. Tries several points in the video
 * and skips black frames (fade-ins, title cards), waiting for the frame to actually be painted.
 */
export function captureFrame(source: File | string, at?: number): Promise<{ thumb: Blob | null; duration: number | null }> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const isFile = typeof source !== "string";
    const url = isFile ? URL.createObjectURL(source) : source;
    let done = false;
    const finish = (thumb: Blob | null) => {
      if (done) return;
      done = true;
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      if (isFile) URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      resolve({ thumb, duration });
    };
    setTimeout(() => finish(null), 20000);
    if (!isFile) video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    video.onerror = () => finish(null); // e.g. .mov codecs the browser can't decode
    video.onloadedmetadata = async () => {
      const d = video.duration || 3;
      const points = at != null ? [at] : [Math.min(d * 0.15, 4), d * 0.33, d * 0.5, d * 0.75, Math.min(0.5, d / 2)];
      const w = Math.min(640, video.videoWidth || 640);
      const h = Math.round((video.videoHeight / video.videoWidth) * w) || 360;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return finish(null);
      try {
        for (const [i, t] of points.entries()) {
          await new Promise<void>((res) => {
            video.onseeked = () => res();
            video.currentTime = Math.max(0, Math.min(t, d - 0.05));
          });
          // give the decoder a beat to paint the seeked frame
          await new Promise<void>((res) => {
            const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => void };
            if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(() => res());
            setTimeout(res, 350);
          });
          ctx.drawImage(video, 0, 0, w, h);
          if (brightness(ctx, w, h) > 14 || i === points.length - 1) break;
        }
        canvas.toBlob((b) => finish(b), "image/jpeg", 0.82);
      } catch {
        finish(null); // cross-origin canvas, etc.
      }
    };
  });
}

export const videoThumbnail = (file: File) => captureFrame(file);

/** True when an image is (almost) entirely black. */
export function isDarkImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 64;
        c.height = 64;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0, 64, 64);
        resolve(brightness(ctx, 64, 64) < 10);
      } catch {
        resolve(false);
      }
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

export function safeName(name: string) {
  return name.replace(/[^\w.\- ]+/g, "_");
}
