const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { logAuditoria, obtenerBalanceTurnoActivo } = require('../utils/helpers');
const { getIO, emitirSincronizacionCompleta } = require('../utils/socket');

// ─── SESIONES DE CAJA ───

// GET - Sesión Activa
router.get('/caja/sesion-activa', async (req, res) => {
  const sesionActiva = await obtenerBalanceTurnoActivo();
  res.json({ sesion: sesionActiva });
});

// POST - Abrir Caja
router.post('/caja/abrir', (req, res) => {
  const io = req.io || getIO();
  const { base_inicial, usuario } = req.body;
  const ahora = new Date().toISOString();
  
  // Sanitizar base_inicial antes de insertar:
  const baseLimpia = typeof base_inicial === 'string'
    ? parseInt(base_inicial.replace(/\D/g, ''), 10) || 0
    : Number(base_inicial || 0);

  // Cerrar cualquier sesión previa abierta por seguridad
  db.run(`UPDATE caja_sesiones SET estado = 'cerrada', fecha_cierre = ? WHERE estado = 'abierta'`, [ahora], () => {
    db.run(
      `INSERT INTO caja_sesiones (fecha_apertura, base_inicial, estado) VALUES (?, ?, 'abierta')`,
      [ahora, baseLimpia],
      function (err) {
        if (err) return res.status(400).json({ error: err.message });
        logAuditoria(usuario, 'caja_abierta', `Caja abierta con base inicial de $${baseLimpia}`);
        db.get(`SELECT * FROM caja_sesiones WHERE id = ?`, [this.lastID], async (errRow, row) => {
          const nuevaSesion = await obtenerBalanceTurnoActivo();
          if (io) {
            io.emit('caja:estado', {
              abierta: true,
              sesion: nuevaSesion,
              turno: nuevaSesion
            });
            io.emit('caja_actualizada', row);
          }
          
          emitirSincronizacionCompleta();
          
          res.json({ success: true, sesion: nuevaSesion || row });
        });
      }
    );
  });
});

// GET - Resumen de Cierre de Caja
router.get('/caja/resumen-cierre/:sesion_id', (req, res) => {
  const sesion_id = req.params.sesion_id;
  db.get(`SELECT * FROM caja_sesiones WHERE id = ?`, [sesion_id], (err, sesion) => {
    if (err || !sesion) return res.status(404).json({ error: 'Sesión no encontrada' });

    db.get(`SELECT SUM(total) as total FROM ventas WHERE sesion_id = ? AND metodo_pago = 'Efectivo'`, [sesion_id], (err1, rEfectivo) => {
      const efectivo = rEfectivo ? rEfectivo.total || 0 : 0;
      
      db.get(`SELECT SUM(total) as total FROM ventas WHERE sesion_id = ? AND metodo_pago = 'Transferencia'`, [sesion_id], (err2, rTransf) => {
        const transferencia = rTransf ? rTransf.total || 0 : 0;
        
        db.get(`SELECT SUM(valor) as total FROM gastos WHERE sesion_id = ?`, [sesion_id], (err3, rGastos) => {
          const gastos = rGastos ? rGastos.total || 0 : 0;
          
          const esperado = sesion.base_inicial + efectivo - gastos;
          
          res.json({
            success: true,
            base_inicial: sesion.base_inicial,
            ingresos_efectivo: efectivo,
            ingresos_transferencia: transferencia,
            gastos: gastos,
            saldo_final_esperado: esperado
          });
        });
      });
    });
  });
});

