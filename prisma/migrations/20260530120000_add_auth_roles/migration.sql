-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MIEMBRO', 'EDITOR_FOTOS', 'ADMIN_ACTIVIDADES', 'SUPER_ADMIN');

-- AlterTable
-- Las columnas con DEFAULT permiten aplicar la migración sobre filas ya existentes.
ALTER TABLE "User"
  ADD COLUMN "password"    TEXT,
  ADD COLUMN "role"        "Role" NOT NULL DEFAULT 'MIEMBRO',
  ADD COLUMN "nickname"    TEXT,
  ADD COLUMN "bio"         TEXT,
  ADD COLUMN "accentColor" TEXT,
  ADD COLUMN "instagram"   TEXT,
  ADD COLUMN "phone"       TEXT,
  ADD COLUMN "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
