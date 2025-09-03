import { Router } from "express";
import * as activityControllers from "./controllers/activityControllers.js";
import * as proposalControllers from "./controllers/proporsalsControllers.js";
import * as userController from "./controllers/userController.js";
import { EstadoActividad, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const router = Router();
// Lista todos o por mes:  GET /api/activities-status?year=2025&month=7
router.post("/user", userController.createUser); // Crear usuario
router.get("/user/:dni", userController.getUser); // Obtener usuario por DNI
router.get("/propuestas", proposalControllers.listTematicas); // Listar propuestas
router.post("/propuestas", proposalControllers.createTematica); // Crear propuesta
router.put("/actividades", activityControllers.createActivity); // Crear actividad
router.get("/actividades", activityControllers.listActivities); // Listar actividades
router.put("/actividades/:id", activityControllers.updateActivity); // Actualizar actividad
router.patch('/actividades/:id', activityControllers.patchActivity); // Actualizar estado de actividad

router.get('/api/activities/upcoming', async (req, res) => {
  try {
    const now = new Date();
    const items = await prisma.activity.findMany({
      where: { fecha: { gte: now } },
      orderBy: { fecha: 'asc' },
      take: 10,
      include: {
        participants: { include: { user: true } },
        tematicas: { include: { tematica: true } }
      }
    });
    res.json(items);
  } catch (e) {
    res.status(500).send('Error al listar actividades');
  }
});

router.post('/api/activities', async (req, res) => {
  try {
    const { fecha, estado, participants = [], tematicas = [], notas } = req.body;

    // Resolver participantes: si son números, son IDs; si son strings no numéricas, buscarlas por name (opcional)
    const participantIds = [];
    for (const p of participants) {
      if (/^\\d+$/.test(String(p))) {
        participantIds.push(Number(p));
      } else {
        const u = await prisma.user.findFirst({ where: { name: String(p) } });
        if (u) participantIds.push(u.id);
      }
    }

    // Resolver temáticas: IDs o crear por título si no existe
    const tematicaIds = [];
    for (const t of tematicas) {
      if (/^\\d+$/.test(String(t))) {
        tematicaIds.push(Number(t));
      } else {
        const existing = await prisma.tematica.findFirst({ where: { tematica: String(t) } });
        const tm = existing ?? await prisma.tematica.create({ data: { tematica: String(t) } });
        tematicaIds.push(tm.id);
      }
    }

    const act = await prisma.activity.create({
      data: {
        fecha: new Date(fecha),
        estado,
        notas,
        participants: {
          create: participantIds.map(id => ({ userId: id }))
        },
        tematicas: {
          create: tematicaIds.map(id => ({ tematicaId: id }))
        }
      },
      include: {
        participants: { include: { user: true } },
        tematicas: { include: { tematica: true } }
      }
    });

    // marcar temáticas usadas
    await prisma.tematica.updateMany({
      where: { id: { in: tematicaIds } },
      data: { usada: true }
    });

    res.json(act);
  } catch (e) {
    console.error(e);
    res.status(400).send('No se pudo crear la actividad');
  }
});
router.patch('/actividades/:id', updateActivityState);

// ---- Temáticas ----
router.get('/api/tematicas', async (req, res) => {
  try {
    const items = await prisma.tematica.findMany({
        where: { usada: false },
      orderBy: [{ usada: 'asc' }, { createdAt: 'desc' }]
    });
    res.json(items);
  } catch (e) {
    res.status(500).send('Error al listar temáticas');
  }
});

router.post('/api/tematicas', async (req, res) => {
  try {
    const { tematica } = req.body;
    const created = await prisma.tematica.create({ data: { tematica } });
    res.json(created);
  } catch (e) {
    res.status(400).send('No se pudo crear la temática');
  }
});

// ---- PenPals lead ----
router.post('/api/penpals', async (req, res) => {
  try {
    const { nombre, email, idioma } = req.body;
    const lead = await prisma.penpalLead.upsert({
      where: { email_idioma: { email, idioma } },
      update: { nombre },
      create: { nombre, email, idioma }
    });
    res.json(lead);
  } catch (e) {
    console.error(e);
    res.status(400).send('No se pudo registrar el interés');
  }
});

// ---- Tienda notify ----
router.post('/api/notify', async (req, res) => {
  try {
    const { email, preferencia } = req.body;
    const rec = await prisma.shopNotify.create({ data: { email, preferencia } });
    res.json(rec);
  } catch (e) {
    console.error(e);
    res.status(400).send('No se pudo suscribir');
  }
});
export default router;