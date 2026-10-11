# QuizApp v2 — Cómo subir esta versión

## 1. Base de datos (Supabase → SQL Editor)
Ejecuta **`05_parche_paneles.sql`** (incluido en este zip). Si ya ejecutaste una versión anterior del 05, ejecútalo otra vez: se puede repetir sin problema.

## 2. Archivos (repositorio de GitHub)
- **Reemplaza**: `index.html`, `admin.html`
- **Agrega**: `profesor.html`, `alumno.html`, `vivo.html`, `jugar.html` y las carpetas `css/` y `js/` completas
- **Borra** (ya no se usan): `concurso.html`, `quiz.html`, `lucas.html`
- **Conserva** `musica-fondo.mp3` si lo tienes (la música de fondo del alumno)
- No subas `Quiz en linea.txt` (tiene la clave del admin)

## 3. Páginas
| Página | Para quién |
|---|---|
| `index.html` | Login de todos, registro de profesores y de alumnos (con el enlace o código del grupo) |
| `profesor.html` | Quizzes, carga masiva, grupos con QR, publicar, en vivo, libreta |
| `alumno.html` | Quizzes asignados, práctica / examen / estudio, historial, mis grupos |
| `jugar.html` | Enlace / QR de una publicación: el alumno del grupo entra con su cuenta; si el profesor lo permite, cualquiera lo resuelve como invitado |
| `vivo.html` | Quiz en vivo: participantes con PIN, enlace o QR (con cuenta o como invitado) y control del profesor |
| `admin.html` | Resumen, profesores, instituciones, alumnos, todos los quizzes, periodos |

## 4. Primeros pasos
1. Entra como **admin** (mismo usuario y clave de siempre). En **Quizzes** verás los migrados a tu nombre: cópialos o transfiérelos a cada profesor cuando se registren.
2. Cada **profesor** se registra en `index.html` → "Soy profesor" (institución obligatoria).
3. El profesor crea quizzes (a mano o con la plantilla Excel), crea un grupo y comparte el **enlace o QR** del grupo.
4. Los **alumnos** se registran con ese enlace y quedan en el grupo.
5. El profesor **publica** el quiz en el grupo y revisa la **libreta** (descargable en Excel).
