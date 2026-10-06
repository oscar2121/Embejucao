const fs = require('fs');
const path = require('path');

function replaceFileContent(filePath, findStr, replaceStr) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(findStr, replaceStr);
  fs.writeFileSync(filePath, content, 'utf8');
}

function replaceAllFileContent(filePath, regex, replaceStr) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(regex, replaceStr);
  fs.writeFileSync(filePath, content, 'utf8');
}

// 1. Fix AdminModule.jsx
const adminFile = 'desktop-app/src/AdminModule.jsx';
let adminContent = fs.readFileSync(adminFile, 'utf8');

// A) Fix Intl.NumberFormat inside function (creates memory leak and blocks thread)
// Hoist it outside
const intlAdminFind = `  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
  };`;
const intlAdminReplace = `  // Oprimizado: instanciar el formateador una sola vez fuera del loop de render para evitar congelamientos
  const currencyFormatter = useMemo(() => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }), []);
  const formatCurrency = (value) => {
    return currencyFormatter.format(value);
  };`;
adminContent = adminContent.replace(intlAdminFind, intlAdminReplace);

// B) Fix useEffect overriding numMesasInput while typing
// The original was:
//    if (adminTab === 'mesas') {
//      setNumMesasInput(mesas ? mesas.length.toString() : '4');
//    }
// in the huge useEffect. We will extract it to its own useEffect that only depends on adminTab.
const badEffectFind = `    if (adminTab === 'mesas') {
      setNumMesasInput(mesas ? mesas.length.toString() : '4');
    }`;
const badEffectReplace = `    // numMesasInput was extracted to avoid overriding when mesas changes via socket`;
adminContent = adminContent.replace(badEffectFind, badEffectReplace);

const extraEffect = `  // Solución: Solo actualizar el input cuando se abre la pestaña de mesas, no cuando cambian las mesas por socket (evita congelamiento y pérdida de foco)
  useEffect(() => {
    if (adminTab === 'mesas') {
      setNumMesasInput(mesas ? mesas.length.toString() : '4');
    }
  }, [adminTab]);\n`;
  
// insert before the main useEffect
adminContent = adminContent.replace(/  useEffect\(\(\) => \{\n    if \(adminTab === 'auditoria'\) \{/, extraEffect + "  useEffect(() => {\n    if (adminTab === 'auditoria') {");

fs.writeFileSync(adminFile, adminContent, 'utf8');


// 2. Fix CajaModule.jsx
const cajaFile = 'desktop-app/src/CajaModule.jsx';
let cajaContent = fs.readFileSync(cajaFile, 'utf8');

const intlCajaFind = `  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
  };`;
const intlCajaReplace = `  // Optimizado
  const currencyFormatter = React.useMemo(() => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }), []);
  const formatCurrency = (value) => currencyFormatter.format(value);`;
cajaContent = cajaContent.replace(intlCajaFind, intlCajaReplace);

// import React if not exists
if (!cajaContent.includes("import React")) {
  cajaContent = cajaContent.replace("import { useState", "import React, { useState");
}

fs.writeFileSync(cajaFile, cajaContent, 'utf8');


// 3. Fix PedidosModule.jsx
const pedidosFile = 'desktop-app/src/PedidosModule.jsx';
let pedContent = fs.readFileSync(pedidosFile, 'utf8');

const intlPedFind = `  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value || 0);
  };`;
const intlPedReplace = `  // Optimizado
  const currencyFormatter = React.useMemo(() => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }), []);
  const formatCurrency = (value) => currencyFormatter.format(value || 0);`;
pedContent = pedContent.replace(intlPedFind, intlPedReplace);

if (!pedContent.includes("import React")) {
  pedContent = pedContent.replace("import { useState", "import React, { useState");
}

fs.writeFileSync(pedidosFile, pedContent, 'utf8');

console.log('Fixed freezing issues in Admin, Caja and Pedidos modules.');
