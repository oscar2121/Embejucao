const express = require('express');
const router = express.Router();
const { db, dbGet, dbAll } = require('../database/db');
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
    let total = Number(b.total || 0) || 0;
    if (total <= 0) {
      try {
        const rawIt = typeof b.items === 'string' ? JSON.parse(b.items || '[]') : (b.items || b.productos || []);
        if (Array.isArray(rawIt) && rawIt.length > 0) {
          total = rawIt.reduce((acc, it) => {
            const p = Number(it.precio || it.precio_unitario || it.subtotal || 0);
            const c = Number(it.cantidad || 1);
            return acc + (p * c);
          }, 0);
        }
      } catch (eTot) {}
    }
    const notas = b.notas || b.observaciones || '';
    const itemsData = typeof b.items === 'string' ? b.items : JSON.stringify(b.items || b.productos || []);
    const fecha = new Date().toISOString();

    const runQuery = (query, params) => new Promise((resolve, reject) => {
      db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    // Manejo de Comanda Abierta: Verificar si ya existe un pedido activo para esa misma mesa
    const esLlevar = String(tipo).toLowerCase() === 'llevar' || 
                     String(tipo).toLowerCase() === 'para llevar' || 
                     mesa.toLowerCase().startsWith('para') || 
                     mesa.toLowerCase() === 'llevar';

    if (!esLlevar && mesa) {
      const mesaVariante = mesa.startsWith('Mesa ') ? mesa.replace('Mesa ', '').trim() : `Mesa ${mesa}`;
      const mesaNumOnly = mesa.replace(/\D/g, '');
      const pedidoExistente = await new Promise((resolve, reject) => {
        db.get(
          `SELECT * FROM pedidos 
           WHERE (mesa = ? OR mesa = ? OR mesa = ?) 
             AND LOWER(estado) NOT IN ('cobrado', 'cancelado', 'archivado', 'fiado', 'credito')
             AND deudor IS NULL
             AND (uuid IS NULL OR uuid != ?)
           LIMIT 1`,
          [mesa, mesaVariante, mesaNumOnly || mesa, uuid],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (pedidoExistente) {
        // En lugar de fallar con error 409 crudo, agregar los ítems al pedido abierto existente de la mesa
        let itemsExistentes = [];
        try {
          itemsExistentes = typeof pedidoExistente.items === 'string' ? JSON.parse(pedidoExistente.items || '[]') : (pedidoExistente.items || []);
        } catch (e) {
          itemsExistentes = [];
        }

        let nuevosItems = [];
        try {
          nuevosItems = typeof itemsData === 'string' ? JSON.parse(itemsData || '[]') : (itemsData || []);
        } catch (e) {
          nuevosItems = [];
        }

        const itemsCombinados = [...itemsExistentes, ...nuevosItems];
        const nuevoTotalCalculado = itemsCombinados.reduce((sum, it) => {
          const p = Number(it.precio || it.precio_unitario || 0);
          const c = Number(it.cantidad || 1);
          return sum + (p * c);
        }, 0);

        const totalFinal = nuevoTotalCalculado > 0 ? nuevoTotalCalculado : (Number(pedidoExistente.total || 0) + total);

        await runQuery(
          `UPDATE pedidos SET items = ?, total = ?, fecha = ? WHERE id = ?`,
          [JSON.stringify(itemsCombinados), totalFinal, fecha, pedidoExistente.id]
        );

        // Insertar en detalles_pedidos
        try {
          if (Array.isArray(nuevosItems) && nuevosItems.length > 0) {
            db.all('SELECT id, nombre FROM productos', [], (errPr, prods) => {
              const prodMap = new Map();
              (prods || []).forEach(p => prodMap.set(p.nombre.toLowerCase().trim(), p.id));
              
              const stmtDP = db.prepare('INSERT INTO detalles_pedidos (pedido_id, producto_id, cantidad, precio_unitario, subtotal, nombre) VALUES (?, ?, ?, ?, ?, ?)');
              nuevosItems.forEach(it => {
                let pId = it.producto_id || it.id;
                const itNom = (it.nombre || '').toLowerCase().trim();
                if (!pId || isNaN(pId)) {
                  for (const [nom, idMatch] of prodMap.entries()) {
                    if (itNom.startsWith(nom) || nom.startsWith(itNom)) {
                      pId = idMatch;
                      break;
                    }
                  }
                }
                const cant = Number(it.cantidad || 1);
                const precio = Number(it.precio || it.precio_unitario || 0);
                const subtotal = Number(it.subtotal || (cant * precio));
                stmtDP.run(pedidoExistente.id, pId || null, cant, precio, subtotal, it.nombre || '');
              });
              stmtDP.finalize();
            });
          }
        } catch (eDet) {}

        // Marcar la mesa como ocupada automáticamente al fusionar
        const mesaNumStr = String(mesa).replace(/\D/g, '');
        const mesaVal = String(mesa).trim();
        if (mesaVal) {
          db.run(
            `UPDATE mesas SET estado = 'ocupada' WHERE num = ? OR id = ? OR num = ? OR id = ?`,
            [mesaVal, mesaVal, mesaNumStr || mesaVal, mesaNumStr || mesaVal],
            (err) => {
              if (err) console.error("Error al actualizar la mesa a ocupada en fusion:", err);
              db.all('SELECT * FROM mesas ORDER BY num ASC', [], (errM, rowsM) => {
                if (io) {
                  io.emit('mesas_actualizadas', rowsM || []);
                  io.emit('caja_actualizada');
                  io.emit('pedidos_actualizados');
                }
              });
            }
          );
        }

        if (io) {
          const pedidoActualizadoNormalizado = {
            ...pedidoExistente,
            items: itemsCombinados,
            total: totalFinal,
            fecha
          };
          io.emit('pedido_estado_cambiado', { uuid: pedidoExistente.uuid, id: pedidoExistente.id, items: itemsCombinados, nuevoEstado: pedidoExistente.estado });
          io.emit('nuevo_pedido', pedidoActualizadoNormalizado);
          io.emit('caja_actualizada');
          io.emit('pedidos_actualizados');
          io.emit('actualizar_pedidos');
          broadcastComandasActivas();
        }

        return res.json({
          success: true,
          message: "Ítems agregados a la orden abierta existente en la mesa.",
          pedido_id: pedidoExistente.id,
          uuid: pedidoExistente.uuid
        });
      }
    }

    // Inserción parametrizada limpia con estado activo
    const estadoPedido = b.estado || 'activo';
    await runQuery(
      `INSERT OR REPLACE INTO pedidos (uuid, mesa, tipo, items, total, notas, estado, pagado, fecha)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [uuid, mesa, tipo, itemsData, total, notas, estadoPedido, fecha]
    );

    // Marcar la mesa como ocupada automáticamente para nuevo pedido
    const targetMesa = req.body.mesa || b.mesa || mesa;
    if (!esLlevar && targetMesa) {
      const mesaNumStr = String(targetMesa).replace(/\D/g, '');
      const mesaVal = String(targetMesa).trim();
      db.run(
        `UPDATE mesas SET estado = 'ocupada' WHERE num = ? OR id = ? OR num = ? OR id = ?`,
        [mesaVal, mesaVal, mesaNumStr || mesaVal, mesaNumStr || mesaVal],
        (err) => {
          if (err) console.error("Error al actualizar la mesa a ocupada:", err);
          db.all('SELECT * FROM mesas ORDER BY num ASC', [], (errM, rowsM) => {
            if (io) {
              io.emit('mesas_actualizadas', rowsM || []);
              io.emit('caja_actualizada');
              io.emit('pedidos_actualizados');
            }
          });
        }
      );
    }

    // Sincronizar detalles_pedidos
    try {
      db.get('SELECT id FROM pedidos WHERE uuid = ?', [uuid], (errId, rowId) => {
        if (!errId && rowId && rowId.id) {
          const pedId = rowId.id;
          const parsedItems = JSON.parse(itemsData || '[]');
          if (Array.isArray(parsedItems) && parsedItems.length > 0) {
            db.all('SELECT id, nombre FROM productos', [], (errPr, prods) => {
              const prodMap = new Map();
              (prods || []).forEach(p => prodMap.set(p.nombre.toLowerCase().trim(), p.id));
              
              db.run('DELETE FROM detalles_pedidos WHERE pedido_id = ?', [pedId], () => {
                const stmtDP = db.prepare('INSERT INTO detalles_pedidos (pedido_id, producto_id, cantidad, precio_unitario, subtotal, nombre) VALUES (?, ?, ?, ?, ?, ?)');
                parsedItems.forEach(it => {
                  let pId = it.producto_id || it.id;
                  const itNom = (it.nombre || '').toLowerCase().trim();
                  if (!pId || isNaN(pId)) {
                    for (const [nom, idMatch] of prodMap.entries()) {
                      if (itNom.startsWith(nom) || nom.startsWith(itNom)) {
                        pId = idMatch;
                        break;
                      }
                    }
                  }
                  if (pId) {
                    const cant = Number(it.cantidad || 1);
                    const precio = Number(it.precio || it.precio_unitario || 0);
                    const subtotal = Number(it.subtotal || (cant * precio));
                    stmtDP.run(pedId, pId, cant, precio, subtotal, it.nombre || '');
                  }
                });
                stmtDP.finalize();
              });
            });
          }
        }
      });
    } catch (eDet) {}

    // Notificar a Socket.io para que cocina y caja lo vean en tiempo real
    if (io) {
      const pedidoNormalizado = {
        uuid, mesa, tipo, total, notas, estado: estadoPedido, pagado: 0, fecha,
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
  const { estado, mesa } = req.query;
  let sql = "SELECT * FROM pedidos WHERE LOWER(estado) NOT IN ('cobrado', 'cancelado', 'archivado', 'fiado', 'credito') AND (pagado = 0 OR pagado IS NULL)";
  const params = [];
  if (estado) {
    sql += " AND LOWER(estado) = ?";
    params.push(String(estado).toLowerCase().trim());
  }
  if (mesa) {
    const mesaNum = String(mesa).replace(/\D/g, '');
    sql += " AND (mesa = ? OR mesa = ? OR mesa = ?)";
    params.push(mesa, `Mesa ${mesa}`, mesaNum || mesa);
  }
  sql += " ORDER BY id DESC";

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const respuesta = rows.map(r => ({ ...r, items: typeof r.items === 'string' ? JSON.parse(r.items || '[]') : (r.items || []) }));
    res.json(respuesta);
  });
});

// GET /api/pedidos/mesa/:mesa - Buscar el pedido activo de una mesa específica
router.get('/pedidos/mesa/:mesa', async (req, res) => {
  try {
    const mesaNum = String(req.params.mesa).replace(/\D/g, '');
    const mesaParam = req.params.mesa;
    const pedido = await dbGet(
      `SELECT * FROM pedidos 
       WHERE (mesa = ? OR mesa = ? OR mesa = ?) 
         AND LOWER(estado) NOT IN ('cobrado', 'cancelado', 'archivado', 'fiado', 'credito') 
         AND deudor IS NULL
         AND (pagado = 0 OR pagado IS NULL) 
       ORDER BY id DESC LIMIT 1`,
      [mesaParam, `Mesa ${mesaParam}`, mesaNum || mesaParam]
    );

    if (!pedido) {
      return res.status(404).json({ ok: false, mensaje: "No hay pedido activo" });
    }

    // Obtener detalles
    const items = await dbAll(
      "SELECT * FROM detalles_pedidos WHERE pedido_id = ?",
      [pedido.id]
    );

    // Cálculo determinista del total (no depende de campos corruptos)
    const totalCalculado = items.reduce((acc, curr) => {
      const cant = Number(curr.cantidad) || 0;
      const precio = Number(curr.precio_unitario || curr.precio) || 0;
      return acc + (cant * precio);
    }, 0);

    // Contrato de salida garantizado
    return res.json({
      ok: true,
      pedido: {
        id: pedido.id,
        mesa: pedido.mesa,
        estado: pedido.estado,
        total: totalCalculado,
        items: items
      }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});


// GET /api/pedidos/pendientes
router.get('/pedidos/pendientes', (req, res) => {
  db.all("SELECT * FROM pedidos WHERE LOWER(estado) NOT IN ('cobrado', 'cancelado', 'archivado', 'fiado', 'credito') AND (pagado = 0 OR pagado IS NULL) ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const respuesta = rows.map(r => ({ ...r, items: typeof r.items === 'string' ? JSON.parse(r.items || '[]') : (r.items || []) }));
    res.json(respuesta);
  });
});

// GET /api/pedidos/date/:fecha
router.get('/pedidos/date/:fecha', (req, res) => {
  db.all(
    `SELECT * FROM pedidos WHERE LOWER(estado) NOT IN ('cobrado', 'cancelado', 'archivado', 'fiado', 'credito') AND (pagado = 0 OR pagado IS NULL) ORDER BY id DESC`,
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

// POST /api/pedidos/cobrar - Registrar cobro directo de pedido
router.post('/pedidos/cobrar', (req, res) => {
  const io = req.io || getIO();
  const { uuid, id, pedido_id, total, metodo_pago, monto_efectivo, monto_transferencia, saldo_cartera, cliente_credito, mesa } = req.body;
  const targetId = pedido_id || id || uuid;
  const targetMesa = mesa;

  let sql = 'SELECT * FROM pedidos WHERE (id = ? OR uuid = ?)';
  let params = [targetId, targetId];

  if ((!targetId || targetId === 'undefined' || targetId === 'null') && targetMesa) {
    const mesaNum = String(targetMesa).replace(/\D/g, '');
    sql = "SELECT * FROM pedidos WHERE (mesa = ? OR mesa = ? OR mesa = ?) AND LOWER(estado) NOT IN ('cobrado', 'cancelado', 'archivado', 'fiado', 'credito') ORDER BY id DESC LIMIT 1";
    params = [targetMesa, `Mesa ${targetMesa}`, mesaNum || targetMesa];
  }

  db.get(sql, params, (err, row) => {
    if (err || !row) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const pedId = row.id;
    const pedUuid = row.uuid || `ped_${pedId}`;
    const pedMesa = row.mesa || targetMesa;
    const montoTotal = Number(total || row.total || 0);

    // 1. Marcar pedido como cobrado
    db.run(
      `UPDATE pedidos SET estado = 'cobrado', pagado = 1 WHERE id = ?`,
      [pedId],
      (errUpd) => {
        if (errUpd) return res.status(500).json({ error: errUpd.message });

        // 2. Liberar mesa
        if (pedMesa) {
          const mesaNum = String(pedMesa).replace(/\D/g, '');
          if (mesaNum) {
            db.run(`UPDATE mesas SET estado = 'libre' WHERE id = ? OR num = ?`, [mesaNum, mesaNum], () => {
              db.all('SELECT * FROM mesas', (errM, rowsM) => {
                if (!errM && io) io.emit('mesas_actualizadas', rowsM);
              });
            });
          }
        }

        // 3. Registrar venta
        const ahora = new Date().toISOString();
        const metodoFinal = (metodo_pago === 'mixto' || metodo_pago === 'Mixto') ? 'Mixto' : (metodo_pago || 'Efectivo');
        
        db.run(
          `INSERT INTO ventas (fecha, tipo_origen, mesa, total, metodo_pago, deudor) VALUES (?, 'Mesa', ?, ?, ?, ?)`,
          [ahora, pedMesa ? `Mesa ${String(pedMesa).replace(/\D/g, '')}` : 'Mesa', montoTotal, metodoFinal, cliente_credito || null],
          function(errVenta) {
            const ventaId = this?.lastID;

            if (io) {
              io.emit('pedido_completado_servidor', { uuid: pedUuid, id: pedId });
              io.emit('pedidos_actualizados');
              io.emit('caja_actualizada');
              emitirSincronizacionCompleta();
            }

            res.json({
              success: true,
              pedido_id: pedId,
              uuid: pedUuid,
              venta_id: ventaId
            });
          }
        );
      }
    );
  });
});

// DELETE /api/pedidos/:uuid - Completar/Cobrar pedido (cuando mesa se factura y se completa)
router.delete('/pedidos/:uuid', (req, res) => {
  const io = req.io || getIO();
  let uuid = req.params.uuid;
  const queryId = req.query.pedido_id || req.body?.pedido_id;
  const queryMesa = req.query.mesa || req.body?.mesa;

  let sql = `SELECT id, uuid, mesa FROM pedidos WHERE uuid = ? OR id = ?`;
  let params = [uuid, uuid];

  if (!uuid || uuid === 'undefined' || uuid === 'null') {
    if (queryId && queryId !== 'undefined') {
      sql = `SELECT id, uuid, mesa FROM pedidos WHERE uuid = ? OR id = ?`;
      params = [queryId, queryId];
    } else if (queryMesa) {
      const mesaNum = String(queryMesa).replace(/\D/g, '');
      sql = `SELECT id, uuid, mesa FROM pedidos WHERE (mesa = ? OR mesa = ? OR mesa = ?) AND LOWER(estado) NOT IN ('cobrado', 'cancelado', 'archivado', 'fiado', 'credito') ORDER BY id DESC LIMIT 1`;
      params = [queryMesa, `Mesa ${queryMesa}`, mesaNum || queryMesa];
    }
  }

  db.get(sql, params, (err, row) => {
    if (err || !row) return res.status(400).json({ error: 'Pedido no encontrado' });
    
    const targetUuid = row.uuid || row.id;
    // 1. Cerrar el pedido obligatoriamente con estado 'cobrado'
    db.run(
      `UPDATE pedidos SET estado = 'cobrado', pagado = 1 WHERE id = ? OR uuid = ?`,
      [row.id, targetUuid],
      (errUpdate) => {
        if (errUpdate) return res.status(400).json({ error: errUpdate.message });
        if (io) {
          io.emit('pedido_completado_servidor', { uuid: targetUuid, id: row.id });
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
        res.json({ success: true, pedido_id: row.id, uuid: targetUuid });
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

    let itemsArr = [];
    try { itemsArr = typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []); } catch(e) {}

    const estadoLower = String(row.estado || '').toLowerCase().trim();
    const yaSalioDeCocina = ['listo', 'despachado', 'completado', 'cuenta', 'cobrado', 'entregado'].includes(estadoLower) ||
      (Array.isArray(itemsArr) && itemsArr.length > 0 && itemsArr.some(i => i && String(i.estado || '').toLowerCase() === 'listo'));

    if (yaSalioDeCocina) {
      return res.status(400).json({ error: 'No se puede cancelar el pedido porque ya salió de la cocina.' });
    }

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
            const targetMesa = row.mesa || '';
            const mesasALiberar = String(targetMesa).split(',').map(m => m.trim().replace(/\D/g, '')).filter(Boolean);

            const finalizarRespuesta = () => {
              logAuditoria(usuario, 'pedido_cancelado', `Pedido cancelado para ${row.mesa}. Motivo: ${motivo}`);
              if (io) {
                io.emit('pedido_cancelado_servidor', { uuid });
                io.emit('pedidos_actualizados');
                io.emit('actualizar_pedidos');
                io.emit('caja_actualizada');
              }
              emitirSincronizacionCompleta();
              res.json({ success: true });
            };

            if (mesasALiberar.length > 0) {
              let updates = 0;
              mesasALiberar.forEach(mesaNum => {
                db.run(`UPDATE mesas SET estado = 'libre' WHERE id = ? OR num = ?`, [mesaNum, mesaNum], () => {
                  updates++;
                  if (updates === mesasALiberar.length) {
                    db.all('SELECT * FROM mesas', (errMesas, filasMesas) => {
                      if (!errMesas && io) {
                        io.emit('mesas_actualizadas', filasMesas);
                      }
                      finalizarRespuesta();
                    });
                  }
                });
              });
            } else {
              finalizarRespuesta();
            }
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
