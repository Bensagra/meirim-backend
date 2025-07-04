import { PrismaClient, Status } from "@prisma/client";
const prisma = new PrismaClient();

// GET /activities-status
export async function listStatus(req, res) {
  const { year, month } = req.query;
  const where = {};
  if (year && month) {
    const y = +year, m = +month - 1;
    where.date = {
      gte: new Date(Date.UTC(y, m,   1)),
      lt:  new Date(Date.UTC(y, m+1, 1))
    };
  }
  const acts = await prisma.activity.findMany({ where, orderBy: { date: "asc" } });
  res.json(acts.map(a => ({
    date: a.date.toISOString().split("T")[0],
    status: a.status === Status.NO_ACTIVITY ? 0
         : a.status === Status.LACKING     ? 1
         : 2
  })));
}

// GET /activities-status/:date
export async function getStatus(req, res) {
  const dt = new Date(req.params.date);
  const act = await prisma.activity.findUnique({ where: { date: dt } });
  if (!act) return res.status(404).json({ error: "Not found" });
  const code = act.status === Status.NO_ACTIVITY ? 0
             : act.status === Status.LACKING     ? 1
             : 2;
  res.json({ date: req.params.date, status: code });
}

// POST /activities-status
export async function upsertStatus(req, res) {
  const { date, status } = req.body;
  if (!date || status == null) {
    return res.status(400).json({ error: "date y status obligatorios" });
  }
  const dt = new Date(date);
  const value = [Status.NO_ACTIVITY, Status.LACKING, Status.FULL][status];
  const act = await prisma.activity.upsert({
    where: { date: dt },
    create: { date: dt, status: value },
    update: { status: value }
  });
  res.json(act);
}

// DELETE /activities-status/:date
export async function deleteStatus(req, res) {
  const dt = new Date(req.params.date);
  await prisma.activity.delete({ where: { date: dt } });
  res.status(204).end();
}