import { Router } from "express";
import * as activityControllers from "./controllers/activityControllers.js";
import * as proposalControllers from "./controllers/proporsalsControllers.js";
import * as userController from "./controllers/userController.js";
import * as authController from "./controllers/authController.js";
import * as nominacionesController from "./controllers/nominacionesController.js";
import * as meirimers100Controller from "./controllers/meirimers100Controller.js";
import * as mesazaController from "./controllers/mesazaController.js";
import * as galleryController from "./controllers/galleryController.js";
import * as noticiasController from "./controllers/noticiasController.js";
import * as productosController from "./controllers/productosController.js";
import { requireAuth, requireRole } from "./lib/auth.js";
import { EstadoActividad, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const router = Router();

// ====== AUTH ======
router.post("/auth/register", authController.register);
router.post("/auth/login", authController.login);
router.get("/auth/me", requireAuth, authController.me);
router.post("/auth/change-password", requireAuth, authController.changePassword);
router.post("/auth/bootstrap-admin", authController.bootstrapAdmin);

// ====== USERS / PERFILES ======
router.post("/user", requireRole("ADMIN_ACTIVIDADES"), userController.createUser); // pre-cargar gente (admin)
router.get("/user/:dni", userController.getUser); // lookup público (sin datos sensibles)
router.get("/users", userController.listUsers); // listado público mínimo (mesaza, etc.)
router.patch("/users/:id/photo", userController.updateUserPhoto); // legacy
router.patch("/users/:id/profile", requireAuth, userController.updateProfile); // editar perfil propio
router.post("/uploads/avatar-url", requireAuth, userController.createAvatarUploadUrl);

// Gestión de usuarios (Super Admin)
router.get("/admin/users", requireRole("SUPER_ADMIN"), (req, res) => {
  req.query.full = "1";
  return userController.listUsers(req, res);
});
router.patch("/users/:id/roles", requireRole("SUPER_ADMIN"), userController.updateUserRoles);

// ====== TEMÁTICAS / PROPUESTAS ======
router.get("/propuestas", proposalControllers.listTematicas);
router.post("/propuestas", proposalControllers.createTematica); // Banco de Ideas: anónimo, sin login

// ====== ACTIVIDADES ======
router.put("/actividades", requireRole("ADMIN_ACTIVIDADES"), activityControllers.createActivity); // crear
router.get("/actividades", activityControllers.listActivities); // listar (público)
router.put("/actividades/:id", requireAuth, activityControllers.updateActivity); // planificar (miembro)
router.patch("/actividades/:id", requireRole("ADMIN_ACTIVIDADES"), activityControllers.patchActivity); // estado/notas (admin)

router.get('/activities/upcoming', async (req, res) => {
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

router.post('/activities', requireRole("ADMIN_ACTIVIDADES"), async (req, res) => {
  try {
    const { fecha, estado, participants = [], tematicas = [], notas } = req.body;

    // Resolver participantes: si son números, son IDs; si son strings no numéricas, buscarlas por name (opcional)
    const participantIds = [];
    for (const p of participants) {
      if (/^\d+$/.test(String(p))) {
        participantIds.push(Number(p));
      } else {
        const u = await prisma.user.findFirst({ where: { name: String(p) } });
        if (u) participantIds.push(u.id);
      }
    }

    // Resolver temáticas: IDs o crear por título si no existe
    const tematicaIds = [];
    for (const t of tematicas) {
      if (/^\d+$/.test(String(t))) {
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

// ---- Temáticas (legacy /tematicas usado por el home) ----
router.get('/tematicas', async (req, res) => {
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

router.post('/tematicas', async (req, res) => { // Banco de Ideas: anónimo, sin login
  try {
    const { tematica } = req.body;
    const created = await prisma.tematica.create({ data: { tematica } });
    res.json(created);
  } catch (e) {
    res.status(400).send('No se pudo crear la temática');
  }
});

// ---- PenPals lead (público) ----
router.post('/penpals', async (req, res) => {
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

// ---- Tienda notify (público) ----
router.post('/notify', async (req, res) => {
  try {
    const { email, preferencia } = req.body;
    const rec = await prisma.shopNotify.create({ data: { email, preferencia } });
    res.json(rec);
  } catch (e) {
    console.error(e);
    res.status(400).send('No se pudo suscribir');
  }
});

// ---- Nominaciones (DESACTIVADO) ----
// Las rutas de Nominaciones quedaron deshabilitadas a pedido del chapter.
// Se conservan el controller (nominacionesController.js) y las tablas en la DB
// por si se quiere reactivar; basta con descomentar este bloque.
// router.get('/nominaciones/categorias', nominacionesController.getCategorias);
// router.post('/nominaciones/categorias', requireRole("ADMIN_ACTIVIDADES"), nominacionesController.createCategoria);
// router.get('/nominaciones/campistas', nominacionesController.getCampistas);
// router.post('/nominaciones/campistas', requireRole("ADMIN_ACTIVIDADES"), nominacionesController.createCampista);
// router.post('/nominaciones/votar', nominacionesController.votar);
// router.get('/nominaciones/votos/:votante', nominacionesController.getVotosUsuario);
// router.get('/nominaciones/resultados', nominacionesController.getResultados);
// router.post('/nominaciones/inicializar', requireRole("ADMIN_ACTIVIDADES"), nominacionesController.inicializarDatos);

// ---- 100 Meirimers Dicen ----
router.get('/100meirimers/preguntas', meirimers100Controller.getPreguntasJuego);
router.post('/100meirimers/verificar', meirimers100Controller.verificarOrden);
router.get('/100meirimers/admin/preguntas', requireRole("ADMIN_ACTIVIDADES"), meirimers100Controller.getAllPreguntas);
router.post('/100meirimers/admin/preguntas', requireRole("ADMIN_ACTIVIDADES"), meirimers100Controller.crearPregunta);
router.put('/100meirimers/admin/preguntas/:id', requireRole("ADMIN_ACTIVIDADES"), meirimers100Controller.actualizarPregunta);
router.delete('/100meirimers/admin/preguntas/:id', requireRole("ADMIN_ACTIVIDADES"), meirimers100Controller.eliminarPregunta);
router.get('/100meirimers/admin/estadisticas', requireRole("ADMIN_ACTIVIDADES"), meirimers100Controller.getEstadisticas);
router.post('/100meirimers/admin/inicializar', requireRole("ADMIN_ACTIVIDADES"), meirimers100Controller.inicializarDatos);

// ---- Mesaza ----
router.get('/mesaza', mesazaController.listMatches);
router.get('/mesaza/next', mesazaController.getNextMatch);
router.get('/mesaza/ranking', mesazaController.getRanking); // público: tabla histórica
router.post('/mesaza/upload-url', requireRole("ADMIN_ACTIVIDADES"), mesazaController.createUploadUrl);
router.post('/mesaza/:id/photos', requireRole("ADMIN_ACTIVIDADES"), mesazaController.addMatchPhotos);
router.post('/mesaza', requireRole("ADMIN_ACTIVIDADES"), mesazaController.createMatch);
router.patch('/mesaza/:id', requireRole("ADMIN_ACTIVIDADES"), mesazaController.updateMatch);
router.delete('/mesaza/:id', requireRole("ADMIN_ACTIVIDADES"), mesazaController.deleteMatch);

// ---- Galerías ----
router.get('/galleries/:scope/photos', galleryController.listPhotos);
router.post('/galleries/:scope/upload-url', requireRole("EDITOR_FOTOS", "ADMIN_ACTIVIDADES"), galleryController.createUploadUrl);
router.post('/galleries/:scope/photos', requireRole("EDITOR_FOTOS", "ADMIN_ACTIVIDADES"), galleryController.addPhotos);
router.patch('/galleries/:scope/photos/order', requireRole("EDITOR_FOTOS", "ADMIN_ACTIVIDADES"), galleryController.reorderPhotos);

// ---- Noticias del chapter ----
router.get('/noticias', noticiasController.listNoticias); // público
router.post('/noticias/upload-url', requireRole("EDITOR_FOTOS", "ADMIN_ACTIVIDADES"), noticiasController.createUploadUrl);
router.post('/noticias', requireRole("EDITOR_FOTOS", "ADMIN_ACTIVIDADES"), noticiasController.createNoticia);
router.patch('/noticias/:id', requireRole("EDITOR_FOTOS", "ADMIN_ACTIVIDADES"), noticiasController.updateNoticia);
router.delete('/noticias/:id', requireRole("EDITOR_FOTOS", "ADMIN_ACTIVIDADES"), noticiasController.deleteNoticia);

// ---- Tienda Meiru (vidriera) ----
router.get('/productos', productosController.listProductos); // público (solo activos)
router.post('/productos/upload-url', requireRole("ADMIN_ACTIVIDADES"), productosController.createUploadUrl);
router.post('/productos', requireRole("ADMIN_ACTIVIDADES"), productosController.createProducto);
router.patch('/productos/:id', requireRole("ADMIN_ACTIVIDADES"), productosController.updateProducto);
router.delete('/productos/:id', requireRole("ADMIN_ACTIVIDADES"), productosController.deleteProducto);

export default router;
