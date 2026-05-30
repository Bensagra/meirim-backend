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

const PUBLIC_USER = { id: true, name: true, surname: true, dni: true, photoUrl: true };

/**
 * Ranking histórico de la Mesaza, calculado sobre los enfrentamientos que ya
 * tienen ganador cargado. No usa tablas nuevas. Devuelve, por competidor:
 * victorias, derrotas, empates, jugados, % de victorias y racha de wins actual.
 */
export const getRanking = async (_req, res) => {
  try {
    const matches = await prisma.mesazaMatch.findMany({
      where: { winner: { not: null } },
      orderBy: { date: "asc" }, // cronológico: la racha se cuenta desde el final
      include: { competitorA: { select: PUBLIC_USER }, competitorB: { select: PUBLIC_USER } }
    });

    const stats = new Map();
    const ensure = (u) => {
      if (!u) return null;
      if (!stats.has(u.id)) {
        stats.set(u.id, { user: u, wins: 0, losses: 0, ties: 0, played: 0, history: [] });
      } else {
        stats.get(u.id).user = u;
      }
      return stats.get(u.id);
    };

    for (const m of matches) {
      const a = ensure(m.competitorA);
      const b = ensure(m.competitorB);
      if (!a || !b) continue;
      a.played++; b.played++;
      if (m.winner === "A") { a.wins++; b.losses++; a.history.push("W"); b.history.push("L"); }
      else if (m.winner === "B") { b.wins++; a.losses++; b.history.push("W"); a.history.push("L"); }
      else { a.ties++; b.ties++; a.history.push("T"); b.history.push("T"); }
    }

    const ranking = [...stats.values()].map((s) => {
      let streak = 0;
      for (let i = s.history.length - 1; i >= 0 && s.history[i] === "W"; i--) streak++;
      const winRate = s.played ? Math.round((s.wins / s.played) * 100) : 0;
      return {
        user: s.user,
        wins: s.wins,
        losses: s.losses,
        ties: s.ties,
        played: s.played,
        winRate,
        streak
      };
    });

    ranking.sort((x, y) =>
      y.wins - x.wins ||
      y.winRate - x.winRate ||
      x.losses - y.losses ||
      `${x.user.name || ""} ${x.user.surname || ""}`.localeCompare(`${y.user.name || ""} ${y.user.surname || ""}`)
    );

    res.json(ranking);
  } catch (e) {
    console.error(e);
    res.status(500).send("No se pudo calcular el ranking");
  }
};
