const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const axiosConfig = `
// Configurar Axios globalmente para saltar el aviso de Ngrok
axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';
axios.defaults.headers.common['Bypass-Tunnel-Reminder'] = 'true';
`;

// Insert after imports (around where the offline sync is injected)
if (!content.includes("ngrok-skip-browser-warning']")) {
  content = content.replace(
    /import axios from 'axios';/,
    "import axios from 'axios';" + axiosConfig
  );
  fs.writeFileSync('App.js', content);
  console.log('Axios headers configured globally in App.js');
} else {
  console.log('Axios headers already configured');
}
