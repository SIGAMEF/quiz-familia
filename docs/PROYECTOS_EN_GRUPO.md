# Especificación: "Proyectos en grupo" (pizarra de dinámicas en vivo)

> Documento para implementar con Claude Code en el repo SIGAMEF/quiz-familia.
> Seguir los patrones existentes: SQL en un archivo nuevo re-ejecutable, RPCs `security definer`,
> permisos en `06_permisos.sql`, módulos ES en `js/`, sondeo cada 1,5 s como en las salas de juego.

---

## 1. Qué es

Una herramienta tipo **Canva + Mentimeter** dentro del panel del **profesor** (y también del admin).

- El profesor arma un **proyecto**, que es una presentación hecha de **hojas**, como diapositivas.
- Cada hoja puede ser de contenido (texto, imágenes, video) o **interactiva**: preguntas, lluvia de ideas, **Agrupar** o **Ruleta**.
- Al presentarlo en vivo, los participantes entran con **QR/PIN** desde el celular o la web.
- El profesor controla qué hoja ven todos.
- **Todo queda guardado en Supabase.** Si se corta, se puede **continuar** donde se quedó o **reiniciar** desde cero.

---

## 2. Dónde aparece

- En el menú izquierdo del panel del profesor hay una sección nueva: **"Proyectos en grupo"**.
- La sección lista los proyectos del profesor con estas acciones:
  - **Abrir**, **Duplicar**, **Eliminar**.
  - **Presentar**.
  - Si tiene una sesión sin terminar: **Continuar sesión** y **Reiniciar**.
- El botón **"+ Crear proyecto"** pide un **nombre**; al pulsar **Crear** se abre el **editor**.
- El admin ve la misma sección en su panel, con sus propios proyectos.

---

## 3. El editor (pantalla completa)

```
┌──────────────┬──────────────────────────────────────────┬───────────┐
│ PANEL IZQ.   │            LIENZO (vista previa)         │ PROPIEDA- │
│              │   [ 🖥 Web | 📱 Celular ]   [▶ Presentar]│ DES del   │
│ + Agregar    │   ┌──────────────────────────────┐       │ elemento  │
│   hoja:      │   │                              │       │ elegido   │
│ • Contenido  │   │    la hoja tal como se verá  │       │ (color,   │
│ • Pregunta   │   │                              │       │ tamaño,   │
│ • V / F      │   └──────────────────────────────┘       │ fuente…)  │
│ • Opción mú. │                                          │           │
│ • Completar  │  ── tira de hojas (miniaturas) ──        │           │
│ • Lluvia     │  [1][2][3][+]   arrastrar = reordenar    │           │
│ • Agrupar    │                                          │           │
│ • Ruleta     │                                          │           │
│ ──────────── │                                          │           │
│ Recursos:    │                                          │           │
│ Texto, Fondo,│                                          │           │
│ Imagen,      │                                          │           │
│ Iconos,      │                                          │           │
│ Emojis,      │                                          │           │
│ Formas,      │                                          │           │
│ Video,       │                                          │           │
│ Plantillas   │                                          │           │
└──────────────┴──────────────────────────────────────────┴───────────┘
```

**Funcionamiento**

- Al elegir un tipo de hoja, esta se crea **al final del proyecto** con un diseño inicial y se muestra en el lienzo. La primera hoja se crea sola.
- Hay dos vistas del lienzo:
  - **Web**: proyector 16:9, lo que ve la pantalla del profesor.
  - **Celular**: lo que verá el participante en su teléfono para esa hoja.
- Las hojas tienen menú contextual: **duplicar**, **eliminar** y **reordenar** (arrastrando las miniaturas).
- El guardado es **automático** (debounce de ~1 s) y se muestra el indicador "Guardado ✓".
- Deshacer/rehacer con Ctrl+Z / Ctrl+Y (historial en memoria).
- En celular el editor se reorganiza: los paneles se vuelven pestañas abajo. El diseño es más cómodo en PC.

### 3.1 Recursos de diseño (todos gratis, sin API keys)

