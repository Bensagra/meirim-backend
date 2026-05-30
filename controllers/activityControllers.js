import { EstadoActividad, PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const createActivity = async (req, res) => {
  const { date, content, name } = req.body;
  try {
    const newActivity = await prisma.activity.create({
      data: {
        fecha: new Date(date),
        
        
      }
    });
    res.status(201).json(newActivity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export const listActivities = async (req, res) => {
  try {
    const activities = await prisma.activity.findMany({
      where: { fecha: { gte: new Date() },},
      orderBy: { fecha: 'asc' },
      include: {
        participants: {
          include: { user: true }
        },
        tematicas: {
          include: { tematica: true }
        }
      }
    });
    res.status(200).json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
export const patchActivity = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { estado, notas } = req.body;
  let nuevoEstado;

  // Si llega un estado válido del enum, respetarlo tal cual (lo manda el panel admin).
  if (estado && Object.values(EstadoActividad).includes(estado)) {
    nuevoEstado = estado;
  } else {
    // Si no, recalcular según la cantidad de participantes.
    const totalParticipants = await prisma.activityUser.count({
      where: { activityId: id },
    });
    nuevoEstado =
      totalParticipants >= 3
        ? EstadoActividad.YA_HAY_GENTE_PERO_NO_SE_PLANIFICO
        : totalParticipants > 0
          ? EstadoActividad.HAY_GENTE_PERO_NO_NECESARIA
          : EstadoActividad.NO_HAY_NADIE;
  }

  try {
    const data = { estado: nuevoEstado };
    if (notas !== undefined) data.notas = notas;
    const updated = await prisma.activity.update({
      where: { id },
      data
    });
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export const updateActivity = async (req, res) => {
  const activityId = parseInt(req.params.id, 10);
  // El planificador es el usuario autenticado (req.user, vía requireAuth).
  // topics → array de labels. Un SUPER_ADMIN puede además sumar otros DNIs.
  const { topics = [], participants: extraDnis = [] } = req.body;

  try {
    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) return res.status(404).json({ error: "Actividad no encontrada" });
    if (activity.blocked) return res.status(403).json({ error: "Este día está bloqueado para planificación." });

    // 1) Find or create cada temática por su texto
    const tematicas = await Promise.all(
      topics.map(async (label) => {
        let tema = await prisma.tematica.findFirst({
          where: { tematica: label },
        });
        if (!tema) {
          tema = await prisma.tematica.create({
            data: { tematica: label, usada: true },
          });
        }
        return tema;
      })
    );

    // 2) Resolver participantes: siempre el usuario autenticado. Un SUPER_ADMIN
    //    puede sumar otros por DNI.
    const userIds = new Set([req.user.id]);
    if (req.user.roles?.includes("SUPER_ADMIN") && Array.isArray(extraDnis) && extraDnis.length) {
      const extra = await prisma.user.findMany({
        where: { dni: { in: extraDnis.map(String) } },
        select: { id: true }
      });
      extra.forEach((u) => userIds.add(u.id));
    }

    // 3) En transacción, agregamos sólo las nuevas relaciones (skipDuplicates)
    await prisma.$transaction([
      // vincular usuarios (sólo crea los que falten)
      prisma.activityUser.createMany({
        data: [...userIds].map((userId) => ({ activityId, userId })),
        skipDuplicates: true,
      }),
      // vincular temáticas (idem)
      prisma.activityTematica.createMany({
        data: tematicas.map((t) => ({
          activityId,
          tematicaId: t.id,
        })),
        skipDuplicates: true,
      }),
    ]);

    // 4) Contar participantes para actualizar estado
    const totalParticipants = await prisma.activityUser.count({
      where: { activityId },
    });
    const nuevoEstado =
      totalParticipants >= 3
        ? EstadoActividad.YA_HAY_GENTE_PERO_NO_SE_PLANIFICO
        : EstadoActividad.HAY_GENTE_PERO_NO_NECESARIA;

    await prisma.activity.update({
      where: { id: activityId },
      data: { estado: nuevoEstado },
    });

    // 5) Devolver actividad actualizada con relaciones
    const updated = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        participants: {
          include: { user: true },
        },
        tematicas: {
          include: { tematica: true },
        },
      },
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Error en updateActivity:', error);
    return res.status(500).json({ error: error.message });
  }
};
