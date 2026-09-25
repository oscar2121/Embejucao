const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8').replace(/\r\n/g, '\n');

// The broken section from line ~855 to ~911 is a merged POST /estado + orphaned DELETE code
// We need to replace everything from the start of POST /api/pedidos/estado
// to the closing }); just before the GET /api/pedidos/fiado

const BAD_BLOCK_START = `// POST - Actualizar estado general de un pedido y sus items en batch (Cocina)
app.post('/api/pedidos/estado', (req, res) => {`;

const BAD_BLOCK_END = `});

// GET - Obtener pedidos fiados`;

const startIdx = content.indexOf(BAD_BLOCK_START);
const endIdx = content.indexOf(BAD_BLOCK_END, startIdx);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not locate the broken block. startIdx:', startIdx, 'endIdx:', endIdx);
  process.exit(1);
}

const GOOD_BLOCK = `// POST - Actualizar estado general de un pedido y sus items en batch (Cocina)
app.post('/api/pedidos/estado', (req, res) => {
  const { uuid, items, nuevoEstado } = req.body;
  
  if (!uuid || !items || !nuevoEstado) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos (uuid, items, nuevoEstado)' });
  }

  db.run(
    \`UPDATE pedidos SET items = ?, estado = ? WHERE uuid = ?\`,
    [JSON.stringify(items), nuevoEstado, uuid],
    (err) => {
      if (err) {
        console.error('Error actualizando estado del pedido en batch:', err);
        return res.status(500).json({ error: err.message });
      }

      io.emit('pedido_estado_cambiado', { uuid, items, nuevoEstado });
      broadcastComandasActivas();

      if (nuevoEstado === 'cuenta') {
        io.emit('pedido_listo_para_entregar', { uuid });
      }

      res.json({ success: true, items, estado: nuevoEstado });
    }
  );
});

// PUT - Actualizar estado de item individual (calcula estado del pedido colectivamente)
app.put('/api/pedidos/:uuid/item/:itemIdx', (req, res) => {
  const { uuid, itemIdx } = req.params;
  const { nuevoEstado } = req.body;
  
  db.get(\`SELECT * FROM pedidos WHERE uuid = ?\`, [uuid], (err, row) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    
    const items = JSON.parse(row.items || '[]');
    items[itemIdx].estado = nuevoEstado;

    // Calcular estado global del pedido según el conjunto de ítems
    const todosListos = items.every(item => item.estado === 'listo');
    const algunPreparando = items.some(item => item.estado === 'preparando' || item.estado === 'listo');

    let nuevoEstadoPedido = 'pendiente';
    if (todosListos) {
      nuevoEstadoPedido = 'listo';       // Solo aquí el pedido se considera terminado
    } else if (algunPreparando) {
      nuevoEstadoPedido = 'en_cocina';   // Sigue visible mientras haya ítems sin terminar
    }
    
    db.run(
      \`UPDATE pedidos SET items = ?, estado = ? WHERE uuid = ?\`,
      [JSON.stringify(items), nuevoEstadoPedido, uuid],
      (errUpdate) => {
        if (errUpdate) return res.status(400).json({ error: errUpdate.message });

        io.emit('pedido_estado_cambiado', { uuid, items, nuevoEstado: nuevoEstadoPedido });
        broadcastComandasActivas();

        if (nuevoEstado === 'listo') {
          const meseroId = row.mesero_id || 'Mesero';
          const nombrePlato = items[itemIdx]?.nombre || 'Plato';
          io.to(\`sala_mesero_\${meseroId}\`).emit('pedido_listo_mesero', {
            uuid,
            mesa: row.mesa,
            plato: nombrePlato,
            mensaje: \`¡El plato "\${nombrePlato}" de la mesa \${row.mesa} está listo!\`
          });
          console.log(\`📤 Alerta a sala_mesero_\${meseroId} para Mesa \${row.mesa}: \${nombrePlato}\`);
        }

        res.json({ success: true, items, estado: nuevoEstadoPedido });
      }
    );
  });
});

// DELETE - Completar pedido (cuando mesa se factura y se completa)
app.delete('/api/pedidos/:uuid', (req, res) => {
  const uuid = req.params.uuid;
  db.get(\`SELECT mesa FROM pedidos WHERE uuid = ?\`, [uuid], (err, row) => {
    if (err || !row) return res.status(400).json({ error: 'Pedido no encontrado' });
    
    db.run(
      \`UPDATE pedidos SET estado = 'completado', pagado = 1 WHERE uuid = ?\`,
      [uuid],
      (errUpdate) => {
        if (errUpdate) return res.status(400).json({ error: errUpdate.message });
        io.emit('pedido_completado_servidor', { uuid });
        
        const targetMesa = row.mesa || '';
        const mesasALiberar = String(targetMesa).split(',').map(m => Number(m.trim())).filter(m => !isNaN(m));
        
        if (mesasALiberar.length > 0) {
          let updates = 0;
          mesasALiberar.forEach(mesaNum => {
            db.run(\`UPDATE mesas SET estado = 'libre' WHERE num = ?\`, [mesaNum], () => {
              updates++;
              if (updates === mesasALiberar.length) {
                db.all('SELECT * FROM mesas', (errMesas, filasMesas) => {
                  if (!errMesas) io.emit('mesas_actualizadas', filasMesas);
                });
              }
            });
          });
        }
        res.json({ success: true });
      }
    );
  });
});`;

const fixed = content.slice(0, startIdx) + GOOD_BLOCK + content.slice(endIdx + BAD_BLOCK_END.length);

fs.writeFileSync('server.js', fixed.replace(/\n/g, '\r\n'), 'utf8');
console.log('server.js repaired. Lines:', fixed.split('\n').length);
