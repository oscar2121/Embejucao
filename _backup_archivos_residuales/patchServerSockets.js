const fs = require('fs');

const serverFile = 'server.js';
let content = fs.readFileSync(serverFile, 'utf8');

// 1. Add uuid to gastos if it doesn't exist.
const alterTableGastos = `
  db.run(\`
    CREATE TABLE IF NOT EXISTS gastos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      descripcion TEXT,
      categoria TEXT,
      valor REAL,
      fecha TEXT,
      sesion_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  \`, (err) => {
    // Migration: Add usuario column to existing table
    db.run(\`ALTER TABLE gastos ADD COLUMN usuario TEXT\`, (errAlter) => {
      // Ignorar error si la columna ya existe
    });
    // Migration: Add uuid column for idempotency
    db.run(\`ALTER TABLE gastos ADD COLUMN uuid TEXT UNIQUE\`, (errAlter) => {
      // Ignorar error
    });
  });
`;

content = content.replace(/db\.run\(`\s*CREATE TABLE IF NOT EXISTS gastos[\s\S]*?\}\);\s*\}\);/m, alterTableGastos.trim());

// 2. Fix POST /api/pedidos idempotency
const postPedidosFind = `  db.run(
    \`INSERT INTO pedidos (uuid, mesa, hora, items, fecha, synced, mesero_id) 
     VALUES (?, ?, ?, ?, ?, 1, ?)\`,`;

const postPedidosReplace = `  db.run(
    \`INSERT OR IGNORE INTO pedidos (uuid, mesa, hora, items, fecha, synced, mesero_id) 
     VALUES (?, ?, ?, ?, ?, 1, ?)\`,`;

content = content.replace(postPedidosFind, postPedidosReplace);

// 3. Fix POST /api/gastos idempotency
const postGastosFind = `app.post('/api/gastos', (req, res) => {
  const { descripcion, categoria, valor, sesion_id, usuario } = req.body;
  const fecha = new Date().toISOString().split('T')[0];
  
  db.run(
    \`INSERT INTO gastos (descripcion, categoria, valor, fecha, sesion_id, usuario) VALUES (?, ?, ?, ?, ?, ?)\`,
    [descripcion, categoria, valor, fecha, sesion_id || null, usuario || 'Admin'],`;

const postGastosReplace = `app.post('/api/gastos', (req, res) => {
  const { descripcion, categoria, valor, sesion_id, usuario, uuid } = req.body;
  const fecha = new Date().toISOString().split('T')[0];
  const gastoUuid = uuid || 'gasto_' + Date.now() + '_' + Math.random();
  
  db.run(
    \`INSERT OR IGNORE INTO gastos (descripcion, categoria, valor, fecha, sesion_id, usuario, uuid) VALUES (?, ?, ?, ?, ?, ?, ?)\`,
    [descripcion, categoria, valor, fecha, sesion_id || null, usuario || 'Admin', gastoUuid],`;

content = content.replace(postGastosFind, postGastosReplace);

// 4. Add socket.on('crear_pedido') and socket.on('registrar_gasto')
const socketHandlersFind = `    socket.on('disconnect', () => {
      console.log('Cliente desconectado:', socket.id);
    });
  });`;

const socketHandlersReplace = `    socket.on('crear_pedido', (data) => {
      const { uuid, mesa, hora, items, fecha, usuario } = data;
      if (!uuid || !mesa) return;
      
      db.run(
        \`INSERT OR IGNORE INTO pedidos (uuid, mesa, hora, items, fecha, synced, mesero_id) VALUES (?, ?, ?, ?, ?, 1, ?)\`,
        [uuid, mesa, hora, JSON.stringify(items), fecha || new Date().toISOString().split('T')[0], usuario || 'Mesero'],
        function(err) {
          if (err) return console.error('Error insertando pedido por socket:', err);
          if (this.changes > 0) {
            console.log('Pedido insertado por Socket (Idempotente):', uuid);
            io.emit('pedido_recibido_cocina', {
              id: this.lastID,
              uuid, mesa, hora, items, mesero_id: usuario || 'Mesero', estado: 'pendiente'
            });
          }
        }
      );
    });

    socket.on('registrar_gasto', (data) => {
      const { descripcion, categoria, valor, sesion_id, usuario, uuid } = data;
      const fecha = new Date().toISOString().split('T')[0];
      const gastoUuid = uuid || 'gasto_' + Date.now();

      db.run(
        \`INSERT OR IGNORE INTO gastos (descripcion, categoria, valor, fecha, sesion_id, usuario, uuid) VALUES (?, ?, ?, ?, ?, ?, ?)\`,
        [descripcion, categoria, valor, fecha, sesion_id || null, usuario || 'Admin', gastoUuid],
        function(err) {
          if (err) return console.error('Error insertando gasto por socket:', err);
          if (this.changes > 0) {
            console.log('Gasto insertado por Socket (Idempotente):', gastoUuid);
            io.emit('gasto_registrado_servidor', data);
          }
        }
      );
    });

    socket.on('disconnect', () => {
      console.log('Cliente desconectado:', socket.id);
    });
  });`;

content = content.replace(socketHandlersFind, socketHandlersReplace);

fs.writeFileSync(serverFile, content, 'utf8');
console.log('server.js patched successfully');
