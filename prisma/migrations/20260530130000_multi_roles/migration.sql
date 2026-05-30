-- Pasar de un único rol por usuario a múltiples roles.
-- Todos son MIEMBRO; además pueden tener EDITOR_FOTOS / ADMIN_ACTIVIDADES / SUPER_ADMIN.

ALTER TABLE "User" ADD COLUMN "roles" "Role"[] NOT NULL DEFAULT ARRAY['MIEMBRO']::"Role"[];

-- Migrar el rol existente al array.
UPDATE "User"
SET "roles" = CASE
  WHEN "role" = 'MIEMBRO' THEN ARRAY['MIEMBRO'::"Role"]
  ELSE ARRAY['MIEMBRO'::"Role", "role"]
END;

ALTER TABLE "User" DROP COLUMN "role";
