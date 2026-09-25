const fs = require('fs');

let code = fs.readFileSync('desktop-app/src/AdminModule.jsx', 'utf8');

const loadInventarioAnchor = `  const cargarInventarioDesktop = async () => {
    try {
      // Usar la URL base configurada en Desktop o fallback a localhost:3000
      const baseUrl = window.location.port === '3000' ? '' : 'http://localhost:3000';
  
      const [resIns, resMov] = await Promise.all([
        fetch(\`\${baseUrl}/api/inventario/insumos\`).then(r => r.json()),
        fetch(\`\${baseUrl}/api/inventario/movimientos\`).then(r => r.json())
      ]);
  
      if (resIns?.insumos) {
        setInsumos(resIns.insumos);
      }
      if (resMov?.movimientos) {
        setMovimientos(resMov.movimientos);
      }
    } catch (err) {
      console.error('Error cargando inventario en Desktop:', err);
    }
  };`;

const loadInventarioNew = `  const cargarInventarioDesktop = async () => {
    try {
      const resIns = await axios.get(\`\${serverUrl}/api/inventario/insumos\`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      console.log("📦 RESPUESTA INSUMOS DESKTOP:", resIns.data);
      
      if (resIns.data?.insumos) {
        setInsumos(resIns.data.insumos);
      }
  
      const resMov = await axios.get(\`\${serverUrl}/api/inventario/movimientos\`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      if (resMov.data?.movimientos) {
        setMovimientos(resMov.data.movimientos);
      }
    } catch (err) {
      console.error("❌ Error cargando inventario en Desktop:", err.message);
      try {
        const ruta = \`\${window.location.protocol}//\${window.location.hostname}:3000/api/inventario/insumos\`;
        const r = await fetch(ruta);
        const d = await r.json();
        if (d.insumos) setInsumos(d.insumos);
      } catch (e2) {
        console.error("Fallo crítico de conexión a insumos:", e2);
      }
    }
  };`;

if (code.includes(loadInventarioAnchor)) {
    code = code.replace(loadInventarioAnchor, loadInventarioNew);
} else {
    code = code.replace(/const cargarInventarioDesktop = async \(\) => \{[\s\S]*?console\.error\('Error cargando inventario en Desktop:', err\);\s*\}\s*\};/, loadInventarioNew);
}

// Ensure the button calls the function explicitly
code = code.replace(
    `<button onClick={() => setAdminTab('insumos')} style={navBtnStyle(adminTab === 'insumos')}>`,
    `<button onClick={() => { setAdminTab('insumos'); cargarInventarioDesktop(); }} style={navBtnStyle(adminTab === 'insumos')}>`
);

fs.writeFileSync('desktop-app/src/AdminModule.jsx', code, 'utf8');
console.log("Patch successfully written to memory!");
