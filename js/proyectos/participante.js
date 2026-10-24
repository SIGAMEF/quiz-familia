// ============================================================
// proyecto.html: ?pub=<publicación> o ?p=<proyecto público> → a su ritmo; si no, la sesión en vivo con PIN
// ============================================================
const q = new URLSearchParams(location.search);
if (q.get('pub') || q.get('p')) import('./ritmo.js');
else import('./vivo-alumno.js');
