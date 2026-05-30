import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { signToken, publicUser } from "../lib/auth.js";

const prisma = new PrismaClient();

const cleanDni = (dni) => String(dni ?? "").replace(/\D/g, "").trim();

/**
 * Registro / "reclamar" cuenta.
 * - Si el DNI no existe -> crea un usuario MIEMBRO con contraseña.
 * - Si el DNI existe pero NO tiene contraseña (cuenta legacy creada al planificar)
 *   -> permite reclamarla seteando la contraseña (y completa datos que falten).
 * - Si el DNI ya tiene contraseña -> error (que inicie sesión).
 */
export const register = async (req, res) => {
  try {
    const { name, surname, email, password } = req.body || {};
    const dni = cleanDni(req.body?.dni);

    if (!dni || !password) return res.status(400).json({ error: "Faltan DNI o contraseña." });
    if (String(password).length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
    }

    const existing = await prisma.user.findUnique({ where: { dni } });
    const hash = await bcrypt.hash(String(password), 10);

    if (existing) {
      if (existing.password) {
        return res.status(409).json({ error: "Ya existe una cuenta con ese DNI. Iniciá sesión." });
      }
      // Reclamar cuenta legacy
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          password: hash,
          name: name?.trim() || existing.name,
          surname: surname?.trim() || existing.surname,
          email: email?.trim() || existing.email
        }
      });
      const token = signToken({ uid: updated.id });
      return res.status(200).json({ token, user: publicUser(updated) });
    }

    if (!name || !surname || !email) {
      return res.status(400).json({ error: "Faltan nombre, apellido o email." });
    }

    const created = await prisma.user.create({
      data: {
        name: name.trim(),
        surname: surname.trim(),
        email: email.trim(),
        dni,
        password: hash,
        roles: ["MIEMBRO"]
      }
    });
    const token = signToken({ uid: created.id });
    res.status(201).json({ token, user: publicUser(created) });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({ error: "Ese email o DNI ya está en uso." });
    }
    res.status(500).json({ error: error.message });
  }
};

/** Login con DNI + contraseña. */
export const login = async (req, res) => {
  try {
    const dni = cleanDni(req.body?.dni);
    const { password } = req.body || {};
    if (!dni || !password) return res.status(400).json({ error: "Faltan DNI o contraseña." });

    const user = await prisma.user.findUnique({ where: { dni } });
    if (!user || !user.password) {
      return res.status(401).json({ error: "DNI o contraseña incorrectos." });
    }
    const ok = await bcrypt.compare(String(password), user.password);
    if (!ok) return res.status(401).json({ error: "DNI o contraseña incorrectos." });

    const token = signToken({ uid: user.id });
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Devuelve el usuario autenticado (requiere requireAuth antes). */
export const me = async (req, res) => {
  res.json({ user: publicUser(req.user) });
};

/** Cambiar la propia contraseña. */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres." });
    }
    const user = req.user;
    if (user.password) {
      const ok = await bcrypt.compare(String(currentPassword || ""), user.password);
      if (!ok) return res.status(401).json({ error: "La contraseña actual no es correcta." });
    }
    const hash = await bcrypt.hash(String(newPassword), 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hash } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Bootstrap del primer SUPER_ADMIN.
 * Protegido por el header x-bootstrap-secret === ADMIN_BOOTSTRAP_SECRET.
 * Promueve (o crea) al usuario con el DNI dado a SUPER_ADMIN.
 */
export const bootstrapAdmin = async (req, res) => {
  try {
    const secret = req.headers["x-bootstrap-secret"];
    if (!process.env.ADMIN_BOOTSTRAP_SECRET || secret !== process.env.ADMIN_BOOTSTRAP_SECRET) {
      return res.status(403).json({ error: "No autorizado." });
    }
    const dni = cleanDni(req.body?.dni);
    if (!dni) return res.status(400).json({ error: "Falta DNI." });

    const user = await prisma.user.findUnique({ where: { dni } });
    if (!user) return res.status(404).json({ error: "No existe un usuario con ese DNI. Registralo primero." });

    const roles = Array.from(new Set([...(user.roles || []), "MIEMBRO", "SUPER_ADMIN"]));
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { roles: { set: roles } }
    });
    res.json({ ok: true, user: publicUser(updated) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
