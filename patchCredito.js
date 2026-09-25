const fs = require('fs');

// Patch App.js
let appPath = 'App.js';
let appCode = fs.readFileSync(appPath, 'utf8');
appCode = appCode.replace(/tipo_origen: 'Fiado Pagado'/g, "tipo_origen: 'Crédito Pagado'");
fs.writeFileSync(appPath, appCode);
console.log("App.js patched");

// Patch CajaModule.jsx
let cajaPath = 'desktop-app/src/CajaModule.jsx';
let cajaCode = fs.readFileSync(cajaPath, 'utf8');
cajaCode = cajaCode.replace(/if \(metodo === 'Fiado'\)/g, "if (metodo === 'Crédito')");
cajaCode = cajaCode.replace(/tipo_origen: pedidoACobrar.uuids \? 'Fiado Pagado' : 'Mesa'/g, "tipo_origen: pedidoACobrar.uuids ? 'Crédito Pagado' : 'Mesa'");
cajaCode = cajaCode.replace(/onClick=\{\(\) => confirmarCobro\('Fiado'\)\}/g, "onClick={() => confirmarCobro('Crédito')}");
fs.writeFileSync(cajaPath, cajaCode);
console.log("CajaModule.jsx patched");
