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

/** Grab a poster frame + duration from a local video file before it's uploaded. */
export function videoThumbnail(file: File): Promise<{ thumb: Blob | null; duration: number | null }> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    let done = false;
    const finish = (thumb: Blob | null, duration: number | null) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      resolve({ thumb, duration });
    };
    setTimeout(() => finish(null, Number.isFinite(video.duration) ? video.duration : null), 8000);
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 3);
    };
    video.onseeked = () => {
      const w = 480;
      const h = Math.round((video.videoHeight / video.videoWidth) * w) || 270;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
      canvas.toBlob((b) => finish(b, video.duration || null), "image/jpeg", 0.8);
    };
    video.onerror = () => finish(null, null); // e.g. some .mov codecs the browser can't decode
  });
}

export function safeName(name: string) {
  return name.replace(/[^\w.\- ]+/g, "_");
}
