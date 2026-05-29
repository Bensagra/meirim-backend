/*
  Warnings:

  - You are about to drop the column `competitorA` on the `MesazaMatch` table. All the data in the column will be lost.
  - You are about to drop the column `competitorB` on the `MesazaMatch` table. All the data in the column will be lost.
  - You are about to drop the column `photoA` on the `MesazaMatch` table. All the data in the column will be lost.
  - You are about to drop the column `photoB` on the `MesazaMatch` table. All the data in the column will be lost.
  - Added the required column `competitorAId` to the `MesazaMatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `competitorBId` to the `MesazaMatch` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MesazaMatch" DROP COLUMN "competitorA",
DROP COLUMN "competitorB",
DROP COLUMN "photoA",
DROP COLUMN "photoB",
ADD COLUMN     "competitorAId" INTEGER NOT NULL,
ADD COLUMN     "competitorBId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "photoUrl" TEXT;

-- AddForeignKey
ALTER TABLE "MesazaMatch" ADD CONSTRAINT "MesazaMatch_competitorAId_fkey" FOREIGN KEY ("competitorAId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MesazaMatch" ADD CONSTRAINT "MesazaMatch_competitorBId_fkey" FOREIGN KEY ("competitorBId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
