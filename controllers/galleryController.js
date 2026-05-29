import { PrismaClient } from "@prisma/client";
import { getSupabaseBucket, getSupabaseClient } from "../lib/supabaseClient.js";

const prisma = new PrismaClient();

const SCOPES = {
  home: "HOME",
  mesaza: "MESAZA"
};

function parseScope(input) {
  return SCOPES[String(input || "").toLowerCase()] || null;
}

function sanitizeFileName(fileName) {
  const raw = String(fileName || "");
  const base = raw.split("/").pop() || "foto";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function normalizePhotos(photos) {
  if (!Array.isArray(photos)) return [];
  return photos
    .map((p) => {
      if (typeof p === "string") return { url: p.trim() };
      if (p && typeof p.url === "string") {
        return { url: p.url.trim(), caption: p.caption?.trim() || null };
      }
      return null;
    })
    .filter((p) => p && p.url);
}

export const listPhotos = async (req, res) => {
  const scope = parseScope(req.params.scope);
  if (!scope) return res.status(400).send("Galeria invalida");

  try {
    const photos = await prisma.galleryPhoto.findMany({
      where: { scope },
      orderBy: { createdAt: "desc" }
    });
    res.json(photos);
  } catch (e) {
    console.error(e);
    res.status(500).send("No se pudo cargar la galeria");
  }
};

export const createUploadUrl = async (req, res) => {
  const scope = parseScope(req.params.scope);
  if (!scope) return res.status(400).send("Galeria invalida");

  try {
    const { fileName } = req.body || {};
    if (!fileName) return res.status(400).send("Falta fileName");

    const safeName = sanitizeFileName(fileName);
    const folder = scope.toLowerCase();
    const path = `galleries/${folder}/${Date.now()}_${safeName}`;

    const supabase = getSupabaseClient();
    const bucket = getSupabaseBucket();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) {
      console.error(error);
      return res.status(500).send("No se pudo generar URL de subida");
    }

    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    res.json({
      signedUrl: data.signedUrl,
      path,
      publicUrl: publicData?.publicUrl || null
    });
  } catch (e) {
    console.error(e);
    res.status(500).send("No se pudo generar URL de subida");
  }
};

export const addPhotos = async (req, res) => {
  const scope = parseScope(req.params.scope);
  if (!scope) return res.status(400).send("Galeria invalida");

  try {
    const photos = normalizePhotos(req.body?.photos);
    if (!photos.length) return res.status(400).send("No hay fotos");

    await prisma.galleryPhoto.createMany({
      data: photos.map((p) => ({
        scope,
        url: p.url,
        caption: p.caption || null
      }))
    });

    const updated = await prisma.galleryPhoto.findMany({
      where: { scope },
      orderBy: { createdAt: "desc" }
    });
    res.status(201).json(updated);
  } catch (e) {
    console.error(e);
    res.status(400).send("No se pudieron guardar las fotos");
  }
};
