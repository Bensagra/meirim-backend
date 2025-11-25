import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Normalizar texto para comparación
function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
    .replace(/[^\w\s]/g, "") // Quitar puntuación
    .trim();
}

// ============ VOTACIÓN (Usuarios) ============

// Obtener preguntas activas para votar
export const getPreguntasParaVotar = async (req, res) => {
  try {
    const preguntas = await prisma.pregunta100.findMany({
      where: {
        activa: true,
        bloqueada: false
      },
      orderBy: { orden: 'asc' },
      select: {
        id: true,
        pregunta: true,
        orden: true
      }
    });
    res.json(preguntas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener preguntas' });
  }
};

// Responder una pregunta
export const responderPregunta = async (req, res) => {
  try {
    const { preguntaId, respuesta, votante } = req.body;

    if (!preguntaId || !respuesta || !votante) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    // Verificar que la pregunta esté activa y no bloqueada
    const pregunta = await prisma.pregunta100.findUnique({
      where: { id: parseInt(preguntaId) }
    });

    if (!pregunta || !pregunta.activa || pregunta.bloqueada) {
      return res.status(400).json({ error: 'Esta pregunta no está disponible para responder' });
    }

    const respuestaNormalizada = normalizarTexto(respuesta);

    // Crear o actualizar respuesta
    const respuestaDb = await prisma.respuesta100.upsert({
      where: {
        preguntaId_votante: {
          preguntaId: parseInt(preguntaId),
          votante: votante
        }
      },
      update: {
        respuesta: respuestaNormalizada
      },
      create: {
        preguntaId: parseInt(preguntaId),
        respuesta: respuestaNormalizada,
        votante: votante
      }
    });

    res.json({ success: true, respuesta: respuestaDb });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al guardar respuesta' });
  }
};

// Obtener respuestas del votante
export const getMisRespuestas = async (req, res) => {
  try {
    const { votante } = req.params;

    const respuestas = await prisma.respuesta100.findMany({
      where: { votante },
      include: {
        pregunta: {
          select: {
            id: true,
            pregunta: true,
            orden: true
          }
        }
      },
      orderBy: {
        pregunta: {
          orden: 'asc'
        }
      }
    });

    res.json(respuestas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener respuestas' });
  }
};

// ============ JUEGO ============

// Obtener pregunta con resultados calculados
export const getPreguntaConResultados = async (req, res) => {
  try {
    const { id } = req.params;

    const pregunta = await prisma.pregunta100.findUnique({
      where: { id: parseInt(id) },
      include: {
        respuestas: true
      }
    });

    if (!pregunta) {
      return res.status(404).json({ error: 'Pregunta no encontrada' });
    }

    // Agrupar y contar respuestas
    const conteo = {};
    pregunta.respuestas.forEach(r => {
      const resp = r.respuesta;
      conteo[resp] = (conteo[resp] || 0) + 1;
    });

    // Calcular porcentajes
    const totalRespuestas = pregunta.respuestas.length;
    const resultados = Object.entries(conteo)
      .map(([respuesta, cantidad]) => ({
        respuesta,
        cantidad,
        porcentaje: totalRespuestas > 0 
          ? Math.round((cantidad / totalRespuestas) * 100) 
          : 0
      }))
      .sort((a, b) => b.cantidad - a.cantidad);

    res.json({
      id: pregunta.id,
      pregunta: pregunta.pregunta,
      totalRespuestas,
      resultados
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener resultados' });
  }
};

// Verificar respuesta del jugador
export const verificarRespuesta = async (req, res) => {
  try {
    const { preguntaId, respuesta } = req.body;

    if (!preguntaId || !respuesta) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const respuestaNormalizada = normalizarTexto(respuesta);

    // Buscar si existe esta respuesta
    const encontrada = await prisma.respuesta100.findFirst({
      where: {
        preguntaId: parseInt(preguntaId),
        respuesta: respuestaNormalizada
      }
    });

    if (encontrada) {
      // Contar cuántas veces fue respondida
      const cantidad = await prisma.respuesta100.count({
        where: {
          preguntaId: parseInt(preguntaId),
          respuesta: respuestaNormalizada
        }
      });

      // Calcular porcentaje
      const total = await prisma.respuesta100.count({
        where: { preguntaId: parseInt(preguntaId) }
      });

      const porcentaje = total > 0 ? Math.round((cantidad / total) * 100) : 0;

      res.json({
        correcta: true,
        respuesta: respuestaNormalizada,
        cantidad,
        porcentaje
      });
    } else {
      res.json({
        correcta: false,
        respuesta: respuestaNormalizada
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al verificar respuesta' });
  }
};

// Listar preguntas para el juego
export const getPreguntasJuego = async (req, res) => {
  try {
    const preguntas = await prisma.pregunta100.findMany({
      where: {
        activa: true
        // Removido el filtro de bloqueada para permitir jugar con cualquier pregunta activa
      },
      orderBy: { orden: 'asc' },
      include: {
        _count: {
          select: { respuestas: true }
        }
      }
    });

    // Filtrar solo las que tienen al menos 1 respuesta
    const preguntasConRespuestas = preguntas.filter(p => p._count.respuestas > 0);

    res.json(preguntasConRespuestas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener preguntas' });
  }
};

// ============ ADMIN ============

// Listar todas las preguntas (admin)
export const getAllPreguntas = async (req, res) => {
  try {
    const preguntas = await prisma.pregunta100.findMany({
      orderBy: { orden: 'asc' },
      include: {
        _count: {
          select: { respuestas: true }
        }
      }
    });

    res.json(preguntas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener preguntas' });
  }
};

// Crear pregunta (admin)
export const crearPregunta = async (req, res) => {
  try {
    const { pregunta, orden, activa } = req.body;

    if (!pregunta) {
      return res.status(400).json({ error: 'La pregunta es requerida' });
    }

    const nueva = await prisma.pregunta100.create({
      data: {
        pregunta,
        orden: orden || 0,
        activa: activa !== undefined ? activa : true,
        bloqueada: false
      }
    });

    res.json(nueva);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear pregunta' });
  }
};

// Actualizar pregunta (admin)
export const actualizarPregunta = async (req, res) => {
  try {
    const { id } = req.params;
    const { pregunta, orden, activa, bloqueada } = req.body;

    const actualizada = await prisma.pregunta100.update({
      where: { id: parseInt(id) },
      data: {
        ...(pregunta !== undefined && { pregunta }),
        ...(orden !== undefined && { orden }),
        ...(activa !== undefined && { activa }),
        ...(bloqueada !== undefined && { bloqueada })
      }
    });

    res.json(actualizada);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar pregunta' });
  }
};

// Eliminar pregunta (admin)
export const eliminarPregunta = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.pregunta100.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true, message: 'Pregunta eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar pregunta' });
  }
};

// Ver todas las respuestas de una pregunta (admin)
export const getRespuestasPregunta = async (req, res) => {
  try {
    const { id } = req.params;

    const respuestas = await prisma.respuesta100.findMany({
      where: { preguntaId: parseInt(id) },
      orderBy: { createdAt: 'desc' }
    });

    // Agrupar y contar
    const conteo = {};
    respuestas.forEach(r => {
      const resp = r.respuesta;
      conteo[resp] = (conteo[resp] || 0) + 1;
    });

    const agrupadas = Object.entries(conteo)
      .map(([respuesta, cantidad]) => ({
        respuesta,
        cantidad,
        porcentaje: respuestas.length > 0 
          ? Math.round((cantidad / respuestas.length) * 100) 
          : 0
      }))
      .sort((a, b) => b.cantidad - a.cantidad);

    res.json({
      total: respuestas.length,
      respuestasAgrupadas: agrupadas,
      respuestasIndividuales: respuestas
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener respuestas' });
  }
};

// Estadísticas generales (admin)
export const getEstadisticas = async (req, res) => {
  try {
    const totalPreguntas = await prisma.pregunta100.count();
    const preguntasActivas = await prisma.pregunta100.count({
      where: { activa: true }
    });
    const preguntasBloqueadas = await prisma.pregunta100.count({
      where: { bloqueada: true }
    });
    const totalRespuestas = await prisma.respuesta100.count();

    // Obtener votantes únicos
    const respuestas = await prisma.respuesta100.findMany({
      select: { votante: true },
      distinct: ['votante']
    });

    res.json({
      totalPreguntas,
      preguntasActivas,
      preguntasBloqueadas,
      totalRespuestas,
      votantesUnicos: respuestas.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};
