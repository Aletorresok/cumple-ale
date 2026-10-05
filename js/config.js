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
// Temática Springfield: cada equipo es un lugar de la ciudad (se pueden renombrar en el panel).
  { id: 'e1', nombre: 'Krusty Burger',       color: '#E4572E' },
  { id: 'e2', nombre: 'Escuela Primaria',    color: '#3D8BFF' },
  { id: 'e3', nombre: 'Planta Nuclear',      color: '#2BA36B' },
  { id: 'e4', nombre: 'Taberna de Moe',      color: '#8A4FD8' },
  { id: 'e5', nombre: 'Kwik-E-Mart',         color: '#C98A12' },
  { id: 'e6', nombre: 'Avenida Siempreviva', color: '#1A9BA8' },
];

// Una sala se puede usar durante este tiempo; después no admite invitados nuevos.
export const HORAS_SALA = 12;
