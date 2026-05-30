-- CreateEnum
CREATE TYPE "EstadoAsistencia" AS ENUM ('VOY', 'TAL_VEZ', 'NO_VOY');

-- CreateTable
CREATE TABLE "Asistencia" (
    "id" SERIAL NOT NULL,
    "activityId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "estado" "EstadoAsistencia" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asistencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Asistencia_activityId_idx" ON "Asistencia"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "Asistencia_activityId_userId_key" ON "Asistencia"("activityId", "userId");

-- AddForeignKey
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
