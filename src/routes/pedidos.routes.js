const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { logAuditoria } = require('../utils/helpers');
const { getIO, broadcastComandasActivas, emitirSincronizacionCompleta } = require('../utils/socket');

// ─── HANDLER PRINCIPAL DE CREACIÓN DE PEDIDOS ───
const recibirPedidoHandler = async (req, res) => {
  const io = req.io || getIO();
  try {
    const b = req.body || {};
    const uuid = b.uuid || b.id || `ped_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const mesa = String(b.mesa || b.mesa_id || '1');
    const tipo = b.tipo || 'mesa';
    const total = Number(b.total || 0) || 0;
    const notas = b.notas || b.observaciones || '';
    const itemsData = typeof b.items === 'string' ? b.items : JSON.stringify(b.items || b.productos || []);
    const fecha = new Date().toISOString();

    const runQuery = (query, params) => new Promise((resolve, reject) => {
      db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    // Bloqueo en Backend: Verificar si ya existe un pedido activo para esa misma mesa
    const esLlevar = String(tipo).toLowerCase() === 'llevar' || 
                     String(tipo).toLowerCase() === 'para llevar' || 
                     mesa.toLowerCase().startsWith('para') || 
                     mesa.toLowerCase() === 'llevar';

    if (!esLlevar && mesa) {
      const mesaVariante = mesa.startsWith('Mesa ') ? mesa.replace('Mesa ', '').trim() : `Mesa ${mesa}`;
      const pedidoExistente = await new Promise((resolve, reject) => {
        db.get(
          `SELECT id, uuid FROM pedidos 
           WHERE (mesa = ? OR mesa = ?) 
             AND LOWER(estado) NOT IN ('cobrado', 'cancelado', 'archivado')
             AND (uuid IS NULL OR uuid != ?)
           LIMIT 1`,
          [mesa, mesaVariante, uuid],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (pedidoExistente) {
        return res.status(409).json({ 
          error: "La mesa ya tiene un pedido activo. Debe agregar ítems a la orden existente o liberarla." 
        });
      }
    }

    // Inserción parametrizada limpia
    await runQuery(
      `INSERT OR REPLACE INTO pedidos (uuid, mesa, tipo, items, total, notas, estado, pagado, fecha)
       VALUES (?, ?, ?, ?, ?, ?, 'pendiente', 0, ?)`,
      [uuid, mesa, tipo, itemsData, total, notas, fecha]
    );

    // Notificar a Socket.io para que cocina y caja lo vean en tiempo real
    if (io) {
      const pedidoNormalizado = {
        uuid, mesa, tipo, total, notas, estado: 'pendiente', pagado: 0, fecha,
        items: JSON.parse(itemsData)
      };
      io.emit('nuevo_pedido', pedidoNormalizado);
      broadcastComandasActivas();
      io.emit('actualizar_pedidos');
    }

    return res.status(200).json({ success: true, uuid });
  } catch (err) {
    console.error('--- ERROR REAL SQL AL GUARDAR PEDIDO ---:', err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
};

// Rutas de recepción de pedido
router.post('/pedidos', recibirPedidoHandler);

// GET /api/pedidos
router.get('/pedidos', (req, res) => {
  const { estado } = req.query;
  let sql = "SELECT * FROM pedidos WHERE LOWER(estado) NOT IN ('cobrado', 'cancelado', 'archivado') AND (pagado = 0 OR pagado IS NULL)";
  const params = [];
  if (estado) {
    sql += " AND LOWER(estado) = ?";
    params.push(String(estado).toLowerCase().trim());
  }
  sql += " ORDER BY id DESC";

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const respuesta = rows.map(r => ({ ...r, items: typeof r.items === 'string' ? JSON.parse(r.items || '[]') : (r.items || []) }));
    res.json(respuesta);
  });
});

// GET /api/pedidos/pendientes
router.get('/pedidos/pendientes', (req, res) => {
  db.all("SELECT * FROM pedidos WHERE LOWER(estado) NOT IN ('cobrado', 'cancelado', 'archivado') AND (pagado = 0 OR pagado IS NULL) ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const respuesta = rows.map(r => ({ ...r, items: typeof r.items === 'string' ? JSON.parse(r.items || '[]') : (r.items || []) }));
    res.json(respuesta);
  });
});

// GET /api/pedidos/date/:fecha
router.get('/pedidos/date/:fecha', (req, res) => {
  db.all(
    `SELECT * FROM pedidos WHERE LOWER(estado) NOT IN ('cobrado', 'cancelado', 'archivado') AND (pagado = 0 OR pagado IS NULL) ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Error fetching pedidos:', err);
        return res.status(400).json({ error: err.message });
      }
      
      const pedidos = rows.map(p => ({
        ...p,
        items: typeof p.items === 'string' ? JSON.parse(p.items || '[]') : (p.items || [])
      }));
      
      res.json({ pedidos });
    }
  );
});

