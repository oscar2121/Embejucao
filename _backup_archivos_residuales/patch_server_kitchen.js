const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

const regex = /const io = new Server\(server, \{\s*cors: \{\s*origin: "\*",\s*methods: \["GET", "POST", "PUT", "DELETE"\]\s*\}\s*\}\);/;

const replacement = `const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const emitirPedidosActivos = (destino) => {
  db.all("SELECT * FROM pedidos WHERE estado IN ('pendiente', 'en_cocina', 'listo') ORDER BY id ASC", [], (err, filas) => {
    if (err) {
      console.error('Error obteniendo pedidos activos:', err);
      return;
    }
    const pedidosFormateados = filas.map(p => {
      try {
        if (typeof p.items === 'string') p.items = JSON.parse(p.items);
      } catch(e) {}
      return p;
    });
    destino.emit('pedidos:lista', pedidosFormateados);
  });
};
`;

content = content.replace(regex, replacement);

const regex2 = /io\.on\('connection', \(socket\) => \{\s*console\.log\(`🔌 Dispositivo conectado: \$\{socket\.id\}`\);/;
const replacement2 = `io.on('connection', (socket) => {
  console.log(\`🔌 Dispositivo conectado: \${socket.id}\`);
  emitirPedidosActivos(socket);`;

content = content.replace(regex2, replacement2);

const regex3 = /io\.emit\('nuevo_pedido', pedidoNormalizado\);/g;
const replacement3 = `io.emit('nuevo_pedido', pedidoNormalizado);\n          emitirPedidosActivos(io);`;
content = content.replace(regex3, replacement3);

const regex4 = /io\.emit\('pedido_estado_cambiado', \{ uuid, items, nuevoEstado \}\);/g;
const replacement4 = `io.emit('pedido_estado_cambiado', { uuid, items, nuevoEstado });\n        emitirPedidosActivos(io);`;
content = content.replace(regex4, replacement4);

const regex5 = /io\.emit\('pedido_estado_cambiado', \{ uuid, items, nuevoEstado: estadoActual \}\);/g;
const replacement5 = `io.emit('pedido_estado_cambiado', { uuid, items, nuevoEstado: estadoActual });\n        emitirPedidosActivos(io);`;
content = content.replace(regex5, replacement5);

fs.writeFileSync('server.js', content, 'utf8');
console.log('Patched server.js for kitchen sync');
