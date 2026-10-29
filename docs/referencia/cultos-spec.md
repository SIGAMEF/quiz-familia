# Especificación: módulo "Cultos" (proyección de canciones, versículos y avisos)

> Para implementar con Claude Code en SIGAMEF/quiz-familia.
> **Reutilizar lo que ya existe en Proyectos en grupo:** el lienzo/editor tipo Canva (`js/proyectos/lienzo.js`, recursos, plantillas), "Mis archivos" con su limpieza de Storage, los PIN/QR y el estilo visual.
> **No copiar** diseños, plantillas, textos ni la API de otras apps (como Reuna Presenter): solo sirven de referencia de flujo. Todo lo visual debe ser propio.

---

## 1. Idea en una frase

El profesor arma un **culto**, que es una lista ordenada de elementos: bienvenida, canciones, versículos, avisos y videos. Cada elemento lleva una **plantilla** bonita. Después:

- **Proyecta** el culto en otra pestaña o pantalla y lo controla desde la PC o el celular.
- **Publica** el culto para que los coristas vean las letras en su propio celular, cada uno a su ritmo.

**Principio de diseño: simple primero.** Al entrar a la sección hay solo **3 pestañas**: **Cultos**, **Canciones** y **Plantillas**. Las opciones avanzadas quedan dentro de un "Más opciones" plegado.

---

## 2. Dónde aparece

- En el menú del profesor (y del admin): **🎵 Cultos**.
- Al entrar se ve la pestaña **Cultos**: el próximo culto arriba, en grande, con los botones **[Proyectar] [Enlace coristas] [Editar]**, y debajo el botón **"+ Nuevo culto"** y la lista de cultos anteriores (con duplicar y eliminar).
- La primera vez aparece una guía de 3 pasos: *1) Agrega canciones → 2) Crea un culto → 3) Proyecta o comparte.*

---

## 3. Canciones (biblioteca)

**"+ Nueva canción":**

1. **Título**, **autor** (opcional) y **tono** (opcional).
2. **Letra:** un cuadro grande donde se **pega** la letra.
   - Junto al cuadro va el botón **"🔎 Buscar letra en Google"**, que abre una pestaña nueva con la búsqueda `letra <título> <autor>`. La persona copia la letra y la pega aquí.
   - **No** hacer búsqueda automática ni copiar letras de otros sitios: las letras tienen derechos de autor y esos sitios no lo permiten.
3. **Limpieza automática al pegar:**
   - Quitar espacios dobles, publicidad típica ("Letra de…", "Ver video") y líneas vacías repetidas.
   - Corregir mayúsculas al inicio de cada línea.
   - Expandir las repeticiones `//…//` y `(x2)` en líneas repetidas, o mostrarlas como "×2", según una opción.
4. **"✓ Revisar ortografía":** usa la API gratuita de LanguageTool (`api.languagetool.org`, idioma `es`).
   - Muestra las sugerencias subrayadas para aceptarlas una por una o todas.
   - Nunca cambia nada sin que la persona lo confirme.
   - Si la API no responde, usar el corrector del navegador (`spellcheck`).
5. **Estrofas:** se detectan por las líneas en blanco. Cada bloque tiene una etiqueta editable (Estrofa 1, **Coro**, Puente, Final), que se puede elegir con un clic.
   - Opción **"Orden de canto"**, por ejemplo E1, Coro, E2, Coro, Coro. Así el coro no se escribe dos veces.
6. **División automática en diapositivas:**
   - Máximo de líneas por pantalla: 2, 4 (por defecto) o 6.
   - Nunca se corta una estrofa por la mitad de una línea.
   - El texto **se ajusta solo** al cuadro de la plantilla, con el tamaño de letra más grande que quepa y un mínimo legible.
   - Debajo se muestran las miniaturas de las diapositivas resultantes: "Esta canción saldrá en **7 pantallas**". Al hacer clic entre dos líneas se fuerza un corte.
7. **Biblioteca:** buscador por título o letra y etiquetas (adoración, alabanza, juvenil, Santa Cena…).
   - Opcional: **"Compartir con mi iglesia"**, para que otros profesores de la misma institución vean la canción.

---

## 4. Plantillas (tipo Canva)

