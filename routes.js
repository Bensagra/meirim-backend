import { Router } from "express";
import * as activityControllers from "./controllers/activityControllers.js";
import * as proposalControllers from "./controllers/proporsalsControllers.js";
import * as userController from "./controllers/userController.js";
const router = Router();
// Lista todos o por mes:  GET /api/activities-status?year=2025&month=7
router.post("/user", userController.createUser); // Crear usuario
router.get("/propuestas", proposalControllers.listTematicas); // Listar propuestas
router.post("/propuestas", proposalControllers.createTematica); // Crear propuesta
router.put("/actividades", activityControllers.createActivity); // Crear actividad
router.get("/actividades", activityControllers.listActivities); // Listar actividades
router.put("/actividades/:id", activityControllers.updateActivity); // Actualizar actividad
export default router;