// Punto de entrada: decide qué mostrar según la dirección.
//   ?tv=ABCD       → pantalla grande de la sala
//   ?docente       → panel docente (con &sala=ABCD, el panel de esa sala)
//   ?sala=ABCD     → alumno entrando a la sala
//   ?diagnostico   → revisa la conexión de este dispositivo (=ABCD revisa también esa sala)
//   (nada)         → alumno: formulario con código y nombre
// Cada vista se baja recién cuando hace falta: los celulares de los invitados no cargan el panel,
// los bancos de ejemplo ni el diagnóstico (menos archivos por el wifi de la fiesta).
const raiz = document.getElementById('app');
const p = new URLSearchParams(location.search);

function fallo(e) {
  console.error(e);
  raiz.innerHTML = '<main class="centrado"><div class="tarjeta ingreso pila centro"><h1>No se pudo cargar</h1>'
    + '<p class="muted">Revisá la conexión y recargá la página.</p>'
    + '<button class="btn" onclick="location.reload()">Recargar</button></div></main>';
}

if (p.has('diagnostico')) import('./diagnostico.js').then((m) => m.iniciarDiagnostico(raiz, p.get('diagnostico'))).catch(fallo);
else if (p.has('tv')) import('./tv.js').then((m) => m.iniciarTv(raiz, p.get('tv'))).catch(fallo);
else if (p.has('docente')) import('./docente.js').then((m) => m.iniciarDocente(raiz)).catch(fallo);
else import('./alumno.js').then((m) => m.iniciarAlumno(raiz, p.get('sala'))).catch(fallo);