// POST - Cerrar Caja
router.post('/caja/cerrar', (req, res) => {
  const io = req.io || getIO();
  const { sesion_id, saldo_final_real, usuario } = req.body;
  const ahora = new Date().toISOString();

  db.get(`SELECT * FROM caja_sesiones WHERE id = ?`, [sesion_id], (err, sesion) => {
    if (err || !sesion) return res.status(400).json({ error: 'Sesión no encontrada' });
    if (sesion.estado === 'cerrada') return res.status(400).json({ error: 'La sesión ya está cerrada' });

    // 1. Obtener ingresos efectivo
    db.get(`SELECT SUM(total) as total FROM ventas WHERE sesion_id = ? AND metodo_pago = 'Efectivo'`, [sesion_id], (err1, rEfectivo) => {
      const efectivo = rEfectivo ? rEfectivo.total || 0 : 0;
      
      // 2. Obtener ingresos transferencia
      db.get(`SELECT SUM(total) as total FROM ventas WHERE sesion_id = ? AND metodo_pago = 'Transferencia'`, [sesion_id], (err2, rTransf) => {
        const transferencia = rTransf ? rTransf.total || 0 : 0;
        
        // 3. Obtener gastos
        db.get(`SELECT SUM(valor) as total FROM gastos WHERE sesion_id = ?`, [sesion_id], (err3, rGastos) => {
          const gastos = rGastos ? rGastos.total || 0 : 0;
          
          const esperado = sesion.base_inicial + efectivo - gastos;
          const diferencia = saldo_final_real - esperado;

          db.run(
            `UPDATE caja_sesiones SET fecha_cierre = ?, saldo_final_real = ?, estado = 'cerrada' WHERE id = ?`,
            [ahora, saldo_final_real, sesion_id],
            (errUpdate) => {
              if (errUpdate) return res.status(500).json({ error: errUpdate.message });
              logAuditoria(usuario, 'caja_cerrada', `Caja cerrada. Esperado: $${esperado}, Real: $${saldo_final_real}, Dif: $${diferencia}`);
              if (io) io.emit('caja_actualizada', null);
              res.json({
                success: true,
                base_inicial: sesion.base_inicial,
                ingresos_efectivo: efectivo,
                ingresos_transferencia: transferencia,
                gastos: gastos,
                saldo_final_esperado: esperado,
                saldo_final_real: saldo_final_real,
                diferencia: diferencia
              });
            }
          );
        });
      });
    });
  });
});

// Endpoint Caja Pendientes: /api/caja/pendientes
router.get('/caja/pendientes', (req, res) => {
  db.all(
    `SELECT * FROM pedidos 
     WHERE LOWER(estado) IN ('cuenta', 'por_cobrar', 'pendiente_pago', 'entregado', 'completado', 'activo', 'listo', 'en_cocina', 'preparando', 'pendiente') 
       AND LOWER(estado) NOT IN ('cobrado', 'cancelado', 'archivado') 
       AND (pagado = 0 OR pagado IS NULL) 
     ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const respuesta = rows.map(r => ({ ...r, items: typeof r.items === 'string' ? JSON.parse(r.items || '[]') : (r.items || []) }));
      res.json(respuesta);
    }
  );
});

// ─── CRÉDITOS Y FIADOS ───

// GET - Obtener pedidos fiados / créditos
router.get('/pedidos/fiado', (req, res) => {
  db.all(
    `SELECT * FROM pedidos WHERE estado IN ('fiado', 'credito') ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Error fetching fiados:', err);
        return res.status(400).json({ error: err.message });
      }
      const fiados = (rows || []).map(p => {
        let parsedItems = [];
        try {
          parsedItems = typeof p.items === 'string' ? JSON.parse(p.items) : (p.items || []);
        } catch(e) {
          parsedItems = [];
        }
        return {
          ...p,
          items: parsedItems
        };
      });
      res.json({ fiados });
    }
  );
});

