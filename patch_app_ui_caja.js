const fs = require('fs');

let content = fs.readFileSync('App.js', 'utf8');

const regex = /\{dashboardData\?\.sesion\?\.abierta \? \(/;
const replacement = `{Boolean(dashboardData?.sesion && !dashboardData.sesion.fecha_cierre) ? (`;

content = content.replace(regex, replacement);

fs.writeFileSync('App.js', content, 'utf8');
console.log('Patched App.js UI');
