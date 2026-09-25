const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

const regex = /io\.on\('connection', \(socket\) => \{\s*console\.log\(`🔌 Dispositivo conectado: \$\{socket\.id\}`\);/;

const replacement = `io.on('connection', (socket) => {
  console.log(\`🔌 Dispositivo conectado: \${socket.id}\`);
  const emitirEstadoCaja = () => {
    db.get('SELECT * FROM caja_sesiones WHERE fecha_cierre IS NULL ORDER BY id DESC LIMIT 1', [], (err, turnoActivo) => {
      if (!err) socket.emit('caja:estado', { abierta: Boolean(turnoActivo), turno: turnoActivo || null });
    });
  };
  socket.on('sync_datos', emitirEstadoCaja);
  emitirEstadoCaja();`;

content = content.replace(regex, replacement);
fs.writeFileSync('server.js', content, 'utf8');
console.log('Patched server.js');
