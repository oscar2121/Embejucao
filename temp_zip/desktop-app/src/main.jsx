import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import axios from 'axios';
// --- OFFLINE SYNC QUEUE ---
const syncOfflineQueue = async () => {
  try {
    const queueStr = localStorage.getItem('offline_queue');
    if (!queueStr) return;
    const queue = JSON.parse(queueStr);
    if (queue.length === 0) return;
    
    console.log(`Sincronizando ${queue.length} tareas pendientes...`);
    const remaining = [];
    for (let req of queue) {
      try {
        await axios({
          method: req.method,
          url: req.url,
          data: req.data,
          headers: req.headers,
          timeout: 10000
        });
      } catch (e) {
        remaining.push(req);
      }
    }
    localStorage.setItem('offline_queue', JSON.stringify(remaining));
  } catch (e) {}
};

setInterval(syncOfflineQueue, 10000); // Intentar sincronizar cada 10s

axios.interceptors.response.use(null, async (error) => {
  if (!error.response && error.config && ['post', 'put', 'delete'].includes(error.config.method?.toLowerCase())) {
    console.log('Error de red, guardando en cola offline...');
    try {
      const queueStr = localStorage.getItem('offline_queue');
      const queue = queueStr ? JSON.parse(queueStr) : [];
      queue.push({
        method: error.config.method,
        url: error.config.url,
        data: error.config.data ? JSON.parse(error.config.data) : {},
        headers: error.config.headers
      });
      localStorage.setItem('offline_queue', JSON.stringify(queue));
      return Promise.resolve({ data: { success: true, offline: true } });
    } catch (e) {
      return Promise.reject(error);
    }
  }
  return Promise.reject(error);
});
// -------------------------

import { Toaster } from 'react-hot-toast'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Toaster position="top-right" />
  </StrictMode>,
)
