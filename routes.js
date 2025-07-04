import { Router } from "express";
import * as activityControllers from "./controllers/activityControllers.js";
import * as proposalControllers from "./controllers/proporsalsControllers.js";
const router = Router();
// Lista todos o por mes:  GET /api/activities-status?year=2025&month=7
router.get( "/activities-status",               activityControllers.listStatus );
// Detalle de un día:      GET /api/activities-status/:date
router.get( "/activities-status/:date",         activityControllers.getStatus );
// Crear/Actualizar:       POST /api/activities-status
router.post("/activities-status",               activityControllers.upsertStatus );
// Borrar un día:          DELETE /api/activities-status/:date
router.delete("/activities-status/:date",       activityControllers.deleteStatus);

router.get(    "/proposals",                proposalControllers.listProposals );       // opcional ?date=YYYY-MM-DD
router.get(    "/proposals/:id",            proposalControllers.getProposal );
router.post(   "/proposals",                proposalControllers.createProposal );
router.delete( "/proposals/:id",          proposalControllers.deleteProposal );
export default router;