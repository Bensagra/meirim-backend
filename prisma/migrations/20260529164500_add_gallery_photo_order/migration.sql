-- AlterTable
ALTER TABLE "GalleryPhoto" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "GalleryPhoto_scope_displayOrder_idx" ON "GalleryPhoto"("scope", "displayOrder");
