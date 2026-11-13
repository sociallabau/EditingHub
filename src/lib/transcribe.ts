"use client";

// Speech-to-text that runs entirely in the browser (Whisper via transformers.js in a Web Worker).
// Nothing is sent to a server: the audio is decoded locally, so raw clips never need uploading.

export type Word = { start: number; end: number; text: string };
export type Segment = { start: number; end: number; text: string; words?: Word[] };
export type TranscriptResult = { text: string; segments: Segment[]; duration: number };
export type Progress = { stage: "audio" | "model" | "transcribing"; pct: number };

const LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2";
const MODEL = "onnx-community/whisper-base.en_timestamped";
const CHUNK = 28; // seconds per pass; Whisper's window is 30s

const WORKER = `
import { pipeline, env } from "${LIB}";
env.allowLocalModels = false;
let asr = null;
self.onmessage = async (e) => {
  const { id, audio, offset } = e.data;
  try {
    if (!asr) {
      const files = {};
      asr = await pipeline("automatic-speech-recognition", "${MODEL}", {
        dtype: "q8",
        progress_callback: (p) => {
          if (p.status === "progress" && p.total) {
            files[p.file] = p.loaded / p.total;
            const v = Object.values(files);
            self.postMessage({ id, type: "model", pct: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) });
          }
        },
      });
    }
    const out = await asr(audio, { return_timestamps: "word" });
    const chunks = (out.chunks || []).map((c) => ({
      start: offset + (c.timestamp[0] ?? 0),
      end: offset + (c.timestamp[1] ?? c.timestamp[0] ?? 0),
      text: c.text,
    }));
    self.postMessage({ id, type: "done", chunks, text: out.text });
  } catch (err) {
    self.postMessage({ id, type: "error", message: String(err && err.message ? err.message : err) });
  }
};
`;

let worker: Worker | null = null;
let seq = 0;
function getWorker() {
  if (!worker) {
    const url = URL.createObjectURL(new Blob([WORKER], { type: "text/javascript" }));
    worker = new Worker(url, { type: "module" });
  }
  return worker;
}

function runChunk(audio: Float32Array, offset: number, onModel: (pct: number) => void) {
  return new Promise<{ chunks: Segment[]; text: string }>((resolve, reject) => {
    const w = getWorker();
    const id = ++seq;
    const onMsg = (e: MessageEvent) => {
      if (e.data.id !== id) return;
      if (e.data.type === "model") return onModel(e.data.pct);
      w.removeEventListener("message", onMsg);
      w.removeEventListener("error", onErr);
      if (e.data.type === "done") resolve(e.data);
      else reject(new Error(e.data.message));
    };
    const onErr = () => {
      w.removeEventListener("message", onMsg);
      w.removeEventListener("error", onErr);
      worker = null;
      reject(new Error("Couldn't load the speech model — check your connection and try again."));
    };
    w.addEventListener("message", onMsg);
    w.addEventListener("error", onErr);
    w.postMessage({ id, audio, offset }, [audio.buffer]);
  });
}

async function decode(source: File | Blob | string, onProgress: (p: Progress) => void): Promise<Float32Array> {
  let buf: ArrayBuffer;
  if (typeof source === "string") {
    const res = await fetch(source);
    if (!res.ok) throw new Error("Couldn't download the video to read its audio");
    const total = Number(res.headers.get("content-length")) || 0;
    if (res.body && total) {
      const reader = res.body.getReader();
      const parts: Uint8Array[] = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        got += value.length;
        onProgress({ stage: "audio", pct: Math.round((got / total) * 100) });
      }
      buf = await new Blob(parts as BlobPart[]).arrayBuffer();
    } else buf = await res.arrayBuffer();
  } else {
    if (source.size > 1.9 * 1024 ** 3) throw new Error("That file is over 1.9GB — too big to read in the browser. Export a smaller proxy or audio-only file.");
    buf = await source.arrayBuffer();
  }
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx({ sampleRate: 16000 });
  try {
    const audio = await ctx.decodeAudioData(buf);
    const a = audio.getChannelData(0);
    if (audio.numberOfChannels === 1) return a.slice();
    const b = audio.getChannelData(1);
    const mono = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) mono[i] = (a[i] + b[i]) / 2;
    return mono;
  } catch {
    throw new Error("This browser couldn't read the audio in that file (unsupported codec). Try an .mp4 / .mov with AAC audio.");
  } finally {
    ctx.close();
  }
}

/** Group word-level output into caption-sized lines (break on sentence ends, pauses, or ~9 words). */
function tidy(words: Segment[]): Segment[] {
  const lines: Segment[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    lines.push({
      start: cur[0].start,
      end: cur[cur.length - 1].end,
      text: cur.map((w) => w.text).join(" "),
      words: cur,
    });
    cur = [];
  };
  for (const w of words) {
    const text = w.text.replace(/\s+/g, " ").trim();
    if (!text || /^\[.*\]$|^\(.*\)$/.test(text)) continue; // [BLANK_AUDIO], (music)
    const end = w.end > w.start ? w.end : w.start + 0.3;
    const prev = cur[cur.length - 1];
    if (prev && w.start - prev.end > 0.8) flush();
    cur.push({ start: w.start, end, text });
    if (/[.!?]$/.test(text) || cur.length >= 9 || (cur.length >= 5 && /[,;:]$/.test(text))) flush();
  }
  flush();
  return lines;
}

export async function transcribe(source: File | Blob | string, onProgress: (p: Progress) => void = () => {}): Promise<TranscriptResult> {
  onProgress({ stage: "audio", pct: 0 });
  const pcm = await decode(source, onProgress);
  const duration = pcm.length / 16000;
  const all: Segment[] = [];
  const size = CHUNK * 16000;
  const total = Math.max(1, Math.ceil(pcm.length / size));
  onProgress({ stage: "model", pct: 0 });
  for (let i = 0; i < total; i++) {
    const slice = pcm.slice(i * size, (i + 1) * size);
    const { chunks } = await runChunk(slice, i * CHUNK, (pct) => i === 0 && onProgress({ stage: "model", pct }));
    all.push(...chunks);
    onProgress({ stage: "transcribing", pct: Math.round(((i + 1) / total) * 100) });
  }
  const segments = tidy(all);
  return { text: segments.map((s) => s.text).join(" "), segments, duration };
}

export const STAGE_LABEL: Record<Progress["stage"], string> = {
  audio: "Reading audio",
  model: "Loading speech model (first time only)",
  transcribing: "Transcribing",
};
