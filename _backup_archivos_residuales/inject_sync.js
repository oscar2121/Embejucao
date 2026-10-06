const fs = require('fs');
const path = require('path');

// 1. App.js (React Native)
let appContent = fs.readFileSync('App.js', 'utf8');

if (!appContent.includes('offline_queue')) {
  const syncLogicRN = `
// --- OFFLINE SYNC QUEUE ---
const syncOfflineQueue = async () => {
  try {
    const queueStr = await AsyncStorage.getItem('offline_queue');
    if (!queueStr) return;
    const queue = JSON.parse(queueStr);
    if (queue.length === 0) return;
    
    console.log(\`Sincronizando \${queue.length} tareas pendientes...\`);
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
    if (remaining.length < queue.length) {
      console.log('Sincronizacin exitosa parcial o total');
    }
    await AsyncStorage.setItem('offline_queue', JSON.stringify(remaining));
  } catch (e) {}
};

setInterval(syncOfflineQueue, 10000); // Intentar sincronizar cada 10s

axios.interceptors.response.use(null, async (error) => {
  if (!error.response && error.config && ['post', 'put', 'delete'].includes(error.config.method?.toLowerCase())) {
    console.log('Error de red, guardando en cola offline...');
    try {
      const queueStr = await AsyncStorage.getItem('offline_queue');
      const queue = queueStr ? JSON.parse(queueStr) : [];
      queue.push({
        method: error.config.method,
        url: error.config.url,
        data: JSON.parse(error.config.data || '{}'),
        headers: error.config.headers
      });
      await AsyncStorage.setItem('offline_queue', JSON.stringify(queue));
      return Promise.resolve({ data: { success: true, offline: true } });
    } catch (e) {
      return Promise.reject(error);
    }
  }
  return Promise.reject(error);
});
// -------------------------
`;

  // Insert after the existing axios interceptor
  appContent = appContent.replace(
    /axios\.interceptors\.request\.use\([\s\S]*?\n\);/,
    match => match + '\n' + syncLogicRN
  );
  fs.writeFileSync('App.js', appContent, 'utf8');
}


// 2. desktop-app/src/main.jsx (React DOM)
const desktopMainPath = path.join('desktop-app', 'src', 'main.jsx');
if (fs.existsSync(desktopMainPath)) {
  let mainContent = fs.readFileSync(desktopMainPath, 'utf8');
  
  if (!mainContent.includes('offline_queue')) {
    const syncLogicDOM = `
import axios from 'axios';
// --- OFFLINE SYNC QUEUE ---
const syncOfflineQueue = async () => {
  try {
    const queueStr = localStorage.getItem('offline_queue');
    if (!queueStr) return;
    const queue = JSON.parse(queueStr);
    if (queue.length === 0) return;
    
    console.log(\`Sincronizando \${queue.length} tareas pendientes...\`);
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
`;
    // Insert after imports
    mainContent = mainContent.replace(
      /import App from '\.\/App\.jsx';?\n/,
      match => match + syncLogicDOM + '\n'
    );
    fs.writeFileSync(desktopMainPath, mainContent, 'utf8');
  }
}
console.log('Sync Queue injected successfully.');
