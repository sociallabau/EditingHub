-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "drawing" JSONB;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "aiQa" JSONB,
ADD COLUMN     "aiQaAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Transcript" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'EDIT',
    "sourceName" TEXT NOT NULL,
    "duration" DOUBLE PRECISION,
    "text" TEXT NOT NULL,
    "segments" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "videoId" TEXT,

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transcript_videoId_key" ON "Transcript"("videoId");

-- AddForeignKey
ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