| Recurso | Cómo |
|---|---|
| **Fondos** | Color sólido, degradados predefinidos (~20), patrones SVG/CSS (puntos, ondas, confeti, pizarra, cuaderno, espacio…), imagen propia. |
| **Imágenes** | Subir desde el equipo, **pegar con Ctrl+V** o arrastrar y soltar. Se comprimen en el navegador (máx. 1600 px, WebP/JPEG) y se suben al bucket de Storage existente, en una carpeta `proyectos/`. |
| **Iconos** | Librería libre (Lucide o Tabler Icons, licencia MIT, por CDN o copiados al repo), con buscador y color configurable. |
| **Emojis** | Selector de emojis nativo (reutilizar `selectorEmoji` de `js/juegos/util.js`). |
| **Formas** | Rectángulo, círculo, estrella, flecha, globo de diálogo. |
| **Texto** | Título, subtítulo, párrafo. Fuentes de Google Fonts (~8 legibles e infantiles: Fredoka, Baloo 2, Nunito, Poppins…), tamaño, color, alineación, negrita. |
| **Video** | Enlace de **YouTube/Vimeo** (iframe, opción recomendada) o archivo mp4 pequeño (límite ~20 MB por el plan gratis). |
| **Plantillas** | 6–10 diseños listos: portada, pregunta colorida, bienvenida, cierre/gracias, equipos… Al elegir una se aplican fondo, colores y fuentes a la hoja. |

**Elementos en el lienzo**

- Cada elemento se puede **arrastrar, redimensionar, rotar**, poner adelante o atrás, duplicar y eliminar.
- Las posiciones se guardan en **porcentajes** relativos al lienzo, para que la hoja escale bien en cualquier pantalla.

---

## 4. Tipos de hoja

Cada hoja = **diseño visual** (fondo + elementos libres) + **configuración del tipo**.

| Tipo | Configuración | En vivo, el participante… | En vivo, la pantalla muestra… |
|---|---|---|---|
| **Contenido** | Solo diseño (texto, imágenes, video). | Ve un "Mira la pantalla 👀" o la misma hoja. | La hoja. |
| **Pregunta abierta** | Enunciado, límite de caracteres. | Escribe una respuesta. | Las respuestas aparecen como tarjetas. |
| **V / F** | Enunciado, respuesta correcta (opcional). | Pulsa V o F. | Barras con el conteo y luego "Revelar respuesta". |
| **Opción múltiple** | Enunciado, 2–6 opciones, correcta(s) opcional. | Elige una opción. | Gráfico de barras en vivo y luego revelar. |
| **Completar** | Frase con hueco(s) `___` y respuestas aceptadas. | Escribe la palabra. | % de aciertos y respuestas más comunes. |
| **Lluvia de ideas** | Pregunta, máx. ideas por persona. | Envía ideas cortas. | Burbujas o nube de palabras que crecen en vivo. |
| **Agrupar** | Ver §6. | Se registra. | Participantes apareciendo y luego los grupos. |
| **Ruleta** | Ver §7. | Ve la ruleta girar (opcional). | Ruleta animada. |

- Las preguntas pueden configurarse **por participante** o **por grupo** (una respuesta por grupo, si ya existe una hoja Agrupar antes).
- El profesor puede **cerrar las respuestas** y **revelar** la respuesta correcta.

---

## 5. Presentación y sesión en vivo

### 5.1 Modo presentación (simulado, sin participantes reales)

- El botón **▶ Presentar** abre la presentación a pantalla completa. Se avanza con las flechas, clic o swipe.
- El botón **"Simular participantes"** genera 10–30 participantes falsos con respuestas aleatorias. Sirve para ver cómo quedarán la lluvia de ideas, los gráficos, el agrupamiento y la ruleta **sin guardar nada** en la base de datos.

### 5.2 Presentar en vivo

1. El botón **"Iniciar en vivo"** crea una **sesión** con un **PIN de 6 dígitos**, un **QR** y un enlace `proyecto.html?pin=123456`.
   - El PIN no debe chocar con los PIN de salas de juego ni del modo vivo; reutilizar `_nuevo_pin`.
2. **Barra de control del profesor:**
   - ◀ ▶ para cambiar de hoja; todos los participantes cambian a la misma hoja.
   - Contador de conectados.
   - Botones para mostrar u ocultar el QR, abrir/cerrar respuestas, revelar respuesta.
   - Pausar y Finalizar.
3. **Los participantes** sondean `proyecto_estado(pin)` cada 1,5 s, igual que las salas de juego, y ven solo lo que corresponde a la hoja actual.
4. **Persistencia y reanudación:** en la base se guardan la hoja actual, los participantes, las respuestas, los grupos y los sorteos.
   - Si el profesor cierra la pestaña o se cae internet, al volver a abrir el proyecto aparece: **"Tienes una sesión en curso (hoja 4 de 9, 23 participantes). [Continuar] [Reiniciar]"**.
   - Los participantes que recargan la página vuelven a entrar automáticamente con un token guardado en localStorage, como los invitados de las publicaciones.