// POST /api/pedidos/estado - Actualizar estado general de un pedido y sus items en batch (Cocina)
router.post('/pedidos/estado', (req, res) => {
  const io = req.io || getIO();
  const { uuid, items, nuevoEstado } = req.body;
  
  if (!uuid || !items || !nuevoEstado) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos (uuid, items, nuevoEstado)' });
  }

  db.get(`SELECT * FROM pedidos WHERE uuid = ? OR id = ?`, [uuid, uuid], (errGet, row) => {
    if (errGet || !row) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    db.run(
      `UPDATE pedidos SET items = ?, estado = ? WHERE id = ?`,
      [JSON.stringify(items), nuevoEstado, row.id],
      (err) => {
        if (err) {
          console.error('Error actualizando estado del pedido en batch:', err);
          return res.status(500).json({ error: err.message });
        }

        if (io) {
          io.emit('pedido_estado_cambiado', { uuid: row.uuid, id: row.id, items, nuevoEstado });
          io.emit('pedidos_actualizados');
          io.emit('actualizar_pedidos');
        }
        broadcastComandasActivas();

        if (nuevoEstado === 'cuenta' || nuevoEstado === 'listo') {
          if (io) io.emit('pedido_listo_para_entregar', { uuid: row.uuid });
        }

        res.json({ success: true, items, estado: nuevoEstado });
      }
    );
  });
});

// PUT /api/pedidos/:uuid/item/:itemIdx - Actualizar estado de item individual
router.put('/pedidos/:uuid/item/:itemIdx', (req, res) => {
  const io = req.io || getIO();
  const { uuid, itemIdx } = req.params;
  const { nuevoEstado } = req.body;
  
  db.get(`SELECT * FROM pedidos WHERE uuid = ? OR id = ?`, [uuid, uuid], (err, row) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    
    let items = [];
    try {
      items = JSON.parse(row.items || '[]');
    } catch (e) {
      items = [];
    }
    const idx = parseInt(itemIdx, 10);
    if (items[idx]) {
      items[idx].estado = nuevoEstado;
    }

    // Conservar estado 'activo' o 'en_cocina' (NUNCA cambiar a completado/cerrado/cobrado aquí)
    let nuevoEstadoPedido = row.estado || 'en_cocina';
    if (nuevoEstadoPedido === 'pendiente') {
      nuevoEstadoPedido = 'en_cocina';
    }
    if (['cobrado', 'cancelado', 'archivado', 'completado'].includes(String(nuevoEstadoPedido).toLowerCase())) {
      nuevoEstadoPedido = row.estado;
    }
    
    db.run(
      `UPDATE pedidos SET items = ?, estado = ? WHERE id = ?`,
      [JSON.stringify(items), nuevoEstadoPedido, row.id],
      (errUpdate) => {
        if (errUpdate) return res.status(400).json({ error: errUpdate.message });

        // Emitir inmediatamente a todos los clientes
        if (io) {
          io.emit('pedido_estado_cambiado', { uuid: row.uuid, id: row.id, items, nuevoEstado: nuevoEstadoPedido });
          io.emit('cocina_item_cambiado', { pedidoId: row.uuid, id: row.id, itemIndex: idx, nuevoEstado });
          io.emit('pedidos_actualizados');
          io.emit('actualizar_pedidos');
        }
        broadcastComandasActivas();

        if (nuevoEstado === 'listo' && io) {
          const meseroId = row.mesero_id || 'Mesero';
          const nombrePlato = items[idx]?.nombre || 'Plato';
          io.to(`sala_mesero_${meseroId}`).emit('pedido_listo_mesero', {
            uuid: row.uuid,
            mesa: row.mesa,
            plato: nombrePlato,
            mensaje: `¡El plato "${nombrePlato}" de la mesa ${row.mesa} está listo!`
          });
          console.log(`📤 Alerta a sala_mesero_${meseroId} para Mesa ${row.mesa}: ${nombrePlato}`);
        }

        res.json({ success: true, items, estado: nuevoEstadoPedido });
      }
    );
  });
});

