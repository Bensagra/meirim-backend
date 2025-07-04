import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const listTematicas = async (req, res) => {
  try {
    const tematicas = await prisma.tematica.findMany({
      where: {
        usada: false,
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(tematicas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export const createTematica = async (req, res) => {
  try {
    const newTematica = await prisma.tematica.create({
      data: { tematica: req.body.tematica,}
    });
    res.status(201).json(newTematica);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
