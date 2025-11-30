/*
  Warnings:

  - You are about to drop the column `avatar` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `nfc` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `occupation` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Cart` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Computer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ComputerToken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Room` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Token` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[dni]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `dni` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `surname` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EstadoActividad" AS ENUM ('NO_HAY_NADIE', 'HAY_GENTE_PERO_NO_NECESARIA', 'YA_HAY_GENTE_PERO_NO_SE_PLANIFICO', 'FUE_PLANIFICADA', 'FUE_DADA_LA_PLANIFICACION');

-- DropForeignKey
ALTER TABLE "Cart" DROP CONSTRAINT "Cart_roomId_fkey";

-- DropForeignKey
ALTER TABLE "Computer" DROP CONSTRAINT "Computer_cartId_fkey";

-- DropForeignKey
ALTER TABLE "ComputerToken" DROP CONSTRAINT "ComputerToken_computerId_fkey";

-- DropForeignKey
ALTER TABLE "ComputerToken" DROP CONSTRAINT "ComputerToken_tokenId_fkey";

-- DropForeignKey
ALTER TABLE "Token" DROP CONSTRAINT "Token_cartId_fkey";

-- DropForeignKey
ALTER TABLE "Token" DROP CONSTRAINT "Token_userId_fkey";

-- DropIndex
DROP INDEX "User_id_key";

-- DropIndex
DROP INDEX "User_nfc_key";

-- DropIndex
DROP INDEX "User_username_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "avatar",
DROP COLUMN "nfc",
DROP COLUMN "occupation",
DROP COLUMN "password",
DROP COLUMN "username",
ADD COLUMN     "dni" TEXT NOT NULL,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "surname" TEXT NOT NULL;

-- DropTable
DROP TABLE "Cart";

-- DropTable
DROP TABLE "Computer";

-- DropTable
DROP TABLE "ComputerToken";

-- DropTable
DROP TABLE "Room";

-- DropTable
DROP TABLE "Token";

-- CreateTable
CREATE TABLE "Tematica" (
    "id" SERIAL NOT NULL,
    "tematica" TEXT NOT NULL,
    "usada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tematica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoActividad" NOT NULL DEFAULT 'NO_HAY_NADIE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notas" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityUser" (
    "activityId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "ActivityUser_pkey" PRIMARY KEY ("activityId","userId")
);

-- CreateTable
CREATE TABLE "ActivityTematica" (
    "activityId" INTEGER NOT NULL,
    "tematicaId" INTEGER NOT NULL,

    CONSTRAINT "ActivityTematica_pkey" PRIMARY KEY ("activityId","tematicaId")
);

-- CreateTable
CREATE TABLE "DisponibilidadHorarios" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "dia" TEXT NOT NULL,
    "horario" TEXT NOT NULL,

    CONSTRAINT "DisponibilidadHorarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PenpalLead" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "idioma" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PenpalLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopNotify" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "preferencia" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopNotify_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaNominacion" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CategoriaNominacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campista" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Campista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nominacion" (
    "id" SERIAL NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "campistaId" INTEGER NOT NULL,
    "votante" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Nominacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pregunta100" (
    "id" SERIAL NOT NULL,
    "pregunta" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pregunta100_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opcion100" (
    "id" SERIAL NOT NULL,
    "preguntaId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "posicion" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "Opcion100_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Activity_fecha_key" ON "Activity"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "DisponibilidadHorarios_userId_dia_horario_key" ON "DisponibilidadHorarios"("userId", "dia", "horario");

-- CreateIndex
CREATE UNIQUE INDEX "PenpalLead_email_idioma_key" ON "PenpalLead"("email", "idioma");

-- CreateIndex
CREATE INDEX "ShopNotify_email_idx" ON "ShopNotify"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaNominacion_nombre_key" ON "CategoriaNominacion"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Campista_nombre_key" ON "Campista"("nombre");

-- CreateIndex
CREATE INDEX "Nominacion_categoriaId_idx" ON "Nominacion"("categoriaId");

-- CreateIndex
CREATE INDEX "Nominacion_campistaId_idx" ON "Nominacion"("campistaId");

-- CreateIndex
CREATE UNIQUE INDEX "Nominacion_categoriaId_votante_key" ON "Nominacion"("categoriaId", "votante");

-- CreateIndex
CREATE INDEX "Pregunta100_activa_idx" ON "Pregunta100"("activa");

-- CreateIndex
CREATE INDEX "Opcion100_preguntaId_idx" ON "Opcion100"("preguntaId");

-- CreateIndex
CREATE UNIQUE INDEX "User_dni_key" ON "User"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "ActivityUser" ADD CONSTRAINT "ActivityUser_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityUser" ADD CONSTRAINT "ActivityUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityTematica" ADD CONSTRAINT "ActivityTematica_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityTematica" ADD CONSTRAINT "ActivityTematica_tematicaId_fkey" FOREIGN KEY ("tematicaId") REFERENCES "Tematica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisponibilidadHorarios" ADD CONSTRAINT "DisponibilidadHorarios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nominacion" ADD CONSTRAINT "Nominacion_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaNominacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nominacion" ADD CONSTRAINT "Nominacion_campistaId_fkey" FOREIGN KEY ("campistaId") REFERENCES "Campista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opcion100" ADD CONSTRAINT "Opcion100_preguntaId_fkey" FOREIGN KEY ("preguntaId") REFERENCES "Pregunta100"("id") ON DELETE CASCADE ON UPDATE CASCADE;
