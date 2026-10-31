# Fondos de culto (para copiar al proyecto)

Copia esta carpeta completa a `assets/fondos-culto/` en el repositorio.

| Archivo | Qué es |
|---|---|
| `escenas.js` | 16 fondos animados con escenas. **Cristianos (7):** cruz al atardecer, camino a la cruz, cruz en la gloria, paloma en el cielo, manos en adoración, oración al atardecer y fogata. **Niños (4):** prado con ovejas, arcoíris, globos y fondo del mar. **Jóvenes (4):** notas musicales, ecualizador, concierto y guitarra. Es un módulo ES con el mismo formato que `FONDOS`. |
| `galeria.html` | Vista previa de las 22 plantillas, los 28 fondos y los 30 objetos. Ábrelo en el navegador. |

## Integración

```js
import { ESCENAS } from '../../assets/fondos-culto/escenas.js';
Object.values(FONDOS).forEach(f => f.cat ??= 'Abstractos');
Object.assign(FONDOS, ESCENAS);   // cada fondo trae su categoría en f.cat
```

- Las 4 plantillas nuevas (Al pie de la cruz, Escuela dominical, Noche de alabanza y Fogata) están en `PLANTILLAS` dentro de `galeria.html`.
- Todo se dibuja con canvas: no hay imágenes que subir a Supabase.
