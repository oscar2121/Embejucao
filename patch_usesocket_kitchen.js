const fs = require('fs');

let content = fs.readFileSync('desktop-app/src/useSocket.js', 'utf8');

const regex = /socketRef\.current\.on\('caja:estado', \(data\) => \{\s*setSesionActiva\(data\.turno \|\| null\);\s*\}\);/;

const replacement = `socketRef.current.on('caja:estado', (data) => {
      setSesionActiva(data.turno || null);
    });

    socketRef.current.on('pedidos:lista', (pedidosActivos) => {
      setPedidos(pedidosActivos || []);
    });`;

content = content.replace(regex, replacement);

fs.writeFileSync('desktop-app/src/useSocket.js', content, 'utf8');
console.log('Patched useSocket for kitchen sync');
