import { PrismaClient } from "@prisma/client";
import { getSupabaseBucket, getSupabaseClient } from "../lib/supabaseClient.js";

const prisma = new PrismaClient();

function sanitizeFileName(fileName) {
  const raw = String(fileName || "");
  const base = raw.split("/").pop() || "producto";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function cleanText(value, max = 500) {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t.slice(0, max);
}

/** Vidriera pública: solo productos activos, en orden. */
export const listProductos = async (req, res) => {
  const includeInactive = req.query.all === "1";
  try {
    const productos = await prisma.producto.findMany({
      where: includeInactive ? {} : { activo: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }]
    });
    res.json(productos);
  } catch (e) {
    console.error(e);
    res.status(500).send("No se pudieron cargar los productos");
  }
};

/** Signed URL de Supabase para subir la foto del producto (patrón de galerías). */
export const createUploadUrl = async (req, res) => {
  try {
    const { fileName } = req.body || {};
    if (!fileName) return res.status(400).send("Falta fileName");

    const safeName = sanitizeFileName(fileName);
    const path = `tienda/${Date.now()}_${safeName}`;

    const supabase = getSupabaseClient();
    const bucket = getSupabaseBucket();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) {
      console.error(error);
      return res.status(500).send("No se pudo generar URL de subida");
    }

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);

    res.json({
      signedUrl: data.signedUrl,
      path,
      publicUrl: publicData?.publicUrl || null
    });
  } catch (e) {
    console.error(e);
    res.status(500).send("No se pudo generar URL de subida");
  }
};

export const createProducto = async (req, res) => {
  try {
    const nombre = cleanText(req.body?.nombre, 200);
    if (!nombre) return res.status(400).send("Falta el nombre");

    const last = await prisma.producto.findFirst({
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true }
    });
    const nextOrder = (last?.displayOrder ?? -1) + 1;

    const producto = await prisma.producto.create({
      data: {
        nombre,
        descripcion: cleanText(req.body?.descripcion, 1000),
        precio: cleanText(req.body?.precio, 60),
        imageUrl: cleanText(req.body?.imageUrl, 1000),
        talles: cleanText(req.body?.talles, 120),
        activo: req.body?.activo === undefined ? true : Boolean(req.body.activo),
        displayOrder: nextOrder
      }
    });
    res.status(201).json(producto);
  } catch (e) {
    console.error(e);
    res.status(400).send("No se pudo crear el producto");
  }
};

export const updateProducto = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID inválido");

  try {
    const data = {};
    if (req.body?.nombre !== undefined) {
      const nombre = cleanText(req.body.nombre, 200);
      if (!nombre) return res.status(400).send("El nombre no puede quedar vacío");
      data.nombre = nombre;
    }
    if (req.body?.descripcion !== undefined) data.descripcion = cleanText(req.body.descripcion, 1000);
    if (req.body?.precio !== undefined) data.precio = cleanText(req.body.precio, 60);
    if (req.body?.imageUrl !== undefined) data.imageUrl = cleanText(req.body.imageUrl, 1000);
    if (req.body?.talles !== undefined) data.talles = cleanText(req.body.talles, 120);
    if (req.body?.activo !== undefined) data.activo = Boolean(req.body.activo);
    if (req.body?.displayOrder !== undefined) {
      const order = parseInt(req.body.displayOrder, 10);
      if (!Number.isNaN(order)) data.displayOrder = order;
    }

    const producto = await prisma.producto.update({ where: { id }, data });
    res.json(producto);
  } catch (e) {
    console.error(e);
    res.status(400).send("No se pudo actualizar el producto");
  }
};

export const deleteProducto = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID inválido");

  try {
    await prisma.producto.delete({ where: { id } });
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(400).send("No se pudo borrar el producto");
  }
};
