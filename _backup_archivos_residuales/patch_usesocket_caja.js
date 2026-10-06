const fs = require('fs');

let content = fs.readFileSync('desktop-app/src/useSocket.js', 'utf8');

const regex = /socketRef\.current\.on\('caja_actualizada', \(sesion\) => \{\s*setSesionActiva\(sesion\);\s*\}\);/;

const replacement = `socketRef.current.on('caja_actualizada', (sesion) => {
      setSesionActiva(sesion);
    });

    socketRef.current.on('caja:estado', (data) => {
      setSesionActiva(data.turno || null);
    });`;

content = content.replace(regex, replacement);
fs.writeFileSync('desktop-app/src/useSocket.js', content, 'utf8');
console.log('Patched useSocket.js');
