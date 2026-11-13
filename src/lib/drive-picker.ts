"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Google Drive Picker: lets people browse their Drive (incl. shared drives) and pick footage
// files or whole folders. Uses the narrow `drive.file` scope — we only store links, never download.

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const APP_ID = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;

export const driveEnabled = Boolean(CLIENT_ID && API_KEY);

export type DrivePick = { id: string; name: string; url: string; isFolder: boolean; size?: number };

let token: { value: string; expires: number } | null = null;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function getToken(): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  await loadScript("https://accounts.google.com/gsi/client");
  const g = (window as any).google;
  return new Promise((resolve, reject) => {
    const client = g.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (resp: any) => {
        if (resp.error) return reject(new Error(resp.error));
        token = { value: resp.access_token, expires: Date.now() + Number(resp.expires_in) * 1000 };
        resolve(resp.access_token);
      },
      error_callback: (e: any) => reject(new Error(e?.message || "Google sign-in was cancelled")),
    });
    client.requestAccessToken({ prompt: token ? "" : "consent" });
  });
}

export async function openDrivePicker(): Promise<DrivePick[]> {
  if (!driveEnabled) throw new Error("Google Drive isn't configured yet — paste a Drive link instead.");
  await loadScript("https://apis.google.com/js/api.js");
  const gapi = (window as any).gapi;
  await new Promise<void>((r) => gapi.load("picker", { callback: r }));
  const accessToken = await getToken();
  const g = (window as any).google;
  const P = g.picker;

  return new Promise((resolve) => {
    const myDrive = new P.DocsView(P.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(true).setMode(P.DocsViewMode.LIST);
    const shared = new P.DocsView(P.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(true).setEnableDrives(true);
    const videos = new P.DocsView(P.ViewId.DOCS_VIDEOS);
    const builder = new P.PickerBuilder()
      .addView(myDrive)
      .addView(shared)
      .addView(videos)
      .enableFeature(P.Feature.MULTISELECT_ENABLED)
      .enableFeature(P.Feature.SUPPORT_DRIVES)
      .setOAuthToken(accessToken)
      .setDeveloperKey(API_KEY)
      .setTitle("Link footage from Google Drive")
      .setCallback((data: any) => {
        if (data.action === P.Action.PICKED) {
          resolve(
            data.docs.map((d: any) => ({
              id: d.id,
              name: d.name,
              url: d.url,
              isFolder: d.mimeType === "application/vnd.google-apps.folder",
              size: d.sizeBytes ? Number(d.sizeBytes) : undefined,
            })),
          );
        } else if (data.action === P.Action.CANCEL) resolve([]);
      });
    if (APP_ID) builder.setAppId(APP_ID);
    builder.build().setVisible(true);
  });
}
