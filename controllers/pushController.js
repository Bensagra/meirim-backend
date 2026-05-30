import { PrismaClient } from "@prisma/client";
import { getVapidPublicKey, isPushConfigured } from "../lib/push.js";

const prisma = new PrismaClient();

/** Devuelve la clave pública VAPID (o null si push no está configurado). */
export const publicKey = (_req, res) => {
  res.json({ key: getVapidPublicKey(), enabled: isPushConfigured() });
};

/** Guarda (o actualiza) la suscripción push del navegador. */
export const subscribe = async (req, res) => {
  const sub = req.body?.subscription || req.body;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: "Suscripción inválida" });
  }

  try {
    const userId = req.user?.id ?? null;
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh, auth, userId },
      create: { endpoint, p256dh, auth, userId }
    });
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error("Error en subscribe:", e);
    res.status(500).json({ error: "No se pudo guardar la suscripción" });
  }
};

/** Borra la suscripción (cuando el usuario desactiva los avisos). */
export const unsubscribe = async (req, res) => {
  const endpoint = req.body?.endpoint || req.body?.subscription?.endpoint;
  if (!endpoint) return res.status(400).json({ error: "Falta endpoint" });
  try {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    res.json({ ok: true });
  } catch (e) {
    console.error("Error en unsubscribe:", e);
    res.status(500).json({ error: "No se pudo borrar la suscripción" });
  }
};