// POST - Registrar abono a créditos/fiados con sistema FIFO
router.post('/fiados/abono', (req, res) => {
  const io = req.io || getIO();
  const { deudor, monto, metodo_pago, sesion_id } = req.body;
  const montoAbono = Number(monto);

  if (!deudor || !montoAbono || montoAbono <= 0) {
    return res.status(400).json({ error: 'Deudor y monto válido son requeridos.' });
  }

  // Obtener todos los pedidos fiados del deudor ordenados del más antiguo al más reciente (FIFO)
  const sqlGet = `SELECT * FROM pedidos WHERE TRIM(LOWER(deudor)) = TRIM(LOWER(?)) AND estado = 'fiado' ORDER BY id ASC`;
  
  db.all(sqlGet, [deudor], (err, ordenes) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!ordenes || ordenes.length === 0) {
      return res.status(404).json({ error: 'No se encontraron deudas pendientes para este deudor.' });
    }

    let restante = montoAbono;

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      for (const ord of ordenes) {
        if (restante <= 0) break;

        let totalPedido = 0;
        try {
          const items = typeof ord.items === 'string' ? JSON.parse(ord.items) : (ord.items || []);
          totalPedido = items.reduce((sum, item) => {
            const adicTotal = (item.adicionales || []).reduce((aSum, a) => aSum + (Number(a.precio || 0) * (a.cantidad || 1)), 0);
            return sum + ((Number(item.precio || 0) + adicTotal) * Number(item.cantidad || 1));
          }, 0);
        } catch (e) {
          totalPedido = Number(ord.total || 0);
        }

        const abonoPrevio = Number(ord.abono_parcial || 0);
        const saldoPendiente = Math.max(0, totalPedido - abonoPrevio);

        if (saldoPendiente <= 0) continue;

        if (restante >= saldoPendiente) {
          // El abono liquida completamente esta orden antigua -> pasa a 'cobrado'
          restante -= saldoPendiente;
          db.run(
            `UPDATE pedidos SET estado = 'cobrado', pagado = 1, abono_parcial = ? WHERE id = ?`,
            [totalPedido, ord.id]
          );
          // Registrar en abonos_fiados
          db.run(
            `INSERT INTO abonos_fiados (deudor, monto, metodo_pago, pedido_id, sesion_id) VALUES (?, ?, ?, ?, ?)`,
            [deudor, saldoPendiente, metodo_pago || 'Efectivo', ord.id, sesion_id || null]
          );
        } else {
          // El abono cubre solo una parte de esta orden
          const nuevoAbono = abonoPrevio + restante;
          db.run(
            `UPDATE pedidos SET abono_parcial = ? WHERE id = ?`,
            [nuevoAbono, ord.id]
          );
          db.run(
            `INSERT INTO abonos_fiados (deudor, monto, metodo_pago, pedido_id, sesion_id) VALUES (?, ?, ?, ?, ?)`,
            [deudor, restante, metodo_pago || 'Efectivo', ord.id, sesion_id || null]
          );
          restante = 0;
        }
      }

      db.run('COMMIT', (commitErr) => {
        if (commitErr) return res.status(500).json({ error: commitErr.message });
        if (io) {
          io.emit('pedidos_actualizados');
          io.emit('actualizar_pedidos');
          io.emit('dashboard:actualizado');
          io.emit('caja:estado');
        }
        return res.json({ success: true, deudor, montoAbonado: montoAbono, remanenteNoAplicado: restante });
      });
    });
  });
});

// GET - Obtener todos los clientes históricos
router.get('/clientes', (req, res) => {
  db.all(`SELECT nombre FROM clientes ORDER BY nombre ASC`, [], (err, rows) => {
    if (err) return res.status(400).json({ error: err.message });
    const clientes = rows.map(r => r.nombre);
    res.json({ clientes });
  });
});