- Se usa **el mismo editor de Proyectos**: fondo, texto, imagen, iconos, emojis, formas, video, Mis archivos, pegar con Ctrl+V y arrastrar.
- Cada plantilla tiene una **zona de texto** marcada ("Aquí va la letra / el versículo"), donde se acomoda el contenido automáticamente.
- **Prediseñadas (incluidas desde el inicio, ~12, de diseño propio):** Bienvenida, Adoración, Alabanza/Festivo, Juvenil, Palabra/Versículo, Oración, Ofrenda, Santa Cena, Anuncio/Evento, Cuenta regresiva, Bautismo y Cierre/Bendición.
- **Fondos:**
  - **Estáticos:** colores, degradados e imágenes.
  - **Animados por defecto** (CSS/canvas, sin descargas pesadas): degradado que fluye, partículas de luz, bokeh, nubes suaves, ondas, estrellas, rayos de luz y confeti.
  - **Video en bucle**, opcional: archivos propios cortos (≤10 MB) desde Mis archivos.
- **Sonido opcional por plantilla:** pad o ambiente suave en bucle (generado con WebAudio, o archivos CC0 incluidos en el repo), con volumen y botón de silencio. Siempre empieza **apagado**.
- **Estilo del culto:** se elige una plantilla base para todo el culto, y cada elemento puede cambiar la suya.

---

## 5. Crear un culto

**"+ Nuevo culto"** pide: **nombre**, **fecha** y **plantilla base**. Luego se ve una lista vertical de elementos, con botones **"+ Agregar"** entre ellos (se inserta **justo ahí**):

| Elemento | Qué pide |
|---|---|
| 🎵 Canción | Elegir de la biblioteca (buscador) o crear una nueva en ese momento. |
| 📖 Versículo | Escribir "Juan 3:16-18" o elegir libro, capítulo y versículos. Se divide en pantallas solo y muestra la cita abajo. |
| 👋 Texto / Bienvenida | Título y texto libre sobre la plantilla. |
| 📢 Anuncio / Imagen | Imagen (subir, pegar o desde Mis archivos) o diseño de plantilla. |
| ▶️ Video | Enlace de YouTube o archivo propio. |
| ⏱ Cuenta regresiva | Minutos y texto ("El culto empieza en…"). |

- Los elementos se **arrastran para reordenar** y tienen botones de **duplicar** y **🗑 eliminar con "Deshacer"**.
- Cada elemento muestra su número de pantallas y una miniatura.
- **Autoguardado**, igual que en Proyectos.
- **Duplicar culto**, para repetir la estructura del domingo pasado.

---

## 6. Biblia

- Lector de referencias: "Jn 3:16", "Juan 3:16-18", "Sal 23" y "1 Co 13:4-7", con abreviaturas en español.
- **Versión incluida: Reina-Valera 1909** (dominio público), como JSON en el repo (`datos/biblia/rv1909.json`). Se carga solo cuando se usa y se guarda en caché.
- **Reina-Valera 1960:** tiene derechos de autor (Sociedades Bíblicas Unidas), así que **no se incluye** sin permiso. Dejar la estructura lista para agregar más versiones (`versiones.json`), por si la iglesia consigue licencia o usa una API autorizada.
- Búsqueda por palabra dentro de la versión cargada (opcional, fase 4).

---

## 7. Proyectar (en vivo)

**El botón "▶ Proyectar"** abre **dos ventanas**:

1. **Pantalla de proyección** (`culto-pantalla.html?c=…`), que se arrastra al proyector o TV y se pone en pantalla completa con F11 o un botón. Solo muestra la diapositiva actual, con transición suave (fundido).
2. **Consola del operador**, en la ventana actual:
   - A la izquierda, los elementos del culto.
   - Al centro, las diapositivas del elemento actual en miniaturas: un clic proyecta esa diapositiva.
   - Arriba, **"En pantalla"** y **"Siguiente"**.
   - Botones grandes: **◀ Anterior · Siguiente ▶**, **⬛ Negro**, **🖼 Logo**, **🧹 Limpiar texto** (deja solo el fondo) y **🔇 Sonido**.
   - Teclado: ← → / espacio, B = negro, L = logo, C = limpiar.

**Sincronización (sin gastar cuota):**

- Consola y pantalla en el **mismo equipo**: `BroadcastChannel`, sin pasar por Supabase.
- **Control remoto**: el botón **"📱 Control remoto"** genera un QR y un enlace (con botón "Enviar por WhatsApp": `https://wa.me/?text=…`).
  - El celular que lo abre ve los mismos controles (anterior, siguiente, negro, lista de elementos).
  - Usa **Supabase Realtime (broadcast)** en un canal con un código secreto. El plan gratis incluye 2 millones de mensajes y 200 conexiones.
  - Si Realtime falla, usar el sondeo con versión ("sin cambios").
