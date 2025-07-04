import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// GET /api/proposals?date=YYYY-MM-DD
// Si pasás date, devuelve sólo las proposals de esa actividad.
// Sino devuelve todas las proposals.
export async function listProposals(req, res) {
  const { date } = req.query;

  if (date) {
    const dt = new Date(date);
    const activity = await prisma.activity.findUnique({
      where: { date: dt },
      include: {
        proposals: {
          include: { proposal: true },
          orderBy: { proposal: { createdAt: "asc" } }
        }
      }
    });
    const list = activity
      ? activity.proposals.map(ap => ap.proposal)
      : [];
    return res.json(list);
  }

  // sin filtro
  const all = await prisma.proposal.findMany({
    orderBy: { createdAt: "desc" }
  });
  res.json(all);
}

// GET /api/proposals/:id
export async function getProposal(req, res) {
  const id = Number(req.params.id);
  const proposal = await prisma.proposal.findUnique({ where: { id } });
  if (!proposal) return res.status(404).json({ error: "Not found" });
  res.json(proposal);
}

// POST /api/proposals
// Body: { date: "YYYY-MM-DD", content: "texto…" }
export async function createProposal(req, res) {
  const { date, content } = req.body;
  if (!date || !content) {
    return res.status(400).json({ error: "date y content requeridos" });
  }

  const dt = new Date(date);

  // 1) Asegurá la Activity
  const activity = await prisma.activity.upsert({
    where: { date: dt },
    create: { date: dt },
    update: {}
  });

  // 2) Creá la Proposal
  const proposal = await prisma.proposal.create({
    data: { content }
  });

  // 3) Asociá en la tabla pivote
  await prisma.activityProposal.create({
    data: {
      activityId: activity.id,
      proposalId:  proposal.id
    }
  });

  res.status(201).json(proposal);
}

// DELETE /api/proposals/:id
export async function deleteProposal(req, res) {
  const id = Number(req.params.id);

  // borrá asociaciones y luego la proposal
  await prisma.activityProposal.deleteMany({ where: { proposalId: id } });
  await prisma.proposal.delete({ where: { id } });

  res.status(204).end();
}