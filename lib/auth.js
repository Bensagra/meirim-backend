import crypto from "crypto-js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Secreto para firmar los tokens. Configurar AUTH_SECRET en el entorno (Vercel).
const SECRET = process.env.AUTH_SECRET || "meirim-dev-secret-cambiame";
// Duración del token: 30 días.
const TTL_MS = 1000 * 60 * 60 * 24 * 30;

if (!process.env.AUTH_SECRET) {
  console.warn("[auth] AUTH_SECRET no está configurado. Usando secreto de desarrollo (no seguro).");
}

// ---- Jerarquía de roles ----
// Cada rol "contiene" a los de menor nivel salvo el caso especial de EDITOR_FOTOS,
// que es una capacidad lateral (solo fotos). Se maneja explícito en requireRole.
export const ROLES = ["MIEMBRO", "EDITOR_FOTOS", "ADMIN_ACTIVIDADES", "SUPER_ADMIN"];

function base64url(input) {
  return Buffer.from(input, "utf8").toString("base64url");
}
function fromBase64url(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}
function sign(body) {
  return crypto.HmacSHA256(body, SECRET).toString(crypto.enc.Hex);
}

/** Firma un token con el payload dado (incluye expiración). */
export function signToken(payload) {
  const body = base64url(JSON.stringify({ ...payload, exp: Date.now() + TTL_MS }));
  return `${body}.${sign(body)}`;
}

/** Verifica un token y devuelve el payload, o null si es inválido/expirado. */
export function verifyToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  // Comparación en tiempo constante.
  const expected = sign(body);
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(fromBase64url(body));
    if (!payload?.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function readToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

/** Devuelve un objeto de usuario sin campos sensibles. */
export function publicUser(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
}

/** Middleware: adjunta req.user si hay token válido, sin bloquear. */
export async function optionalAuth(req, _res, next) {
  const token = readToken(req);
  const payload = token ? verifyToken(token) : null;
  if (payload?.uid) {
    try {
      const user = await prisma.user.findUnique({ where: { id: Number(payload.uid) } });
      if (user) req.user = user;
    } catch { /* noop */ }
  }
  next();
}

/** Middleware: exige sesión válida. */
export async function requireAuth(req, res, next) {
  const token = readToken(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload?.uid) return res.status(401).json({ error: "Necesitás iniciar sesión." });
  try {
    const user = await prisma.user.findUnique({ where: { id: Number(payload.uid) } });
    if (!user) return res.status(401).json({ error: "Sesión inválida." });
    req.user = user;
    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/**
 * Middleware: exige que el usuario tenga alguno de los roles indicados.
 * SUPER_ADMIN siempre pasa.
 */
export function requireRole(...allowed) {
  return async (req, res, next) => {
    await requireAuth(req, res, () => {
      const role = req.user?.role;
      if (role === "SUPER_ADMIN" || allowed.includes(role)) return next();
      return res.status(403).json({ error: "No tenés permisos para esta acción." });
    });
  };
}
