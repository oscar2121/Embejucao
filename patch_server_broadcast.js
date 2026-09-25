const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

const regexEmit = /const emitirPedidosActivos = \(destino\) => \{[\s\S]*?destino\.emit\('pedidos:lista', pedidosFormateados\);\s*\}\);\s*\};/;

const replacementEmit = `const broadcastComandasActivas = () => {
  db.all("SELECT * FROM pedidos WHERE estado IN ('pendiente', 'en_cocina', 'preparando', 'listo') ORDER BY id ASC", [], (err, filas) => {
    if (err) {
      console.error('Error obteniendo pedidos activos:', err);
      return;
    }
    const parseadas = filas.map(c => ({
      ...c,
      items: typeof c.items === 'string' ? JSON.parse(c.items) : (c.items || [])
    }));
    
    // EMISIÓN GLOBAL A TODOS LOS CLIENTES CONECTADOS
    io.emit('pedidos:lista', parseadas);
    io.emit('sync_comandas', parseadas);
  });
};`;

content = content.replace(regexEmit, replacementEmit);

// Cambiar todas las llamadas de emitirPedidosActivos(io) o emitirPedidosActivos(socket) a broadcastComandasActivas()
content = content.replace(/emitirPedidosActivos\(io\);/g, 'broadcastComandasActivas();');
content = content.replace(/emitirPedidosActivos\(socket\);/g, 'broadcastComandasActivas();');

fs.writeFileSync('server.js', content, 'utf8');
console.log('Patched server.js with broadcastComandasActivas');
