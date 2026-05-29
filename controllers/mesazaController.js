import { PrismaClient } from "@prisma/client";
import { getSupabaseBucket, getSupabaseClient } from "../lib/supabaseClient.js";

const prisma = new PrismaClient();

function parseDate(input) {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
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

export const listMatches = async (req, res) => {
  try {
    const items = await prisma.mesazaMatch.findMany({
      orderBy: { date: "desc" },
      include: {
        photos: true,
        competitorA: { select: { id: true, name: true, surname: true, dni: true, photoUrl: true } },
        competitorB: { select: { id: true, name: true, surname: true, dni: true, photoUrl: true } }
      }
    });
    res.json(items);
  } catch (e) {
    console.error(e);
    res.status(500).send("Error al listar la Mesaza");
  }
};

export const getNextMatch = async (req, res) => {
  try {
    const now = new Date();
    const next = await prisma.mesazaMatch.findFirst({
      where: { date: { gte: now } },
      orderBy: { date: "asc" },
      include: {
        photos: true,
        competitorA: { select: { id: true, name: true, surname: true, dni: true, photoUrl: true } },
        competitorB: { select: { id: true, name: true, surname: true, dni: true, photoUrl: true } }
      }
    });
    res.json(next || null);
  } catch (e) {
    console.error(e);
    res.status(500).send("Error al buscar el proximo enfrentamiento");
  }
};

export const createMatch = async (req, res) => {
  try {
    const {
      title,
      description,
      date,
      competitorAId,
      competitorBId,
      winner,
      photos = []
    } = req.body || {};

    const compAId = parseInt(competitorAId, 10);
    const compBId = parseInt(competitorBId, 10);

    if (!compAId || !compBId) {
      return res.status(400).send("Faltan competidores");
    }

    const parsedDate = parseDate(date);
    if (!parsedDate) {
      return res.status(400).send("Fecha invalida");
    }

    const photosData = normalizePhotos(photos);
    if (winner && !['A', 'B', 'TIE'].includes(winner)) {
      return res.status(400).send('Ganador invalido');
    }

    const created = await prisma.mesazaMatch.create({
      data: {
        title: title?.trim() || null,
        description: description?.trim() || null,
        date: parsedDate,
        competitorA: { connect: { id: compAId } },
        competitorB: { connect: { id: compBId } },
        winner: winner || null,
        photos: photosData.length ? { create: photosData } : undefined
      },
      include: {
        photos: true,
        competitorA: { select: { id: true, name: true, surname: true, dni: true, photoUrl: true } },
        competitorB: { select: { id: true, name: true, surname: true, dni: true, photoUrl: true } }
      }
    });

    res.status(201).json(created);
  } catch (e) {
    console.error(e);
    res.status(400).send("No se pudo crear el enfrentamiento");
  }
};

export const updateMatch = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID invalido");

  try {
    const {
      title,
      description,
      date,
      competitorAId,
      competitorBId,
      winner,
      photos
    } = req.body || {};

    const data = {};
    if (title !== undefined) data.title = title?.trim() || null;
    if (description !== undefined) data.description = description?.trim() || null;
    if (date !== undefined) {
      const parsed = parseDate(date);
      if (!parsed) return res.status(400).send("Fecha invalida");
      data.date = parsed;
    }
    if (competitorAId !== undefined) {
      const compAId = parseInt(competitorAId, 10);
      if (!compAId) return res.status(400).send("Competidor A invalido");
      data.competitorA = { connect: { id: compAId } };
    }
    if (competitorBId !== undefined) {
      const compBId = parseInt(competitorBId, 10);
      if (!compBId) return res.status(400).send("Competidor B invalido");
      data.competitorB = { connect: { id: compBId } };
    }
    if (winner !== undefined) {
      if (winner && !['A', 'B', 'TIE'].includes(winner)) {
        return res.status(400).send('Ganador invalido');
      }
      data.winner = winner || null;
    }

    const photosData = Array.isArray(photos) ? normalizePhotos(photos) : null;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.mesazaMatch.update({ where: { id }, data });

      if (photosData) {
        await tx.mesazaPhoto.deleteMany({ where: { matchId: id } });
        if (photosData.length) {
          await tx.mesazaPhoto.createMany({
            data: photosData.map((p) => ({
              matchId: id,
              url: p.url,
              caption: p.caption || null
            }))
          });
        }
      }

      return tx.mesazaMatch.findUnique({
        where: { id },
        include: {
          photos: true,
          competitorA: { select: { id: true, name: true, surname: true, dni: true, photoUrl: true } },
          competitorB: { select: { id: true, name: true, surname: true, dni: true, photoUrl: true } }
        }
      });
    });

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(400).send("No se pudo actualizar el enfrentamiento");
  }
};

export const deleteMatch = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID invalido");

  try {
    await prisma.mesazaMatch.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(400).send("No se pudo borrar el enfrentamiento");
  }
};

export const createUploadUrl = async (req, res) => {
  try {
    const { folder, fileName } = req.body || {};
    if (!fileName) return res.status(400).send("Falta fileName");

    const safeFolder = folder === "users" || folder === "matches" ? folder : null;
    if (!safeFolder) return res.status(400).send("Carpeta invalida");

    const safeName = sanitizeFileName(fileName);
    const stamp = Date.now();
    const path = `mesaza/${safeFolder}/${stamp}_${safeName}`;

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

export const addMatchPhotos = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID invalido");

  try {
    const { photos = [] } = req.body || {};
    const photosData = normalizePhotos(photos);
    if (!photosData.length) return res.status(400).send("No hay fotos");

    await prisma.mesazaPhoto.createMany({
      data: photosData.map((p) => ({
        matchId: id,
        url: p.url,
        caption: p.caption || null
      }))
    });

    const updated = await prisma.mesazaMatch.findUnique({
      where: { id },
      include: {
        photos: true,
        competitorA: { select: { id: true, name: true, surname: true, dni: true, photoUrl: true } },
        competitorB: { select: { id: true, name: true, surname: true, dni: true, photoUrl: true } }
      }
    });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(400).send("No se pudieron agregar las fotos");
  }
};

function sanitizeFileName(fileName) {
  const raw = String(fileName || "");
  const base = raw.split("/").pop() || "foto";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_");
}
