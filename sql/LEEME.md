# QuizApp v2 — Scripts de base de datos

Ejecutar en el **SQL Editor de Supabase**, en este orden.

| # | Archivo | Cuándo | ¿Borra algo? |
|---|---|---|---|
| 0 | `00_respaldo.sql` | **Ya mismo** | No. Copia todo a `respaldo_2026_10` |
| 1 | `01_limpiar.sql` | El día del cambio, cuando el nuevo frontend esté listo | **Sí**: tablas, funciones y cuentas que no son admin |
| 2 | `02_esquema.sql` | Justo después del 1 | No |
| 3 | `03_migrar.sql` | Justo después del 2 | No |
| 4 | `04_bancos_html.sql` | Opcional, después del 3 | No. Importa las 322 preguntas de `quiz.html` y `lucas.html` |
| 5 | `05_parche_paneles.sql` | Después del 4 (y cada vez que llegue una versión nueva) | No. Funciones de los paneles; se puede ejecutar varias veces |
| 6 | `06_permisos.sql` | **Siempre al final** (después del 05, 07, 08 y 09) | No. Da a la app los permisos sobre las tablas; se puede ejecutar varias veces |
| 7 | `07_proyectos.sql` | Después del 05 (y cada vez que llegue una versión nueva). Luego, otra vez el 06 | No. Proyectos en grupo (tablas, funciones y la política de Storage para `proyectos/`); se puede ejecutar varias veces |
| 8 | `08_archivos.sql` | Después del 07 (si vuelves a ejecutar el 07, ejecuta otra vez el 08). Luego, otra vez el 06 | No. "Mis archivos": registro de imágenes y videos, límite de espacio por profesor y políticas de Storage de la carpeta propia. Registra los archivos que ya estaban subidos |
| 9 | `09_actividades.sql` | Después del 08 (y después del 05, si lo vuelves a ejecutar). Luego, otra vez el 06 | No. Mis actividades: Trivia y Quiz relámpago como juegos, visibilidad (privado, grupos, público, destacado), fila de destacados de la portada y biblioteca con proyectos |

Pruebas opcionales (después del 07, 08, 09 y 06). Todo se deshace al final:
- `pruebas/flujos_proyectos.sql` → "TODAS LAS PRUEBAS DE PROYECTOS PASARON".
- `pruebas/flujos_archivos.sql` → "TODAS LAS PRUEBAS DE ARCHIVOS PASARON".
- `pruebas/flujos_actividades.sql` → "TODAS LAS PRUEBAS DE ACTIVIDADES PASARON" (después del 09).

Antes del paso 2, en Supabase → **Authentication → Sign In / Providers**:
- *Allow new users to sign up*: **activado**
- *Confirm email*: **desactivado**
- En **Auth Providers → Email**: el proveedor debe estar **habilitado** (Enable Email provider).

## Qué queda después del cambio
- La cuenta **admin** con el mismo usuario, correo y clave.
- Todos los quizzes antiguos a nombre del admin (con sus preguntas en orden). Desde el panel del admin se copian o transfieren a cada profesor.
- Las preguntas sueltas del banco quedan en un quiz "Banco sin asignar – <grupo>".
- Los bimestres (cortes) como **periodos**.
- Las imágenes del Storage siguen en el mismo lugar.
- No se migran grupos, alumnos, intentos ni concursos: profesores y alumnos se registran de nuevo.

## Si pruebas en un proyecto Supabase nuevo (opcional)
Ejecuta solo `02_esquema.sql`. Regístrate desde la app como profesor y luego conviértete en admin:

```sql
update public.perfiles set rol = 'admin' where usuario = 'TU_USUARIO';
delete from public.profesores where perfil_id = (select id from public.perfiles where usuario = 'TU_USUARIO');
```
Después puedes ejecutar `04_bancos_html.sql`.

## Para deshacer (si algo sale mal después del paso 1)
El respaldo sigue en el esquema `respaldo_2026_10`. Pídeme el script de restauración.