5. **Reiniciar** borra participantes, respuestas, grupos y sorteos de esa sesión y genera un PIN nuevo. Pide confirmación. **El diseño del proyecto no se toca.**
6. **Finalizar** cierra la sesión: el PIN deja de funcionar. Los resultados quedan visibles en "Resultados" del proyecto hasta que el profesor los borre.

---

## 6. Hoja "Agrupar" (registro + formar grupos)

### Paso A: Registro

- La pantalla muestra: título, **QR grande + PIN** y la lista o burbujas de participantes que **aparecen en vivo con animación** al unirse (estilo lluvia de ideas, con avatar o foto).
- **Formulario del participante** (celular o web):
  - **Título** del proyecto o de la hoja, arriba.
  - **Nombre**, obligatorio.
  - **Alias**, opcional; es el que se muestra en pantalla. Si está vacío se usa el nombre.
  - **Avatar** (emojis/animales predefinidos) **o subir foto**.
    - La foto se comprime en el navegador a 256 px.
    - Se sube mediante una RPC o carpeta controlada.
    - Los invitados sin cuenta no deben poder escribir en cualquier ruta del bucket.
  - Botón **Unirse**.
- No se permiten nombres o alias duplicados en la misma sesión; se muestra un mensaje.
- El profesor puede **expulsar** a un participante (con una ✕ sobre su burbuja).
- El profesor pulsa **"Cerrar registro"**. Desde ese momento ya no se aceptan nuevos participantes (o se configura "permitir tardíos").

### Paso B: Formar grupos

- La pantalla del profesor muestra: **"Registrados: 27. ¿Cuántos grupos?"**
  - Un número de grupos, o la alternativa **"personas por grupo"**.
  - Una vista previa: "Quedarán 3 grupos de 7 y 2 grupos de 6".
- La distribución es **aleatoria y equilibrada**:
  - Se barajan los participantes y se reparten por turnos, para que los tamaños difieran como máximo en 1.
  - El algoritmo corre en el **servidor** (RPC), así el resultado es único y queda guardado.
- **Nombres de grupo, opcional:** el profesor puede escribir un nombre por grupo; si no lo hace, quedan como **Grupo 1, Grupo 2…**
  - Opción de color y emoji por grupo.
- El botón **"Volver a mezclar"** rehace el sorteo y pide confirmación.
- El botón **"Confirmar grupos"** guarda los grupos y pasa a la **hoja siguiente automática: "Grupos formados"**.
  - Muestra columnas o tarjetas alineadas, una por grupo, con su nombre, color y los avatares y alias de sus integrantes.
  - Es responsive: 2–5 columnas según la pantalla.
- **Cada participante ve en su celular: "Estás en el 🟦 Grupo 3: Los Leones"** con los nombres de sus compañeros.
- Los grupos **permanecen durante toda la sesión** y quedan guardados: si se corta, al continuar siguen iguales. Solo **Reiniciar** los borra.
- Opcional: el profesor puede **mover a un participante** de un grupo a otro arrastrándolo.

---

## 7. Hoja "Ruleta"

**Configuración en el editor:**

- **Origen de los nombres:**
  - (a) **Escribir nombres** a mano, uno por línea o pegando una lista.
  - (b) **Grupos creados** en una hoja Agrupar anterior: se eligen de una lista y la ruleta muestra los nombres de los grupos con sus colores.
  - (c) **Participantes** registrados.
- **¿Puede repetir?**
  - **Sí:** el elegido sigue en la ruleta y puede volver a salir.
  - **No:** el elegido **se quita de la ruleta** después del sorteo, con una animación al salir. Cuando ya no queda nadie aparece "¡Todos han salido! [Reiniciar ruleta]".
- Opciones de diseño: colores de los gajos, sonido de giro, duración del giro.

**En vivo:**

- El profesor pulsa **GIRAR**. La ruleta gira con desaceleración y se detiene en el elegido, que se muestra con confeti y su nombre en grande.
- El resultado lo decide el **servidor** (RPC `ruleta_girar`), que guarda el sorteo. La animación solo "aterriza" en el gajo ya elegido, así que todos los celulares ven lo mismo y queda registrado.
- A un costado se muestra el **historial** de sorteos: 1° Grupo 2, 2° Grupo 5…
- El botón **"Reiniciar ruleta"** devuelve todos los nombres a la ruleta y borra el historial **de esa ruleta**.

---

## 8. Base de datos (archivo nuevo `sql/07_proyectos.sql`, re-ejecutable)

