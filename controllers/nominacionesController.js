import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Obtener todas las categorías
export const getCategorias = async (req, res) => {
  try {
    const categorias = await prisma.categoriaNominacion.findMany({
      where: { activa: true },
      orderBy: { orden: 'asc' },
      include: {
        nominaciones: {
          include: {
            campista: true
          }
        }
      }
    });
    res.json(categorias);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};

// Obtener todos los campistas
export const getCampistas = async (req, res) => {
  try {
    const campistas = await prisma.campista.findMany({
      orderBy: { nombre: 'asc' }
    });
    res.json(campistas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener campistas' });
  }
};

// Votar en una categoría
export const votar = async (req, res) => {
  try {
    const { categoriaId, campistaId, votante } = req.body;

    if (!categoriaId || !campistaId || !votante) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    // Verificar si ya votó en esta categoría
    const votoExistente = await prisma.nominacion.findUnique({
      where: {
        categoriaId_votante: {
          categoriaId: parseInt(categoriaId),
          votante: votante
        }
      }
    });

    if (votoExistente) {
      // Actualizar el voto
      const voto = await prisma.nominacion.update({
        where: {
          categoriaId_votante: {
            categoriaId: parseInt(categoriaId),
            votante: votante
          }
        },
        data: {
          campistaId: parseInt(campistaId)
        },
        include: {
          categoria: true,
          campista: true
        }
      });
      return res.json({ voto, actualizado: true });
    } else {
      // Crear nuevo voto
      const voto = await prisma.nominacion.create({
        data: {
          categoriaId: parseInt(categoriaId),
          campistaId: parseInt(campistaId),
          votante: votante
        },
        include: {
          categoria: true,
          campista: true
        }
      });
      return res.json({ voto, actualizado: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar voto' });
  }
};

// Obtener votos de un usuario
export const getVotosUsuario = async (req, res) => {
  try {
    const { votante } = req.params;
    
    const votos = await prisma.nominacion.findMany({
      where: { votante },
      include: {
        categoria: true,
        campista: true
      }
    });
    
    res.json(votos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener votos' });
  }
};

// Obtener resultados de votación (solo para admin)
export const getResultados = async (req, res) => {
  try {
    const categorias = await prisma.categoriaNominacion.findMany({
      where: { activa: true },
      include: {
        nominaciones: {
          include: {
            campista: true
          }
        }
      },
      orderBy: { orden: 'asc' }
    });

    const resultados = categorias.map(categoria => {
      const conteo = {};
      categoria.nominaciones.forEach(nominacion => {
        const nombre = nominacion.campista.nombre;
        conteo[nombre] = (conteo[nombre] || 0) + 1;
      });

      const ordenado = Object.entries(conteo)
        .map(([nombre, votos]) => ({ nombre, votos }))
        .sort((a, b) => b.votos - a.votos);

      return {
        categoria: categoria.nombre,
        totalVotos: categoria.nominaciones.length,
        resultados: ordenado
      };
    });

    res.json(resultados);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener resultados' });
  }
};

// Inicializar datos (solo ejecutar una vez)
export const inicializarDatos = async (req, res) => {
  try {
    // Crear categorías
    const categorias = [
      { nombre: 'Más Gracioso/a', descripcion: 'El que siempre te hace reír', orden: 1 },
      { nombre: 'Más Pilas', descripcion: 'El que tiene energía para todo', orden: 2 },
      { nombre: 'Más Deportista', descripcion: 'El crack en cualquier deporte', orden: 3 },
      { nombre: 'Más Carismático/a', descripcion: 'El que cae bien a todo el mundo', orden: 4 },
      { nombre: 'Más Creativo/a', descripcion: 'El que siempre tiene ideas originales', orden: 5 },
      { nombre: 'Mejor Compañero/a', descripcion: 'El que siempre está ahí para ayudar', orden: 6 },
      { nombre: 'Más Aventurero/a', descripcion: 'El que no le tiene miedo a nada', orden: 7 },
      { nombre: 'Alma de la Fiesta', descripcion: 'Donde está él/ella, hay diversión', orden: 8 }
    ];

    for (const cat of categorias) {
      await prisma.categoriaNominacion.upsert({
        where: { nombre: cat.nombre },
        update: {},
        create: cat
      });
    }

    // Crear campistas
    const campistas = ['Mati', 'Benyi', 'Mica', 'Caro', 'Eyal', 'Juan', 'Luz', 'Rafa', 'Tomy', 'Wolko', 'Dani'];
    
    for (const nombre of campistas) {
      await prisma.campista.upsert({
        where: { nombre },
        update: {},
        create: { nombre }
      });
    }

    res.json({ message: 'Datos inicializados correctamente', categorias: categorias.length, campistas: campistas.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al inicializar datos' });
  }
};
