import { PrismaClient } from "@prisma/client";
import { publicUser } from "../lib/auth.js";
import { getSupabaseBucket, getSupabaseClient } from "../lib/supabaseClient.js";

const prisma = new PrismaClient();

const ROLES = ["MIEMBRO", "EDITOR_FOTOS", "ADMIN_ACTIVIDADES", "SUPER_ADMIN"];

function sanitizeFileName(fileName) {
  const raw = String(fileName || "");
  const base = raw.split("/").pop() || "foto";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

/**
 * Crear usuario "suelto" (sin contraseña). Se mantiene por compatibilidad,
 * pero el alta normal ahora es vía /auth/register. Útil para que un admin
 * pre-cargue gente.
 */
export const createUser = async (req, res) => {
  const { name, surname, email, dni } = req.body;
  try {
    const user = await prisma.user.create({
      data: { name, surname, email, dni: dni.toString() }
    });
    res.status(201).json(publicUser(user));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUser = async (req, res) => {
  const { dni } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { dni: dni.toString() } });
    if (user) res.status(200).json(publicUser(user));
    else res.status(404).json({ message: "User not found" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Listar usuarios. Si query incluye ?full=1 (solo admins, ya gateado en routes),
 * devuelve datos completos para administración (rol, email, etc.).
 */
export const listUsers = async (req, res) => {
  const query = (req.query.q || "").toString().trim();
  const full = req.query.full === "1";
  try {
    const users = await prisma.user.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { surname: { contains: query, mode: "insensitive" } },
              { nickname: { contains: query, mode: "insensitive" } },
              { dni: { contains: query } }
            ]
          }
        : undefined,
      orderBy: [{ name: "asc" }, { surname: "asc" }],
      select: full
        ? {
            id: true, name: true, surname: true, nickname: true, dni: true,
            email: true, role: true, photoUrl: true, createdAt: true,
            password: false
          }
        : { id: true, name: true, surname: true, nickname: true, dni: true, photoUrl: true }
    });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Foto legacy (mantiene el endpoint viejo). */
export const updateUserPhoto = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { photoUrl, force } = req.body || {};
  if (Number.isNaN(id)) return res.status(400).send("ID invalido");
  if (!photoUrl) return res.status(400).send("Falta photoUrl");
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).send("Usuario no encontrado");
    if (user.photoUrl && !force) return res.status(409).send("El usuario ya tiene foto");
    const updated = await prisma.user.update({ where: { id }, data: { photoUrl: photoUrl.toString() } });
    res.status(200).json(publicUser(updated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Actualizar el propio perfil (requireAuth). Solo campos personalizables.
 * Un usuario solo puede editarse a sí mismo (salvo SUPER_ADMIN).
 */
export const updateProfile = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const isSelf = req.user?.id === id;
  const isSuper = req.user?.role === "SUPER_ADMIN";
  if (!isSelf && !isSuper) return res.status(403).json({ error: "No podés editar este perfil." });

  const allowed = ["name", "surname", "nickname", "bio", "accentColor", "instagram", "phone", "photoUrl", "email"];
  const data = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      const val = req.body[key];
      data[key] = val === "" ? null : (typeof val === "string" ? val.trim() : val);
    }
  }
  try {
    const updated = await prisma.user.update({ where: { id }, data });
    res.json(publicUser(updated));
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ error: "Ese email ya está en uso." });
    res.status(500).json({ error: error.message });
  }
};

/** Cambiar el rol de un usuario (solo SUPER_ADMIN, gateado en routes). */
export const updateUserRole = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { role } = req.body || {};
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  if (!ROLES.includes(role)) return res.status(400).json({ error: "Rol inválido" });

  // Evitar que un super admin se quite el último super admin a sí mismo y quede el sistema sin admins.
  if (req.user?.id === id && role !== "SUPER_ADMIN") {
    const superAdmins = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
    if (superAdmins <= 1) {
      return res.status(400).json({ error: "No podés quitarte el último rol de Super Admin." });
    }
  }
  try {
    const updated = await prisma.user.update({ where: { id }, data: { role } });
    res.json(publicUser(updated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** URL firmada para subir el avatar del usuario autenticado. */
export const createAvatarUploadUrl = async (req, res) => {
  try {
    const { fileName } = req.body || {};
    if (!fileName) return res.status(400).json({ error: "Falta fileName" });

    const safeName = sanitizeFileName(fileName);
    const path = `avatars/${req.user.id}/${Date.now()}_${safeName}`;

    const supabase = getSupabaseClient();
    const bucket = getSupabaseBucket();
    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
    if (error) {
      console.error(error);
      return res.status(500).json({ error: "No se pudo generar URL de subida" });
    }
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
    res.json({ signedUrl: data.signedUrl, path, publicUrl: publicData?.publicUrl || null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "No se pudo generar URL de subida" });
  }
};
