const fs = require('fs');

let content = fs.readFileSync('desktop-app/src/useSocket.js', 'utf8');

const regex = /socketRef\.current\.on\('pedidos:lista', \(pedidosActivos\) => \{\s*setPedidos\(pedidosActivos \|\| \[\]\);\s*\}\);/;

const replacement = `socketRef.current.on('pedidos:lista', (data) => {
      setPedidos(Array.isArray(data) ? data : []);
    });

    socketRef.current.on('sync_comandas', (data) => {
      setPedidos(Array.isArray(data) ? data : []);
    });`;

content = content.replace(regex, replacement);
fs.writeFileSync('desktop-app/src/useSocket.js', content, 'utf8');
console.log('Patched useSocket.js with sync_comandas');
