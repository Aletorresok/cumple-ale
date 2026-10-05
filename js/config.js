// Configuración de Firebase. Por ahora usa el proyecto «juegos-aula» (ya configurado y con
// las mismas reglas), así la app funciona desde el primer día. Antes del cumple conviene
// pasar a un proyecto propio: ver «Puesta en marcha» en el README.
// Estos datos son públicos por diseño: lo que protege la información son las
// reglas de seguridad (firestore.rules).
export const firebaseConfig = {
  apiKey: 'AIzaSyBYu6rGFqYHm47hHEM0WwlVwtt0CnJzibA',
  authDomain: 'juegos-aula.firebaseapp.com',
  projectId: 'juegos-aula',
  storageBucket: 'juegos-aula.firebasestorage.app',
  messagingSenderId: '499149116773',
  appId: '1:499149116773:web:c23f116e301a3f2fbf7d8c',
};

// Equipos disponibles al crear una sala (se usan los primeros N).
export const EQUIPOS_BASE = [
  { id: 'e1', nombre: 'Coral',    color: '#E4572E' },
  { id: 'e2', nombre: 'Azul',     color: '#2E6FE4' },
  { id: 'e3', nombre: 'Verde',    color: '#2BA36B' },
  { id: 'e4', nombre: 'Violeta',  color: '#8A4FD8' },
  { id: 'e5', nombre: 'Ámbar',    color: '#C98A12' },
  { id: 'e6', nombre: 'Turquesa', color: '#1A9BA8' },
];

// Una sala se puede usar durante este tiempo; después no admite invitados nuevos.
export const HORAS_SALA = 12;
