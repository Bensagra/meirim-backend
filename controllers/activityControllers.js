import { PrismaClient } from "@prisma/client";
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
  const { id } = req.params;
  const { date, temasId, user } = req.body;
  try {
    const updatedActivity = await prisma.activity.update({
      where: { id: parseInt(id) },
      data: {
       fecha: new Date(date),
       tematicas:{
        connectOrCreate: temasId.map((temaId) => ({
          where: { id: temaId },
          create: { id: temaId }
        }))
       },
       participants:{
        connect: user.map((userId) => ({
          dni: userId.toString() // Ensure dni is a string
        }))
      }
      }
    });
    res.status(200).json(updatedActivity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
