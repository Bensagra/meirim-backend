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
      orderBy: { fecha: 'desc' }
    });
    res.status(200).json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export const updateActivity = async (req, res) => {
  const activityId = parseInt(req.params.id, 10);
  const { temasId = [], user: dnis = [] } = req.body;

  try {
    // 1) Find or create cada temática por su texto
    const tematicas = await Promise.all(
      temasId.map(async (label) => {
        // buscar por el campo 'tematica'
        let tema = await prisma.tematica.findFirst({
          where: { tematica: label },
        });
        if (!tema) {
          tema = await prisma.tematica.create({
            data: { tematica: label },
          });
        }
        return tema;
      })
    );

    // 2) Cargar usuarios existentes por DNI
    const users = await prisma.user.findMany({
      where: { dni: { in: dnis.map((d) => d.toString()) } },
    });
    if (users.length !== dnis.length) {
      const encontrados = users.map((u) => u.dni);
      const faltantes = dnis.filter((d) => !encontrados.includes(d.toString()));
      return res
        .status(400)
        .json({ error: `Usuarios no encontrados: ${faltantes.join(', ')}` });
    }

    // 3) En transacción, borramos relaciones antiguas y creamos las nuevas
    await prisma.$transaction([
      // borrar vínculos previos
      prisma.activityUser.deleteMany({ where: { activityId } }),
      prisma.activityTematica.deleteMany({ where: { activityId } }),

      // recrear vínculos con usuarios
      prisma.activityUser.createMany({
        data: users.map((u) => ({
          activityId,
          userId: u.id,
        })),
        skipDuplicates: true,
      }),

      // recrear vínculos con temáticas
      prisma.activityTematica.createMany({
        data: tematicas.map((t) => ({
          activityId,
          tematicaId: t.id,
        })),
        skipDuplicates: true,
      }),
    ]);
    if (users.length >= 3) {
      prisma.activity.update({
        where: { id: activityId },
        data: { estado: EstadoActividad.YA_HAY_GENTE_PERO_NO_SE_PLANIFICO }, // Actualizar estado a confirmada si hay 3 o más participantes
      });
    }else {
      prisma.activity.update({
        where: { id: activityId },
        data: { estado: EstadoActividad.HAY_GENTE_PERO_NO_NECESARIA }, // Actualizar estado a pendiente si hay menos de 3 participantes
      });
    }

    // 4) Obtener la actividad ya actualizada
    const updated = await prisma.activity.findUnique({
      where: { id: activityId },

      include: {
        participants: { include: { user: true } },
        tematicas:    { include: { tematica: true } },
      },
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Error en updateActivity:', error);
    return res.status(500).json({ error: error.message });
  }
};