// DELETE /api/pedidos/:uuid - Completar/Cobrar pedido (cuando mesa se factura y se completa)
router.delete('/pedidos/:uuid', (req, res) => {
  const io = req.io || getIO();
  const uuid = req.params.uuid;
  db.get(`SELECT id, mesa FROM pedidos WHERE uuid = ? OR id = ?`, [uuid, uuid], (err, row) => {
    if (err || !row) return res.status(400).json({ error: 'Pedido no encontrado' });
    
    // 1. Cerrar el pedido obligatoriamente con estado 'cobrado'
    db.run(
      `UPDATE pedidos SET estado = 'cobrado', pagado = 1 WHERE uuid = ? OR id = ?`,
      [uuid, uuid],
      (errUpdate) => {
        if (errUpdate) return res.status(400).json({ error: errUpdate.message });
        if (io) {
          io.emit('pedido_completado_servidor', { uuid });
          io.emit('pedidos_actualizados');
        }
        
        const targetMesa = row.mesa || '';
        const mesasALiberar = String(targetMesa).split(',').map(m => m.trim().replace(/\D/g, '')).filter(Boolean);
        
        if (mesasALiberar.length > 0) {
          let updates = 0;
          mesasALiberar.forEach(mesaNum => {
            // 2. Liberar la mesa
            db.run(`UPDATE mesas SET estado = 'libre' WHERE id = ? OR num = ?`, [mesaNum, mesaNum], () => {
              updates++;
              if (updates === mesasALiberar.length) {
                db.all('SELECT * FROM mesas', (errMesas, filasMesas) => {
                  if (!errMesas && io) io.emit('mesas_actualizadas', filasMesas);
                  emitirSincronizacionCompleta();
                });
              }
            });
          });
        } else {
          emitirSincronizacionCompleta();
        }
        res.json({ success: true });
      }
    );
  });
});

// POST /api/pedidos/:uuid/cancelar - Cancelar pedido post-cocina
router.post('/pedidos/:uuid/cancelar', (req, res) => {
  const io = req.io || getIO();
  const { uuid } = req.params;
  const { motivo, usuario } = req.body;
  const ahora = new Date().toISOString();

  db.get(`SELECT * FROM pedidos WHERE uuid = ?`, [uuid], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (row.estado === 'completado') return res.status(400).json({ error: 'Este pedido ya fue facturado y no puede eliminarse' });

    // Insertar en cancelaciones
    db.run(
      `INSERT INTO pedidos_cancelados (fecha, mesa, items, motivo, usuario, estado) VALUES (?, ?, ?, ?, ?, 'cancelado')`,
      [ahora, row.mesa, row.items, motivo || 'Sin motivo', usuario || 'Desconocido'],
      (errInsert) => {
        if (errInsert) return res.status(400).json({ error: errInsert.message });

        // Cambiar estado a cancelado
        db.run(
          `UPDATE pedidos SET estado = 'cancelado' WHERE uuid = ?`,
          [uuid],
          (errUpdate) => {
            if (errUpdate) return res.status(400).json({ error: errUpdate.message });

            // Liberar mesa física
            const mesaNum = Number(row.mesa);
            if (!isNaN(mesaNum)) {
              db.run(`UPDATE mesas SET estado = 'libre' WHERE num = ?`, [mesaNum]);
            }

            logAuditoria(usuario, 'pedido_cancelado', `Pedido cancelado para ${row.mesa}. Motivo: ${motivo}`);
            if (io) io.emit('pedido_cancelado_servidor', { uuid });
            res.json({ success: true });
          }
        );
      }
    );
  });
});

// GET /api/pedidos-cancelados - Historial de Cancelados
router.get('/pedidos-cancelados', (req, res) => {
  db.all(`SELECT * FROM pedidos_cancelados ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      cancelados: rows.map(r => ({
        ...r,
        items: JSON.parse(r.items)
      }))
    });
  });
});

// PUT /api/pedidos/:uuid - Edición de pedido completo por el mesero
router.put('/pedidos/:uuid', (req, res) => {
  const io = req.io || getIO();
  const { uuid } = req.params;
  const { items, usuario } = req.body;

  db.get(`SELECT mesa, estado FROM pedidos WHERE uuid = ?`, [uuid], (errGet, pRow) => {
    const mesaLabel = pRow ? pRow.mesa : 'desconocida';
    const estadoActual = pRow ? pRow.estado : 'activo';
    db.run(
      `UPDATE pedidos SET items = ? WHERE uuid = ?`,
      [JSON.stringify(items), uuid],
      function (err) {
        if (err) return res.status(400).json({ error: err.message });
        logAuditoria(usuario, 'pedido_editado', `Pedido editado para mesa ${mesaLabel} (${items.length} productos en total)`);
        
        if (io) {
          io.emit('pedido_estado_cambiado', { uuid, items, nuevoEstado: estadoActual });
          io.emit('pedidos_actualizados');
          io.emit('actualizar_pedidos');
        }
        broadcastComandasActivas();
        
        res.json({ success: true });
      }
    );
  });
});

module.exports = router;
