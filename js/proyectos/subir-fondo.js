// ============================================================
// Subir un fondo propio (panel Fondo del editor): PNG, JPG, WebP, GIF, MP4, WebM y MOV
// - Todo pasa por "Mis archivos" (sin duplicados, con su límite y su limpieza) y queda en "Mis fondos".
// - Imágenes: se reducen a 1920 px de ancho como máximo. Los GIF se guardan tal cual (hasta 8 MB, para no perder la animación).
// - Videos: hasta 25 MB. Antes de subirlo se prueba que este navegador lo pueda reproducir (el MOV a veces no:
//   entonces no se sube) y se saca una portada del primer cuadro, que se sube también y se usa en las
//   miniaturas, el editor y los celulares. El video completo solo se carga al proyectar.
// ============================================================
import { guardarArchivo, marcarFondo } from './archivos.js';

export const ACEPTA_FONDO = 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mov';
export const NO_REPRODUCE = 'Este video no se puede reproducir aquí; conviértelo a MP4';
const MB = 1024 * 1024;
const MAX_IMAGEN = 25 * MB, MAX_GIF = 8 * MB, MAX_VIDEO = 25 * MB, ANCHO_MAX = 1920, ANCHO_PORTADA = 1280;
const IMAGENES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const VIDEOS = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

// 'imagen' | 'gif' | 'video' | null (por el tipo, o por la extensión si el navegador no lo dice)
export function tipoDeFondo(f) {
  const t = f?.type || '', ext = String(f?.name || '').toLowerCase().split('.').pop();
  if (t === 'image/gif' || (!t && ext === 'gif')) return 'gif';
  if (IMAGENES[t] || (!t && ['png', 'jpg', 'jpeg', 'webp'].includes(ext))) return 'imagen';
  if (VIDEOS[t] || ['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  return null;
}

const aBlob = (c, tipo, q) => new Promise(r => c.toBlob(r, tipo, q));
// Imagen: a 1920 px de ancho como máximo, en WebP (o JPG si el navegador no hace WebP)
async function reducir(archivo) {
  const bmp = await createImageBitmap(archivo);
  const k = Math.min(1, ANCHO_MAX / bmp.width);
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  let b = await aBlob(c, 'image/webp', 0.86);
  if (!b || b.type !== 'image/webp') b = await aBlob(c, 'image/jpeg', 0.86);
  // si ya era chica y liviana, se deja la original
  return k === 1 && b && archivo.size <= b.size ? { blob: archivo, ancho: bmp.width, alto: bmp.height } : { blob: b, ancho: c.width, alto: c.height };
}

// Prueba el video en este navegador y saca la portada (primer cuadro). Falla con NO_REPRODUCE si no se puede ver.
export function probarVideo(archivo, { espera = 15000 } = {}) {
  return new Promise((listo, mal) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(archivo);
    let hecho = false;
    const fin = (err, r) => { if (hecho) return; hecho = true; clearTimeout(t); v.removeAttribute('src'); v.load(); URL.revokeObjectURL(url); err ? mal(err) : listo(r); };
    const t = setTimeout(() => fin(new Error(NO_REPRODUCE)), espera);
    Object.assign(v, { muted: true, playsInline: true, preload: 'auto' });
    v.onerror = () => fin(new Error(NO_REPRODUCE));
    v.onloadeddata = () => {
      if (!v.videoWidth || !v.videoHeight) return fin(new Error(NO_REPRODUCE));   // solo sonido o un códec que no se ve
      const destino = Math.min(0.1, (v.duration || 1) / 2);
      if (Math.abs(v.currentTime - destino) < 0.01) v.onseeked();
      else v.currentTime = destino;
    };
    v.onseeked = async () => {
      try {
        const k = Math.min(1, ANCHO_PORTADA / v.videoWidth);
        const c = document.createElement('canvas');
        c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        const portada = await aBlob(c, 'image/jpeg', 0.82);
        if (!portada) throw new Error(NO_REPRODUCE);
        fin(null, { ancho: v.videoWidth, alto: v.videoHeight, duracion: v.duration, portada });
      } catch (e) { fin(e); }
    };
    v.src = url;
  });
}

// Sube el fondo y lo deja en "Mis fondos". Devuelve { archivo, reutilizado } (archivo.tipo: 'imagen' | 'video').
// avisar(texto): para mostrar en qué paso va.
export async function subirFondo(archivo, { profesorId, avisar = () => {} }) {
  const tipo = tipoDeFondo(archivo);
  if (!tipo) throw new Error('Ese archivo no sirve de fondo. Usa una imagen (PNG, JPG, WebP o GIF) o un video (MP4, WebM o MOV).');
  const nombre = archivo.name || (tipo === 'video' ? 'Video de fondo' : 'Fondo');
  const subir = (blob, ext, t, extra = {}) => guardarArchivo({ profesorId, original: archivo, blob, tipo: t, ext, nombre, ...extra });

  if (tipo === 'gif') {
    if (archivo.size > MAX_GIF) throw new Error('El GIF debe pesar menos de 8 MB (se guarda tal cual, para que siga animado).');
    avisar('Subiendo el GIF…');
    const bmp = await createImageBitmap(archivo).catch(() => null);
    const r = await subir(archivo, 'gif', 'imagen', { ancho: bmp?.width ?? null, alto: bmp?.height ?? null });
    return { archivo: await marcarFondo(r.archivo), reutilizado: r.reutilizado };
  }
  if (tipo === 'imagen') {
    if (archivo.size > MAX_IMAGEN) throw new Error('La imagen debe pesar menos de 25 MB.');
    avisar('Preparando la imagen…');
    const img = await reducir(archivo);
    avisar('Subiendo la imagen…');
    const r = await subir(img.blob, IMAGENES[img.blob.type] || 'jpg', 'imagen', { ancho: img.ancho, alto: img.alto });
    return { archivo: await marcarFondo(r.archivo), reutilizado: r.reutilizado };
  }
  // video
  if (archivo.size > MAX_VIDEO) throw new Error('El video debe pesar menos de 25 MB. Recórtalo o bájale la calidad, o usa un enlace de YouTube como elemento.');
  avisar('Revisando el video…');
  const info = await probarVideo(archivo);
  const ext = VIDEOS[archivo.type] || String(archivo.name || '').toLowerCase().split('.').pop() || 'mp4';
  avisar('Subiendo el video…');
  // en Windows el MOV a veces llega sin tipo: se le pone, para que Storage lo sirva como video
  const tipoVideo = archivo.type || Object.keys(VIDEOS).find(k => VIDEOS[k] === ext) || 'video/mp4';
  const r = await subir(archivo.type ? archivo : new Blob([archivo], { type: tipoVideo }), ext, 'video', { ancho: info.ancho, alto: info.alto });
  let portada = r.archivo.portada || null;
  if (!portada) {
    avisar('Guardando la portada…');
    const k = Math.min(1, ANCHO_PORTADA / info.ancho);
    const p = await guardarArchivo({ profesorId, original: info.portada, blob: info.portada, tipo: 'imagen', ext: 'jpg',
      nombre: `Portada de ${nombre}`.slice(0, 120), ancho: Math.round(info.ancho * k), alto: Math.round(info.alto * k) });
    portada = p.archivo.url;
  }
  return { archivo: await marcarFondo(r.archivo, portada), reutilizado: r.reutilizado };
}
