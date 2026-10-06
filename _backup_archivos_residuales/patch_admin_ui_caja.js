const fs = require('fs');

let content = fs.readFileSync('desktop-app/src/AdminModule.jsx', 'utf8');

const regex = /\{dashboardData\?\.sesion\?\.abierta \? \(/;
const replacement = `{Boolean(dashboardData?.sesion && !dashboardData.sesion.fecha_cierre) ? (`;

content = content.replace(regex, replacement);

fs.writeFileSync('desktop-app/src/AdminModule.jsx', content, 'utf8');
console.log('Patched AdminModule UI');
