const fs = require('fs');

let appPath = 'App.js';
let appCode = fs.readFileSync(appPath, 'utf8');

// Safeguard formatCurrency
appCode = appCode.replace(
  /const formatCurrency = \(val\) => \{[\s\n]*return Number\(val\)\.toLocaleString\("es-CO", \{ style: "currency", currency: "COP", minimumFractionDigits: 0 \}\);[\s\n]*\};/,
  `const formatCurrency = (val) => {
    const num = Number(val);
    if (isNaN(num)) return "$0";
    try {
      return num.toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });
    } catch(e) { return "$" + num; }
  };`
);

// Safeguard date formatting in CajaView
appCode = appCode.replace(
  /Abierta: \{new Date\(sesionActiva\.fecha_apertura\)\.toLocaleString\('es-CO'\)\}/g,
  `Abierta: {sesionActiva.fecha_apertura ? new Date(sesionActiva.fecha_apertura).toLocaleString('es-CO').replace('Invalid Date', 'Fecha Desconocida') : 'Fecha Desconocida'}`
);

// Fix abrirCaja to only accept object response
appCode = appCode.replace(
  /if \(res\.data\) \{\n\s*setSesionActiva\(res\.data\);/,
  `if (res.data && typeof res.data === 'object' && !res.data.includes && res.data.id) {
        setSesionActiva(res.data);`
);

fs.writeFileSync(appPath, appCode);
console.log("App.js patched to prevent native crashes on HTML responses.");
