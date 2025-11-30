import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============ JUEGO ============

// Listar preguntas para el juego
export const getPreguntasJuego = async (req, res) => {
  try {
    const preguntas = await prisma.pregunta100.findMany({
      where: {
        activa: true
      },
      orderBy: { orden: 'asc' },
      include: {
        opciones: {
          orderBy: { posicion: 'asc' }
        }
      }
    });

    res.json(preguntas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener preguntas' });
  }
};

// Verificar el orden de las opciones
export const verificarOrden = async (req, res) => {
  try {
    const { preguntaId, ordenUsuario } = req.body;
    // ordenUsuario es un array de IDs de opciones en el orden que el usuario propuso

    if (!preguntaId || !Array.isArray(ordenUsuario)) {
      return res.status(400).json({ error: 'Faltan datos o formato incorrecto' });
    }

    // Obtener la pregunta con sus opciones
    const pregunta = await prisma.pregunta100.findUnique({
      where: { id: parseInt(preguntaId) },
      include: {
        opciones: {
          orderBy: { posicion: 'asc' }
        }
      }
    });

    if (!pregunta) {
      return res.status(404).json({ error: 'Pregunta no encontrada' });
    }

    // Crear mapa de ID -> posición correcta
    const posicionesCorrectas = {};
    pregunta.opciones.forEach(opcion => {
      posicionesCorrectas[opcion.id] = opcion.posicion;
    });

    // Verificar cada opción
    const resultados = ordenUsuario.map((opcionId, index) => {
      const posicionUsuario = index + 1; // Posición que le dio el usuario (1-indexed)
      const posicionCorrecta = posicionesCorrectas[opcionId];
      const correcto = posicionUsuario === posicionCorrecta;

      return {
        opcionId: opcionId,
        posicionUsuario,
        posicionCorrecta,
        correcto
      };
    });

    // Calcular puntaje
    const correctas = resultados.filter(r => r.correcto).length;
    const total = resultados.length;
    const porcentaje = total > 0 ? Math.round((correctas / total) * 100) : 0;

    res.json({
      correctas,
      total,
      porcentaje,
      resultados,
      opciones: pregunta.opciones // Devolver las opciones completas
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al verificar orden' });
  }
};

// ============ ADMIN ============

// Listar todas las preguntas (admin)
export const getAllPreguntas = async (req, res) => {
  try {
    const preguntas = await prisma.pregunta100.findMany({
      orderBy: { orden: 'asc' },
      include: {
        opciones: {
          orderBy: { posicion: 'asc' }
        }
      }
    });

    res.json(preguntas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener preguntas' });
  }
};

// Crear pregunta con opciones (admin)
export const crearPregunta = async (req, res) => {
  try {
    const { pregunta, orden, activa, opciones } = req.body;

    if (!pregunta || !opciones || !Array.isArray(opciones)) {
      return res.status(400).json({ error: 'La pregunta y opciones son requeridas' });
    }

    const nueva = await prisma.pregunta100.create({
      data: {
        pregunta,
        orden: orden || 0,
        activa: activa !== undefined ? activa : true,
        opciones: {
          create: opciones.map(op => ({
            texto: op.texto,
            posicion: op.posicion,
            cantidad: op.cantidad
          }))
        }
      },
      include: {
        opciones: true
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
    const { pregunta, orden, activa } = req.body;

    const actualizada = await prisma.pregunta100.update({
      where: { id: parseInt(id) },
      data: {
        ...(pregunta !== undefined && { pregunta }),
        ...(orden !== undefined && { orden }),
        ...(activa !== undefined && { activa })
      },
      include: {
        opciones: true
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

// Estadísticas generales (admin)
export const getEstadisticas = async (req, res) => {
  try {
    const totalPreguntas = await prisma.pregunta100.count();
    const preguntasActivas = await prisma.pregunta100.count({
      where: { activa: true }
    });

    res.json({
      totalPreguntas,
      preguntasActivas
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};

// Inicializar datos con las preguntas del campamento
export const inicializarDatos = async (req, res) => {
  try {
    const preguntasData = [
      {
        pregunta: "Juego favorito",
        orden: 1,
        opciones: [
          { texto: "Juegos con pelota violentos", posicion: 1, cantidad: 40 },
          { texto: "Gallito ciego", posicion: 2, cantidad: 30 },
          { texto: "Dos perros por un hueso", posicion: 3, cantidad: 20 },
          { texto: "I love London", posicion: 4, cantidad: 10 }
        ]
      },
      {
        pregunta: "Momento más esperado del CM",
        orden: 2,
        opciones: [
          { texto: "Mesaza", posicion: 1, cantidad: 50 },
          { texto: "Los juegos", posicion: 2, cantidad: 35 },
          { texto: "Judinews", posicion: 3, cantidad: 15 }
        ]
      },
      {
        pregunta: "Mesaza favorita",
        orden: 3,
        opciones: [
          { texto: "Cookies", posicion: 1, cantidad: 30 },
          { texto: "Tiramisú", posicion: 2, cantidad: 25 },
          { texto: "Brigadeiros", posicion: 3, cantidad: 20 },
          { texto: "Masitas", posicion: 4, cantidad: 15 },
          { texto: "Conitos de dulce de leche", posicion: 5, cantidad: 10 }
        ]
      },
      {
        pregunta: "Mejor CM",
        orden: 4,
        opciones: [
          { texto: "Kickoff sushi", posicion: 1, cantidad: 35 },
          { texto: "Payasos e infancia", posicion: 2, cantidad: 30 },
          { texto: "Parents info night", posicion: 3, cantidad: 20 },
          { texto: "Centro de entrenamiento", posicion: 4, cantidad: 15 }
        ]
      },
      {
        pregunta: "Puesto del board favorito",
        orden: 5,
        opciones: [
          { texto: "Mazkirim", posicion: 1, cantidad: 35 },
          { texto: "Godol & N'siah", posicion: 2, cantidad: 30 },
          { texto: "Sganim", posicion: 3, cantidad: 20 },
          { texto: "Morim", posicion: 4, cantidad: 15 }
        ]
      },
      {
        pregunta: "Evento regional favorito",
        orden: 6,
        opciones: [
          { texto: "Israel Experience", posicion: 1, cantidad: 45 },
          { texto: "LTD", posicion: 2, cantidad: 35 },
          { texto: "BBYO Wrapped", posicion: 3, cantidad: 20 }
        ]
      },
      {
        pregunta: "Lo que más les gusta de BBYO",
        orden: 7,
        opciones: [
          { texto: "Los Amigos", posicion: 1, cantidad: 40 },
          { texto: "Los chapter meetings", posicion: 2, cantidad: 30 },
          { texto: "El camp", posicion: 3, cantidad: 20 },
          { texto: "IC", posicion: 4, cantidad: 10 }
        ]
      }
    ];

    for (const preguntaData of preguntasData) {
      await prisma.pregunta100.create({
        data: {
          pregunta: preguntaData.pregunta,
          orden: preguntaData.orden,
          activa: true,
          opciones: {
            create: preguntaData.opciones
          }
        }
      });
    }

    res.json({ 
      success: true, 
      message: 'Datos inicializados correctamente', 
      preguntasCreadas: preguntasData.length 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al inicializar datos' });
  }
};
