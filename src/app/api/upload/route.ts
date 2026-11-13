import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

// Issues short-lived tokens so the browser can upload large video files straight to Vercel Blob
// (bypassing the 4.5MB serverless body limit). The DB record is created by a server action
// after the upload finishes.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const user = await getUser();
        if (!user) throw new Error("Not signed in");
        return {
          allowedContentTypes: [
            "video/*",
            "image/*",
            "audio/*",
            "application/pdf",
            "application/zip",
            "application/octet-stream",
          ],
          maximumSizeInBytes: 5 * 1024 * 1024 * 1024, // 5GB
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
    });
    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
