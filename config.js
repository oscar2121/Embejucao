// Configuración API
// Cambiar esto con la IP de tu servidor

export const API_URL = 'http://192.168.1.100:3001/api'; // Cambia esto con tu IP
export const SYNC_INTERVAL = 5000; // Sincronizar cada 5 segundos
export const TIMEOUT = 10000; // Timeout en ms

// Configuración de GitHub (Actualizaciones)
export const GITHUB_OWNER = "oscar2121";
export const GITHUB_REPO = "Embejucao";
export const GITHUB_TOKEN = (typeof process !== 'undefined' && process.env) ? process.env.GITHUB_TOKEN : undefined;

