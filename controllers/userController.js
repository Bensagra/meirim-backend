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