- **Pantalla en otro equipo**: el enlace "Abrir pantalla en otro equipo" sirve para conectar un TV o una PC de cabina por QR.
- Los códigos de control y pantalla son **largos y secretos** (no son PIN de 6 dígitos) y se pueden **regenerar** ("Cerrar accesos remotos").

---

## 8. Publicar para coristas (independiente de proyectar)

- **"📤 Publicar"** guarda una **versión publicada** del culto (copia fija) y genera el **enlace o QR para coristas** (`letras.html?c=…`, con botón de WhatsApp).
- **Qué ve el corista en su celular:**
  - La lista de canciones del culto, en orden.
  - Al tocar una: la letra completa **en vertical**, con scroll propio, estrofas y coro marcados, y un botón para cambiar el tamaño de letra.
  - Modo oscuro y pantalla siempre encendida (Wake Lock).
  - Lo que hace en su celular **no afecta** la proyección.
  - Opcional: un botón **"Seguir proyección"**, que salta a la canción que se está proyectando si hay una en curso.
- **Funciona aunque nadie esté proyectando**: basta con que el culto esté publicado.
- **Editar y volver a publicar:** los cambios no se ven hasta pulsar **"Publicar cambios"**. El enlace sigue siendo el mismo.
- **"Despublicar"** desactiva el enlace.
- Las letras se descargan **una vez** (~20 KB) y quedan guardadas en el celular, así funcionan aunque falle la señal.

---

## 9. Archivos e imágenes (sin basura)

- Todo lo que se sube pasa por **Mis archivos**, con hash anti-duplicados.
- Cambiar un fondo **no borra** el archivo: queda en Mis archivos.
- **"Limpiar no usados"** revisa cultos, plantillas, proyectos, juegos y preguntas antes de borrar.
- Al borrar un archivo se elimina **de verdad** de Storage.

---

## 10. Datos (archivo nuevo `sql/08_cultos.sql`, re-ejecutable; luego `06_permisos.sql`)

```
canciones        (id, profesor_id, titulo, autor, tono, etiquetas text[], bloques jsonb,   -- [{tipo:'coro', texto}]
                  orden_canto jsonb, compartida bool, created_at, updated_at)
plantillas_culto (id, profesor_id null=prediseñada, nombre, categoria, diseno jsonb, zona_texto jsonb, sonido jsonb)
cultos           (id, profesor_id, nombre, fecha, plantilla_base, items jsonb,              -- borrador
                  publicado jsonb, publicado_en, codigo_coristas, codigo_control, codigo_pantalla,
                  created_at, updated_at)
```

- **RLS:** cada profesor ve lo suyo, más las canciones compartidas de su institución.
- **RPCs públicas** (para coristas y pantalla) que validan el código y devuelven solo lo publicado: `culto_letras(codigo)` y `culto_pantalla(codigo)`.

---

## 11. Fases

1. **Canciones:** pegar letra, limpieza, ortografía, estrofas, división automática y biblioteca.
2. **Cultos + plantillas:** lista de elementos, plantillas prediseñadas y fondos animados, consola + pantalla en el mismo equipo.
3. **Publicar para coristas + control remoto y pantalla en otro equipo** (Realtime).
4. **Biblia RV1909** (referencias y búsqueda), sonidos y "Seguir proyección".

Al cerrar cada fase:

- Pruebas SQL y E2E con Playwright: PC con consola + pantalla, celular con control y celular de corista.
- Revisar en 390 px que no haya desbordes.
- **No hacer push** hasta que el usuario lo pruebe.

---

## 12. Ampliación (28-oct): galería de referencia y objetos animados

- Referencia visual: `docs/referencia/plantillas-culto.html` con 18 plantillas (6 juveniles con objetos en movimiento), 12 fondos animados (canvas) y 30 objetos animados (SVG + emoji + frases, animación CSS).
- Todo lo prediseñado vive **en el código** (`js/cultos/fondos.js`, `plantillas.js`, `objetos.js`): no va a Supabase. En Supabase solo van las plantillas que crea el profesor (JSON pequeño) y sus imágenes propias (Mis archivos).
- Las plantillas son elementos editables del lienzo: se pueden modificar y guardar como plantilla propia ("Guardar como plantilla").
- Panel "Objetos" en el editor (Cultos y Proyectos): insertar, mover, cambiar tamaño, elegir animación (flotar, rebotar, girar, latir, balancear, subir, brillo) y velocidad.
- Editor de canciones en 3 columnas con estrofas plegables, selector único de tipo, vista previa fija y aviso de coros repetidos.
