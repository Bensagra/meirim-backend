import { PrismaClient } from "@prisma/client";

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
      include: { photos: true }
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
      include: { photos: true }
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
      competitorA,
      competitorB,
      photoA,
      photoB,
      winner,
      photos = []
    } = req.body || {};

    if (!competitorA || !competitorB) {
      return res.status(400).send("Faltan competidores");
    }

    const parsedDate = parseDate(date);
    if (!parsedDate) {
      return res.status(400).send("Fecha invalida");
    }

    const photosData = normalizePhotos(photos);

    const created = await prisma.mesazaMatch.create({
      data: {
        title: title?.trim() || null,
        description: description?.trim() || null,
        date: parsedDate,
        competitorA: competitorA.trim(),
        competitorB: competitorB.trim(),
        photoA: photoA?.trim() || null,
        photoB: photoB?.trim() || null,
        winner: winner || null,
        photos: photosData.length ? { create: photosData } : undefined
      },
      include: { photos: true }
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
      competitorA,
      competitorB,
      photoA,
      photoB,
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
    if (competitorA !== undefined) data.competitorA = competitorA.trim();
    if (competitorB !== undefined) data.competitorB = competitorB.trim();
    if (photoA !== undefined) data.photoA = photoA?.trim() || null;
    if (photoB !== undefined) data.photoB = photoB?.trim() || null;
    if (winner !== undefined) data.winner = winner || null;

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
        include: { photos: true }
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