// PUT - Registrar/Actualizar pedido como fiado (soporta combinación/merge)
router.put('/pedidos/:uuid/fiado', (req, res) => {
  const io = req.io || getIO();
  const { uuid } = req.params;
  const { deudor, fecha_fiado, usuario, items, mesa } = req.body;
  
  let query = `UPDATE pedidos SET estado = 'fiado', deudor = ?, fecha_fiado = ?`;
  const params = [deudor, fecha_fiado];
  
  if (items) {
    query += `, items = ?`;
    params.push(JSON.stringify(items));
  }
  if (mesa) {
    query += `, mesa = ?`;
    params.push(mesa);
  }
  
  query += ` WHERE uuid = ?`;
  params.push(uuid);
  
  db.run(query, params, function (err) {
    if (err) return res.status(400).json({ error: err.message });
    // Liberar mesa física
    const targetMesa = mesa || '';
    const mesasALiberar = String(targetMesa).split(',').map(m => Number(m.trim())).filter(m => !isNaN(m));
    if (mesasALiberar.length > 0) {
      let updates = 0;
      mesasALiberar.forEach(mesaNum => {
        db.run(`UPDATE mesas SET estado = 'libre' WHERE num = ?`, [mesaNum], () => {
          updates++;
          if (updates === mesasALiberar.length) {
            db.all('SELECT * FROM mesas', (errMesas, filasMesas) => {
              if (!errMesas && io) io.emit('mesas_actualizadas', filasMesas);
            });
          }
        });
      });
    }
    
    // Notificar a todos que el pedido ya no está activo
    if (deudor) {
      db.run('INSERT OR IGNORE INTO clientes (nombre) VALUES (?)', [deudor.trim()]);
    }
    
    // Emitir el evento de fiado para que se actualice en la caja en tiempo real (Créditos)
    db.get('SELECT * FROM pedidos WHERE uuid = ?', [uuid], (errSel, row) => {
      if (row) {
        row.items = JSON.parse(row.items);
        if (io) io.emit('pedido_fiado_servidor', row);
      }
    });
    
    logAuditoria(usuario, 'pedido_fiado', `Pedido registrado como fiado a favor de ${deudor} (Mesa ${targetMesa})`);
    res.json({ success: true });
  });
});

// ─── VENTAS Y PAGOS ───

