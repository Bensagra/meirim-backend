import { PrismaClient } from "@prisma/client";
import { getSupabaseBucket, getSupabaseClient } from "../lib/supabaseClient.js";
import { notifyAll } from "../lib/push.js";

const prisma = new PrismaClient();

function sanitizeFileName(fileName) {
  const raw = String(fileName || "");
  const base = raw.split("/").pop() || "flyer";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function cleanText(value, max = 5000) {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t.slice(0, max);
}

/** Listado público: destacadas primero, luego las más nuevas. */
export const listNoticias = async (_req, res) => {
  try {
    const noticias = await prisma.noticia.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }]
    });
    res.json(noticias);
  } catch (e) {
    console.error(e);
    res.status(500).send("No se pudieron cargar las noticias");
  }
};

/** Genera una signed URL de Supabase para subir el flyer (mismo patrón que galerías). */
export const createUploadUrl = async (req, res) => {
  try {
    const { fileName } = req.body || {};
    if (!fileName) return res.status(400).send("Falta fileName");

    const safeName = sanitizeFileName(fileName);
    const path = `noticias/${Date.now()}_${safeName}`;

    const supabase = getSupabaseClient();
    const bucket = getSupabaseBucket();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) {
      console.error(error);
      return res.status(500).send("No se pudo generar URL de subida");
    }

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);

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

export const createNoticia = async (req, res) => {
  try {
    const titulo = cleanText(req.body?.titulo, 200);
    const cuerpo = cleanText(req.body?.cuerpo);
    const imageUrl = cleanText(req.body?.imageUrl, 1000);
    const pinned = Boolean(req.body?.pinned);

    if (!titulo) return res.status(400).send("Falta el título");
    if (!cuerpo && !imageUrl) {
      return res.status(400).send("Agregá un texto o un flyer");
    }

    const noticia = await prisma.noticia.create({
      data: { titulo, cuerpo, imageUrl, pinned }
    });

    // Aviso push a todo el chapter (best-effort; no bloquea si push está apagado).
    try {
      await notifyAll({
        title: `📰 ${titulo}`,
        body: cuerpo ? cuerpo.slice(0, 120) : "Nueva noticia del chapter",
        url: "/noticias.html",
        tag: "noticia"
      });
    } catch { /* noop */ }

    res.status(201).json(noticia);
  } catch (e) {
    console.error(e);
    res.status(400).send("No se pudo crear la noticia");
  }
};

export const updateNoticia = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID inválido");

  try {
    const data = {};
    if (req.body?.titulo !== undefined) {
      const titulo = cleanText(req.body.titulo, 200);
      if (!titulo) return res.status(400).send("El título no puede quedar vacío");
      data.titulo = titulo;
    }
    if (req.body?.cuerpo !== undefined) data.cuerpo = cleanText(req.body.cuerpo);
    if (req.body?.imageUrl !== undefined) data.imageUrl = cleanText(req.body.imageUrl, 1000);
    if (req.body?.pinned !== undefined) data.pinned = Boolean(req.body.pinned);

    const noticia = await prisma.noticia.update({ where: { id }, data });
    res.json(noticia);
  } catch (e) {
    console.error(e);
    res.status(400).send("No se pudo actualizar la noticia");
  }
};

export const deleteNoticia = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID inválido");

  try {
    await prisma.noticia.delete({ where: { id } });
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(400).send("No se pudo borrar la noticia");
  }
};
