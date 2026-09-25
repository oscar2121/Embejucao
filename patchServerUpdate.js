const fs = require('fs');

const serverFile = 'server.js';
let content = fs.readFileSync(serverFile, 'utf8');

const oldCheckUpdate = `// Endpoint para comprobar actualizaciones de la app y del servidor
app.get('/api/check-update', async (req, res) => {
  try {
    console.log('?? Buscando lltima release en GitHub...');
    const response = await axios.get(
      'https://api.github.com/repos/oscar2121/Embejucao/releases/latest',
      {
        headers: {
          'Authorization': \`Bearer \${token}\`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Node-Express-Server'
        },
        timeout: 10000 // 10s timeout
      }
    );

    const release = response.data;
    const rawVersion = release.tag_name;
    const version = rawVersion.replace(/^v/, ''); // Limpiar 'v'

    // Extraer notas de versin (changelog)
    const notes = release.body 
      ? release.body.split(/\\r?\\n/).map(line => line.trim()).filter(line => line.length > 0)
      : [];

    let apkAsset = null;
    let zipAsset = null;

    if (release.assets && Array.isArray(release.assets)) {
      apkAsset = release.assets.find(a => a.name.toLowerCase().endsWith('.apk'));
      zipAsset = release.assets.find(a => a.name.toLowerCase().endsWith('.zip'));
    }

    // Resolver IP/Puerto dinmico
    const host = req.get('host') || \`localhost:\${PORT}\`;
    const protocol = req.protocol || 'http';
    const serverBaseUrl = \`\${protocol}://\${host}\`;

    const apkUrl = apkAsset ? apkAsset.browser_download_url : null;
    const serverUrl = zipAsset ? zipAsset.browser_download_url : null;

    res.json({
      version,
      notes,
      apkUrl,
      serverUrl
    });
  } catch (error) {
    console.error('?O Error al buscar actualizaciones en GitHub:', error.message);
    res.status(500).json({ 
      error: 'Error al conectar con GitHub para buscar actualizaciones',
      details: error.message 
    });
  }
});`;

const newCheckUpdate = `// Endpoint para comprobar actualizaciones de la app y del servidor (Dual)
app.get('/api/check-update', async (req, res) => {
  const platform = req.query.platform || 'mobile'; // 'mobile' o 'desktop'
  
  try {
    console.log(\`?? Buscando última release en GitHub para plataforma: \${platform}...\`);
    const response = await axios.get(
      'https://api.github.com/repos/oscar2121/Embejucao/releases/latest',
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Embejucao-App'
        },
        timeout: 10000 // 10s timeout
      }
    );

    const release = response.data;
    const latestVersion = release.tag_name ? release.tag_name.replace(/^v/, '') : '';

    const notes = release.body 
      ? release.body.split(/\\r?\\n/).map(line => line.trim()).filter(line => line.length > 0)
      : [];

    let downloadUrl = null;
    if (release.assets && Array.isArray(release.assets)) {
      let targetAsset = null;
      if (platform === 'mobile') {
        targetAsset = release.assets.find(a => a.name.toLowerCase().endsWith('.apk'));
      } else if (platform === 'desktop') {
        targetAsset = release.assets.find(a => a.name.toLowerCase().endsWith('.exe'));
      }
      if (targetAsset) {
        downloadUrl = targetAsset.browser_download_url;
      }
    }

    res.json({
      updateAvailable: true,
      latestVersion,
      releaseNotes: notes,
      downloadUrl
    });
  } catch (error) {
    // Si GitHub devuelve 404 significa que no hay releases an.
    if (error.response && error.response.status === 404) {
      return res.json({ updateAvailable: false, message: 'Sin releases disponibles' });
    }
    console.error('?O Error al buscar actualizaciones en GitHub:', error.message);
    res.json({ updateAvailable: false, message: 'Error de red o lmite de GitHub' });
  }
});`;

// Using Regex to replace the whole block robustly
const regex = /\/\/ Endpoint para comprobar actualizaciones de la app y del servidor[\s\S]*?res\.status\(500\)\.json\(\{[\s\S]*?\}\);\s*\}\s*\}\);/;
content = content.replace(regex, newCheckUpdate);

fs.writeFileSync(serverFile, content, 'utf8');
console.log('server.js update endpoint patched successfully');