// POST - Registrar Venta Permanente con Detalle
router.post('/ventas', (req, res) => {
  const io = req.io || getIO();
  const { fecha, tipo_origen, mesa, total, metodo_pago, sesion_id, detalles, usuario, deudor, fecha_fiado, monto_efectivo, monto_transferencia } = req.body;
  const ahora = fecha || new Date().toISOString();

  const execInsert = (monto, metodo, det) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO ventas (fecha, tipo_origen, mesa, total, metodo_pago, sesion_id, deudor, fecha_fiado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [ahora, tipo_origen, mesa, monto, metodo, sesion_id, deudor || null, fecha_fiado || null],
        function (err) {
          if (err) return reject(err);
          const ventaId = this.lastID;
          if (det && det.length > 0) {
            const stmt = db.prepare(`INSERT INTO ventas_detalle (venta_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)`);
            let insertError = null;
            det.forEach(d => {
              stmt.run([ventaId, d.producto_id, d.nombre_producto, d.cantidad, d.precio_unitario, d.subtotal], (errStmt) => {
                if (errStmt) insertError = errStmt;
              });

              // Descuento automático de insumos basado en la receta
              db.all(`SELECT insumo_id, cantidad FROM producto_insumos WHERE producto_id = ?`, [d.producto_id], (errPI, ingredientes) => {
                if (!errPI && ingredientes && ingredientes.length > 0) {
                  ingredientes.forEach(ing => {
                    const cantidadADescontar = parseFloat(ing.cantidad) * parseFloat(d.cantidad);
                    if (cantidadADescontar > 0) {
                      db.run(`UPDATE insumos SET cantidad_actual = cantidad_actual - ? WHERE id = ?`, [cantidadADescontar, ing.insumo_id], (errUpd) => {
                        if (!errUpd) {
                          db.run(`INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, motivo, fecha) VALUES (?, 'salida', ?, ?, ?)`,
                            [ing.insumo_id, cantidadADescontar, `Venta: ${d.cantidad}x ${d.nombre_producto} (Venta #${ventaId})`, ahora], () => {
                              if (io) io.emit('inventario:actualizado');
                            });
                        }
                      });
                    }
                  });
                }
              });
            });
            stmt.finalize((errFinal) => {
              if (insertError || errFinal) return reject(insertError || errFinal);
              resolve(ventaId);
            });
          } else {
            resolve(ventaId);
          }
        }
      );
    });
  };

  db.serialize(() => {
    const liberarMesaYCerrarPedidos = () => {
      if (tipo_origen === 'Mesa' || (mesa && !String(mesa).toLowerCase().includes('deuda'))) {
        const mesaNum = String(mesa).replace(/\D/g, '');
        if (mesaNum) {
          db.run(`UPDATE mesas SET estado = 'libre' WHERE id = ? OR num = ?`, [mesaNum, mesaNum], () => {
            db.all('SELECT * FROM mesas', (errM, rowsM) => {
              if (!errM && io) io.emit('mesas_actualizadas', rowsM);
            });
          });
          db.run(
            `UPDATE pedidos SET estado = 'cobrado', pagado = 1 WHERE (mesa = ? OR mesa = ? OR mesa_id = ?) AND estado NOT IN ('cobrado', 'cancelado', 'archivado', 'fiado', 'credito')`,
            [mesaNum, `Mesa ${mesaNum}`, mesaNum],
            () => {
              if (io) io.emit('pedidos_actualizados');
              emitirSincronizacionCompleta();
            }
          );
        }
      }
    };

    if (metodo_pago === 'mixto' || metodo_pago === 'Mixto') {
      Promise.all([
        (monto_efectivo && monto_efectivo > 0) ? execInsert(monto_efectivo, 'Efectivo', detalles) : Promise.resolve(null),
        (monto_transferencia && monto_transferencia > 0) ? execInsert(monto_transferencia, 'Transferencia', []) : Promise.resolve(null)
      ]).then(async results => {
        logAuditoria(usuario, 'pedido_cobrado', `Cobro mixto registrado para ${tipo_origen} ${mesa} por $${total} (Ef: $${monto_efectivo}, Tr: $${monto_transferencia})`);
        res.json({ success: true, ids: results });

        liberarMesaYCerrarPedidos();

        const balanceActualizado = await obtenerBalanceTurnoActivo();
        if (io) {
          io.emit('caja:estado', {
            abierta: Boolean(balanceActualizado),
            sesion: balanceActualizado,
            turno: balanceActualizado
          });
        }
      }).catch(err => {
        res.status(400).json({ error: err.message });
      });
    } else {
      execInsert(total, metodo_pago, detalles)
        .then(async ventaId => {
          logAuditoria(usuario, 'pedido_cobrado', `Cobro registrado para ${tipo_origen} ${mesa} por $${total} (${metodo_pago})`);
          res.json({ success: true, id: ventaId });

          liberarMesaYCerrarPedidos();

          const balanceActualizado = await obtenerBalanceTurnoActivo();
          if (io) {
            io.emit('caja:estado', {
              abierta: Boolean(balanceActualizado),
              sesion: balanceActualizado,
              turno: balanceActualizado
            });
          }
        })
        .catch(err => {
          res.status(400).json({ error: err.message });
        });
    }
  });
});

// GET - Obtener Ventas Históricas
router.get('/ventas', (req, res) => {
  const { rango } = req.query; 
  
  let dateCondition = `date(datetime(fecha, 'localtime')) = date('now', 'localtime')`; // Default a hoy
  if (rango === 'semana') {
    dateCondition = `date(datetime(fecha, 'localtime')) >= date('now', '-6 days', 'localtime')`;
  } else if (rango === 'mes') {
    dateCondition = `strftime('%Y-%m', datetime(fecha, 'localtime')) = strftime('%Y-%m', 'now', 'localtime')`;
  } else if (rango === 'todo') {
    dateCondition = '1=1';
  }

  db.all(`SELECT * FROM ventas WHERE ${dateCondition} ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ventas: rows });
  });
});

// GET - Obtener detalles de una venta específica
router.get('/ventas/:id/detalles', (req, res) => {
  const ventaId = req.params.id;
  db.all(`SELECT * FROM ventas_detalle WHERE venta_id = ?`, [ventaId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ detalles: rows });
  });
});

module.exports = router;
