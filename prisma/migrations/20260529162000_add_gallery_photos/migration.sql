-- CreateEnum
CREATE TYPE "GalleryScope" AS ENUM ('HOME', 'MESAZA');

-- CreateTable
CREATE TABLE "GalleryPhoto" (
    "id" SERIAL NOT NULL,
    "scope" "GalleryScope" NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GalleryPhoto_scope_createdAt_idx" ON "GalleryPhoto"("scope", "createdAt");
