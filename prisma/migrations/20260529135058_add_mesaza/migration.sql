-- CreateEnum
CREATE TYPE "MesazaWinner" AS ENUM ('A', 'B', 'TIE');

-- CreateTable
CREATE TABLE "MesazaMatch" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "competitorA" TEXT NOT NULL,
    "competitorB" TEXT NOT NULL,
    "photoA" TEXT,
    "photoB" TEXT,
    "winner" "MesazaWinner",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MesazaMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MesazaPhoto" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "matchId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MesazaPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MesazaMatch_date_idx" ON "MesazaMatch"("date");

-- CreateIndex
CREATE INDEX "MesazaPhoto_matchId_idx" ON "MesazaPhoto"("matchId");

-- AddForeignKey
ALTER TABLE "MesazaPhoto" ADD CONSTRAINT "MesazaPhoto_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "MesazaMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
