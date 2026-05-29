import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

 export const createUser = async (req,res) => {
    const {name,surname,email,dni} = req.body;
    await prisma.user.create({
        data: {
            name,
            surname,
            email,
            dni: dni.toString() // Convert dni to string if it's not already
        }
    }).then((user) => {
        res.status(201).json(user);
    }).catch((error) => {
        res.status(500).json({error: error.message});
    });
};
export const getUser = async (req,res) => {
    const {dni} = req.params;
    await prisma.user.findUnique({
        where: {
            dni: dni.toString()
        }
    }).then((user) => {
        if (user) {
            res.status(200).json(user);
        } else {
            res.status(404).json({message: "User not found"});
        }
    }).catch((error) => {
        res.status(500).json({error: error.message});
    });
}

export const listUsers = async (req, res) => {
    const query = (req.query.q || '').toString().trim();
    try {
        const users = await prisma.user.findMany({
            where: query ? {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { surname: { contains: query, mode: 'insensitive' } },
                    { dni: { contains: query } }
                ]
            } : undefined,
            orderBy: [{ name: 'asc' }, { surname: 'asc' }],
            select: { id: true, name: true, surname: true, dni: true, photoUrl: true }
        });
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export const updateUserPhoto = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { photoUrl, force } = req.body || {};
    if (Number.isNaN(id)) return res.status(400).send('ID invalido');
    if (!photoUrl) return res.status(400).send('Falta photoUrl');

    try {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return res.status(404).send('Usuario no encontrado');
        if (user.photoUrl && !force) {
            return res.status(409).send('El usuario ya tiene foto');
        }

        const updated = await prisma.user.update({
            where: { id },
            data: { photoUrl: photoUrl.toString() }
        });
        res.status(200).json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
