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
      orderBy: { fecha: 'asc' }
      , include: {
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
  if (estado) {
    nuevoEstado = EstadoActividad.FUE_PLANIFICADA;
  } else {
    const totalParticipants = await prisma.activityUser.count({
      where: { activityId: id },
    });
     nuevoEstado =
      totalParticipants >= 3
        ? EstadoActividad.YA_HAY_GENTE_PERO_NO_SE_PLANIFICO
        : EstadoActividad.HAY_GENTE_PERO_NO_NECESARIA;
  }
  try {
    const updated = await prisma.activity.update({
      where: { id },
      data: { estado: nuevoEstado, notas }
    });
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export const updateActivity = async (req, res) => {
  const activityId = parseInt(req.params.id, 10);
  // destructuramos acorde al front: participants → array de DNIs, topics → array de labels
  const { participants: dnis = [], topics = [] } = req.body;

  try {
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

    // 2) Cargar usuarios existentes por DNI
    const users = await prisma.user.findMany({
      where: { dni: { in: dnis.map(String) } },
    });
    if (users.length !== dnis.length) {
      const encontrados = users.map((u) => u.dni);
      const faltantes = dnis.filter((d) => !encontrados.includes(d.toString()));
      return res
        .status(400)
        .json({ error: `Usuarios no encontrados: ${faltantes.join(', ')}` });
    }

    // 3) En transacción, agregamos sólo las nuevas relaciones (skipDuplicates)
    await prisma.$transaction([
      // vincular usuarios (sólo crea los que falten)
      prisma.activityUser.createMany({
        data: users.map((u) => ({
          activityId,
          userId: u.id,
        })),
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