```
proyectos           (id, profesor_id → auth.users, nombre, tema jsonb, created_at, updated_at)
proyecto_hojas      (id, proyecto_id, orden, tipo, diseno jsonb, config jsonb)
                     -- tipo: contenido|pregunta|vf|opcion|completar|lluvia|agrupar|ruleta
proyecto_sesiones   (id, proyecto_id, pin unique, estado: activa|pausada|finalizada,
                     hoja_actual, registro_abierto bool, respuestas_abiertas bool,
                     revelar bool, created_at, updated_at)
sesion_participantes(id, sesion_id, nombre, alias, avatar, foto_url, token, grupo_id null,
                     expulsado bool, created_at)   unique(sesion_id, lower(alias))
sesion_grupos       (id, sesion_id, hoja_id, numero, nombre, color, emoji)
sesion_respuestas   (id, sesion_id, hoja_id, participante_id, grupo_id, valor jsonb, created_at)
ruleta_sorteos      (id, sesion_id, hoja_id, ronda, elegido_texto, elegido_grupo_id, created_at)
```

**RLS**

- El profesor solo ve y modifica sus propios proyectos y sesiones.
- El admin puede verlo todo.
- Los participantes **no** acceden a las tablas: todo pasa por RPCs `security definer` que validan el `pin` y el `token`.

**RPCs**

- Del profesor: `proyecto_iniciar_sesion`, `proyecto_ir_a_hoja`, `proyecto_registro(abrir/cerrar)`, `proyecto_formar_grupos(sesion, hoja, n_grupos)`, `proyecto_renombrar_grupo`, `proyecto_mover_participante`, `ruleta_girar(sesion, hoja)`, `ruleta_reiniciar(sesion, hoja)`, `proyecto_reiniciar_sesion`, `proyecto_finalizar`, `proyecto_resultados`.
- Del participante (anónimo): `proyecto_por_pin`, `proyecto_unirse(pin, nombre, alias, avatar, foto) → token`, `proyecto_estado(pin, token)`, `proyecto_responder(pin, token, hoja, valor)`.

**Permisos y almacenamiento**

- Agregar los GRANT de las tablas nuevas a `06_permisos.sql`, que se sigue ejecutando **al final**.
- Las imágenes van al bucket `preguntas-imagenes`, carpeta `proyectos/<profesor_id>/`.
- Las fotos de los participantes van a `proyectos/sesiones/<sesion_id>/`, con un tamaño máximo controlado.
- Limpieza: al **Reiniciar** o al borrar la sesión se eliminan las fotos de los participantes.

---

## 9. Archivos sugeridos

- `proyectos.html` + `js/proyectos/editor.js`: el editor.
- `js/proyectos/lienzo.js`: render de una hoja, compartido por el editor, la presentación y el celular.
- `js/proyectos/recursos.js`: fondos, plantillas, iconos y fuentes.
- `js/proyectos/vivo-profe.js` y `js/proyectos/vivo-alumno.js`: control del profesor y vista del participante.
- `js/proyectos/agrupar.js` y `js/proyectos/ruleta.js`.
- `css/proyectos.css`.
- `js/profesor.js` y `js/admin.js`: nueva entrada "Proyectos en grupo" en el menú izquierdo.
- La portada (`index.html`) ya acepta PIN: si el PIN es de un proyecto, redirigir a `proyecto.html?pin=`, igual que se hace con las salas.

---

## 10. Fases (implementar y probar en este orden)

1. **Base + editor:** tablas, lista de proyectos, crear y nombrar, editor con hojas de **Contenido**, recursos de diseño (incluida la imagen de fondo ajustable), vista web/celular con acomodo automático o a mano (`diseno.movil`), autoguardado y modo presentación.
   - **1b (adelantada). Hojas de preguntas en el editor:** pregunta abierta, V/F, opción múltiple, completar y lluvia de ideas; se diseñan, se ven en Web y Celular y se prueban en la presentación con **"Simular participantes"** (sin guardar).
2. **Sesión en vivo + Agrupar:** PIN/QR, unirse, participantes en vivo, cerrar registro, formar grupos, hoja de grupos, continuar y reiniciar. Las preguntas de la 1b funcionan con personas reales (respuestas guardadas, modo por grupo y pantalla "Resultados").
3. **Ruleta:** nombres, grupos o participantes; con o sin repetición; historial; reiniciar.

Al cerrar cada fase:

- Pruebas SQL (`pruebas/flujos_proyectos.sql`).
- Prueba E2E con Playwright: profesor + 3 celulares; cortar y continuar; reiniciar.
- Revisar en 390 px que no haya desbordes.

---

## 11. Reglas que no se deben romper

- No subir secretos ni `Quiz en linea.txt` al repositorio.
- No romper lo existente: quizzes, juegos, salas, publicaciones y modo vivo.
- Todo en español y con el estilo visual "Quiz Familia Marroquín".
