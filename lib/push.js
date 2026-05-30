// lib/push.js — Web Push (notificaciones), SIN websockets.
// El backend solo hace un POST HTTP a cada suscripción cuando hay algo nuevo.
// Si faltan las claves VAPID o la librería no está instalada, queda desactivado
// silenciosamente (el server arranca igual y el front no muestra el botón).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

let webpushPromise = null;
async function getWebpush() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return null;
  if (!webpushPromise) {
    webpushPromise = import("web-push")
      .then((mod) => {
        const webpush = mod.default || mod;
        webpush.setVapidDetails(
          process.env.VAPID_SUBJECT || "mailto:meirim.bbyo@gmail.com",
          pub,
          priv
        );
        return webpush;
      })
      .catch((e) => {
        console.warn("[push] web-push no disponible:", e.message);
        return null;
      });
  }
  return webpushPromise;
}

/** ¿Está configurado el push? (hay clave pública en el entorno) */
export function isPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY);
}

/** Clave pública VAPID para que el navegador se suscriba. */
export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

/**
 * Envía una notificación a TODAS las suscripciones guardadas (best-effort).
 * Borra las suscripciones expiradas (404/410). Nunca lanza.
 */
export async function notifyAll(payload) {
  try {
    const webpush = await getWebpush();
    if (!webpush) return { sent: 0, skipped: true };

    const subs = await prisma.pushSubscription.findMany();
    if (!subs.length) return { sent: 0 };

    const body = JSON.stringify({
      title: payload?.title || "Meirim BBYO",
      body: payload?.body || "",
      url: payload?.url || "/",
      tag: payload?.tag || "meirim"
    });

    let sent = 0;
    const stale = [];
    await Promise.all(
      subs.map(async (s) => {
        const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
        try {
          await webpush.sendNotification(subscription, body);
          sent++;
        } catch (err) {
          if (err?.statusCode === 404 || err?.statusCode === 410) stale.push(s.id);
        }
      })
    );

    if (stale.length) {
      await prisma.pushSubscription.deleteMany({ where: { id: { in: stale } } }).catch(() => {});
    }
    return { sent, removed: stale.length };
  } catch (e) {
    console.warn("[push] notifyAll falló:", e.message);
    return { sent: 0, error: true };
  }
}
