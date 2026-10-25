# Marca de versión para los archivos de los juegos (js/juegos/*.js y sus estilos).
# GitHub Pages deja que el navegador guarde cada archivo hasta 10 minutos; si se publica un cambio,
# un celular podía mezclar archivos nuevos con viejos y el juego no cargaba. Con "?v=<versión>" en cada
# import, cada versión publicada se descarga completa y nunca se mezcla.
#
# Uso (desde la carpeta del proyecto), cada vez que cambies algo de los juegos y antes de subirlo:
#     python herramientas/version_juegos.py
import io, os, re, sys, time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JUEGOS = os.path.join(RAIZ, 'js', 'juegos')
V = sys.argv[1] if len(sys.argv) > 1 else time.strftime('%Y%m%d%H%M')
ESPEC = re.compile(r"""(['"])(\.{1,2}/(?:[\w-]+/)*[\w-]+\.js)(?:\?v=[\w.-]+)?\1""")

def versionar_js(ruta):
    carpeta = os.path.dirname(ruta)
    s = io.open(ruta, encoding='utf-8').read()
    def cambiar(m):
        destino = os.path.normpath(os.path.join(carpeta, m.group(2)))
        if os.path.dirname(destino) != os.path.normpath(JUEGOS) or not os.path.exists(destino): return m.group(0)
        return f"{m.group(1)}{m.group(2)}?v={V}{m.group(1)}"
    n = ESPEC.sub(cambiar, s)
    if n != s: io.open(ruta, 'w', encoding='utf-8', newline='').write(n); return True
    return False

cambiados = []
for base, _, archivos in os.walk(os.path.join(RAIZ, 'js')):
    for a in archivos:
        if a.endswith('.js') and versionar_js(os.path.join(base, a)): cambiados.append(os.path.relpath(os.path.join(base, a), RAIZ))
# la página de los juegos: el script principal y los estilos
html = os.path.join(RAIZ, 'juegos.html')
s = io.open(html, encoding='utf-8').read()
n = re.sub(r'(js/juegos/app\.js|css/juegos\.css|css/app\.css)(\?v=[\w.-]+)?"', lambda m: f'{m.group(1)}?v={V}"', s)
if n != s: io.open(html, 'w', encoding='utf-8', newline='').write(n); cambiados.append('juegos.html')
print(f'versión {V}: {len(cambiados)} archivos')
for c in cambiados: print('  ', c)
