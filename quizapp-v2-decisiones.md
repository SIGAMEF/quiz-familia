# QuizApp v2 — Decisiones y estado (2026-10-09)

## Decisiones
- Roles: admin (supervisa, restringe/elimina, ve todo), profesor (se registra solo con institución obligatoria; nombre, curso, avatar opcionales), alumno (se registra por enlace/QR del grupo).
- Un alumno puede estar en grupos de varios profesores, pero solo en un grupo por profesor. El cambio de grupo lo habilita el profesor por grupo.
- Quizzes del profesor independientes de los grupos; se publican a uno o varios grupos (modo práctica/examen/estudio, fechas, intentos, periodo, peso).
- Tipos de pregunta: verdadero_falso, opcion_unica, opcion_multiple, completar (varios espacios, alternativas con |), lluvia_ideas (pizarra, no se califica).
- Libreta de notas: escala configurable por grupo (vigesimal 0–20, literal AD/A/B/C o ambas). Literal: AD ≥18, A 14–17, B 11–13, C ≤10. Descarga en Excel con formato.
- Bimestres se conservan como "periodos" globales administrados por el admin.
- En vivo: PIN de 6 dígitos, enlace o QR; alumnos con su cuenta, invitados con nombre y avatar; bonus por rapidez (cada punto del quiz = 1000 en vivo); pizarra de lluvia de ideas; reloj sincronizado con el servidor.
- Migración: solo quizzes (con preguntas) y la cuenta admin. Quizzes migrados quedan a nombre del admin; se copian/transfieren a profesores. Se importaron los bancos de quiz.html y lucas.html (322 preguntas, 6 quizzes).

## Estado
- Ejecutados en Supabase: 00_respaldo, 01_limpiar, 02_esquema (versión inicial). Pendiente confirmar 03, 04 y el 05 más reciente.
- Frontend entregado completo: index, profesor, alumno, vivo, admin (+ css/, js/). Probado con Chromium contra un simulador local de Supabase (pruebas E2E de profesor, alumno, en vivo y admin, más pruebas SQL de permisos).
- Plantilla Excel: columnas tema, subtema, tipo, enunciado, imagen_url, puntos, opcion_1..6, correctas, respuestas_completar, explicacion.
