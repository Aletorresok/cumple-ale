// Configuración de Firebase: proyecto propio de la fiesta («cumple-ale-7f78e»).
// Estos datos son públicos por diseño: lo que protege la información son las
// reglas de seguridad (firestore.rules), publicadas en ese proyecto.
export const firebaseConfig = {
  apiKey: 'AIzaSyDEOuR38FnR_vG5-L2jYrLq7TmThZRWkVY',
  authDomain: 'cumple-ale-7f78e.firebaseapp.com',
  projectId: 'cumple-ale-7f78e',
  storageBucket: 'cumple-ale-7f78e.firebasestorage.app',
  messagingSenderId: '334198047994',
  appId: '1:334198047994:web:68b0672accd3953d237543',
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
