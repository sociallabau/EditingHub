# Editing Hub

Internal editing hub for Social Lab — Kanban board for video projects, templated project
overviews, Google Drive footage linking, uploads, timestamped video review, per-person logins
and in-app notifications.

**Stack:** Next.js 15 (App Router) · Postgres + Prisma · Vercel Blob (video/footage storage) ·
Google Drive Picker. Built to run on Vercel.

## Features

- **Board** — columns (Content Shot → To Edit → Currently Editing → Revisions Needed → To Be Approved → Approved),
  drag & drop, priority toggle (Urgent / High / Medium / Low), due dates (overdue in red), client tag,
  tagged people, latest-edit thumbnail, open review-note count. Filter by client / "My projects", search, sort by
  priority / due date / newest / manual.
- **Bulk select** — archive, move, set priority or delete many projects; "Archive all in column" for finished work.
- **Archived board** — searchable list with bulk restore / permanent delete.
- **Templates** — e.g. *Suburb Highlight* creates *Raw Footage*, *Suburb B-roll*, *Supporting Assets*, *Style Guide*
  sections plus pre-filled *Brief* and *Suburb Details* pages. Editable under **Templates**; any project can be saved as a template.
- **Footage sections** — paste a Google Drive / Dropbox link, **Browse Drive** (Google Picker, multi-select files or whole folders),
  or drag & drop files to upload. Drive items preview inline.
- **Pages** — brief / shot list / notes with headings, bullets, clickable checklists and links. Autosaves.
- **Edited video + review** — upload .mp4/.mov (up to 5GB, straight to Blob), each upload is a new version (v1, v2…).
  Reviewers leave feedback pinned to the timestamp (markers on the timeline, click to jump), reply, resolve, then
  **Request changes** / **Approve** — which moves the card to the matching column automatically.
- **Clients** — style guide, brand assets, reference edits and B-roll library per client, shown on every project for that client.
- **People & notifications** — everyone has their own login and role. Tag people on a project (or @mention them in a comment)
  and they're notified of every change on it: uploads, links, comments, stage moves, priority/due changes, approvals.
- **Roles** — Admin (everything + team), Account Manager (clients, templates, board columns, delete), Editor, Videographer.

## Deploy to Vercel

1. **Import the repo** — vercel.com → *Add New → Project* → pick `sociallabau/EditingHub`. Framework is detected as Next.js.
2. **Add a database** — in the project: *Storage → Create Database → Neon (Postgres)* → connect to the project.
   This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for you.
3. **Add file storage** — *Storage → Create → Blob* → connect to the project. This sets `BLOB_READ_WRITE_TOKEN`.
4. **Environment variables** (*Settings → Environment Variables*):
   | Name | Value |
   |---|---|
   | `AUTH_SECRET` | a long random string (`openssl rand -base64 32`) |
   | `SEED_ADMIN_EMAIL` | your login email |
   | `SEED_ADMIN_PASSWORD` | a temporary password (change it after first login) |
   | `SEED_ADMIN_NAME` | e.g. `Social Lab` |
5. **Deploy.** The build runs the database migrations and creates the default columns, templates and your admin
   account (only if they don't exist yet — redeploys never overwrite your data).
6. Log in → **Team** → add your editors, videographers and account managers with temporary passwords.

### Optional: "Browse Drive" button

Without this, people paste Drive links (still works fine). To enable the in-app Drive browser:

1. [Google Cloud console](https://console.cloud.google.com) → new project → *APIs & Services → Library* → enable
   **Google Picker API** and **Google Drive API**.
2. *OAuth consent screen* → Internal (if you use Google Workspace) → add scope `.../auth/drive.file`.
3. *Credentials* → **Create OAuth client ID** (Web application) → add your Vercel URL
   (e.g. `https://editing-hub.vercel.app`) under *Authorised JavaScript origins*.
4. *Credentials* → **Create API key** (restrict it to the Picker API + your domain).
5. Add to Vercel: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_API_KEY`, and `NEXT_PUBLIC_GOOGLE_APP_ID`
   (the project *number* from the Cloud console dashboard), then redeploy.

## Local development

```bash
cp .env.example .env        # point DATABASE_URL at a local Postgres
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Without `BLOB_READ_WRITE_TOKEN`, uploads are saved to `public/uploads` (dev only).

## Notes

- Uploaded files live in Vercel Blob under unguessable public URLs (needed for streaming playback). Anyone with the
  exact URL can view the file, so don't paste raw blob URLs outside the team.
- Browsers can play H.264 .mp4/.mov. ProRes/HEVC .mov files upload fine but may not preview — export an H.264 review copy.
- Vercel Blob pricing is per GB stored + transferred; delete old projects from the Archived board to free space
  (deleting a project deletes its uploaded files).
