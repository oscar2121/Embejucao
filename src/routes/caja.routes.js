const express = require('express');
const router = express.Router();
const { db, dbAll, dbGet } = require('../database/db');
const { logAuditoria, obtenerBalanceTurnoActivo } = require('../utils/helpers');
const { getIO, emitirSincronizacionCompleta } = require('../utils/socket');

// GET - Estado Actual de Caja (Efectivo cobrado vs Pendiente en Mesas)
router.get('/caja/estado-actual', async (req, res) => {
  try {
    const cobrados = await dbGet("SELECT SUM(total) as total FROM pedidos WHERE LOWER(estado) = 'cobrado' AND date(datetime(fecha), 'localtime') = date('now', 'localtime')");
    const abiertos = await dbGet("SELECT SUM(total) as total FROM pedidos WHERE LOWER(estado) NOT IN ('cobrado', 'cancelado', 'archivado', 'fiado', 'credito') AND (pagado = 0 OR pagado IS NULL)");
    const efectivoEnCaja = cobrados?.total || 0;
    const pendienteEnMesas = abiertos?.total || 0;

    res.json({
      success: true,
      efectivo_en_caja: efectivoEnCaja,
      pendiente_en_mesas: pendienteEnMesas,
      total_proyectado: efectivoEnCaja + pendienteEnMesas
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pedidos/mesa/:mesa - Buscar el pedido activo de una mesa específica
router.get('/pedidos/mesa/:mesa', async (req, res) => {
  try {
    const mesaNum = req.params.mesa;
    // Buscar el pedido activo usando columna 'mesa' y estado 'activo'
    const pedido = await dbGet(
      "SELECT * FROM pedidos WHERE mesa = ? AND estado = 'activo' ORDER BY id DESC LIMIT 1",
      [mesaNum]
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


// GET - Sesión Activa
router.get('/caja/sesion-activa', async (req, res) => {
  const sesionActiva = await obtenerBalanceTurnoActivo();
  res.json({ sesion: sesionActiva });
});

// GET - Productividad en Vivo del Turno Activo (5 Macro-Grupos)
router.get('/caja/productividad-en-vivo', async (req, res) => {
  try {
    const sesionActiva = await obtenerBalanceTurnoActivo();
    let whereClause = "ped.estado = 'cobrado'";
    const params = [];

    if (sesionActiva && sesionActiva.id) {
      whereClause += " AND ped.caja_sesion_id = ?";
      params.push(sesionActiva.id);
    } else {
      whereClause += " AND date(datetime(ped.fecha), 'localtime') = date('now', 'localtime')";
    }

    const query = `
      SELECT 
        COALESCE(p.grupo_reporte, 'comida') AS grupo,
        SUM(COALESCE(dp.cantidad, 1)) AS unidades_vendidas,
        SUM(COALESCE(dp.precio_unitario * dp.cantidad, ped.total, 0)) AS total_dinero
      FROM pedidos ped
      LEFT JOIN detalles_pedidos dp ON dp.pedido_id = ped.id
      LEFT JOIN productos p ON p.id = dp.producto_id
      WHERE ${whereClause}
      GROUP BY grupo;
    `;
    let data = await dbAll(query, params);

    // Fallback de compatibilidad con ventas_detalle
    if (!data || data.length === 0) {
      let whereVentas = "1=1";
      const paramsVentas = [];
      if (sesionActiva && sesionActiva.id) {
        whereVentas += " AND v.sesion_id = ?";
        paramsVentas.push(sesionActiva.id);
      } else {
        whereVentas += " AND date(datetime(v.fecha), 'localtime') = date('now', 'localtime')";
      }
      const queryVentas = `
        SELECT 
          COALESCE(p.grupo_reporte, 'comida') AS grupo,
          SUM(vd.cantidad) AS unidades_vendidas,
          SUM(vd.precio_unitario * vd.cantidad) AS total_dinero
        FROM ventas v
        LEFT JOIN ventas_detalle vd ON vd.venta_id = v.id
        LEFT JOIN productos p ON p.id = vd.producto_id
        WHERE ${whereVentas}
        GROUP BY grupo;
      `;
      const fallbackData = await dbAll(queryVentas, paramsVentas);
      if (fallbackData && fallbackData.length > 0) {
        data = fallbackData;
      }
    }

    const mapa = {
      comida: 0,
      jugos_naturales: 0,
      cervezas: 0,
      gaseosas_embotellados: 0,
      bebidas_calientes: 0,
      total_turno: 0
    };

    (data || []).forEach(r => {
      const g = (r.grupo || 'comida').toLowerCase();
      const val = Number(r.total_dinero || 0);
      if (mapa.hasOwnProperty(g)) {
        mapa[g] += val;
      } else {
        mapa.comida += val;
      }
      mapa.total_turno += val;
    });

    res.json({
      success: true,
      sesion_activa: sesionActiva || null,
      productividad: mapa,
      detalles: data || []
    });
  } catch (error) {
    console.error("Error al obtener productividad en vivo:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Reportes de Productividad por Sesión o Fecha (5 Macro-Grupos)
router.get('/reportes/productividad', async (req, res) => {
  const { fecha, sesion_id } = req.query;
  try {
    let whereClause = "ped.estado = 'cobrado'";
    const params = [];

    if (sesion_id) {
      whereClause += " AND ped.caja_sesion_id = ?";
      params.push(sesion_id);
    } else if (fecha) {
      whereClause += " AND date(datetime(ped.fecha), 'localtime') = date(?)";
      params.push(fecha);
    }

    const query = `
      SELECT 
        COALESCE(p.grupo_reporte, 'comida') AS grupo,
        SUM(COALESCE(dp.cantidad, 1)) AS unidades_vendidas,
        SUM(COALESCE(dp.precio_unitario * dp.cantidad, ped.total, 0)) AS total_dinero
      FROM pedidos ped
      LEFT JOIN detalles_pedidos dp ON dp.pedido_id = ped.id
      LEFT JOIN productos p ON p.id = dp.producto_id
      WHERE ${whereClause}
      GROUP BY grupo;
    `;
    let data = await dbAll(query, params);

    // Respaldo de compatibilidad: Si detalles_pedidos aún no tiene registros para esta sesión o fecha, consultar ventas_detalle
    if (!data || data.length === 0) {
      let whereVentas = "1=1";
      const paramsVentas = [];
      if (sesion_id) {
        whereVentas += " AND v.sesion_id = ?";
        paramsVentas.push(sesion_id);
      } else if (fecha) {
        whereVentas += " AND date(datetime(v.fecha), 'localtime') = date(?)";
        paramsVentas.push(fecha);
      }
      const queryVentas = `
        SELECT 
          COALESCE(p.grupo_reporte, 'comida') AS grupo,
          SUM(vd.cantidad) AS unidades_vendidas,
          SUM(vd.precio_unitario * vd.cantidad) AS total_dinero
        FROM ventas v
        LEFT JOIN ventas_detalle vd ON vd.venta_id = v.id
        LEFT JOIN productos p ON p.id = vd.producto_id
        WHERE ${whereVentas}
        GROUP BY grupo;
      `;
      const fallbackData = await dbAll(queryVentas, paramsVentas);
      if (fallbackData && fallbackData.length > 0) {
        data = fallbackData;
      }
    }

    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Historial de Productividad Agrupado por Rango de Fechas
router.get('/reportes/productividad/historial', async (req, res) => {
  const { fecha_inicio, fecha_fin, rango } = req.query;
  try {
    let whereClause = "ped.estado = 'cobrado'";
    const params = [];

    if (fecha_inicio && fecha_fin) {
      whereClause += " AND date(datetime(ped.fecha), 'localtime') BETWEEN date(?) AND date(?)";
      params.push(fecha_inicio, fecha_fin);
    } else if (fecha_inicio) {
      whereClause += " AND date(datetime(ped.fecha), 'localtime') = date(?)";
      params.push(fecha_inicio);
    } else if (rango === 'todo') {
      // Sin filtro de fecha para traer todo el historial
    } else if (rango === 'mes' || rango === 'este_mes') {
      whereClause += " AND strftime('%Y-%m', datetime(ped.fecha), 'localtime') = strftime('%Y-%m', 'now', 'localtime')";
    } else if (rango === 'semana' || rango === 'esta_semana') {
      whereClause += " AND date(datetime(ped.fecha), 'localtime') >= date('now', '-6 days', 'localtime')";
    } else if (rango === 'hoy') {
      whereClause += " AND date(datetime(ped.fecha), 'localtime') = date('now', 'localtime')";
    } else if (rango === 'ayer') {
      whereClause += " AND date(datetime(ped.fecha), 'localtime') = date('now', '-1 day', 'localtime')";
    } else {
      whereClause += " AND strftime('%Y-%m', datetime(ped.fecha), 'localtime') = strftime('%Y-%m', 'now', 'localtime')";
    }

    const query = `
      SELECT 
        date(datetime(ped.fecha), 'localtime') AS fecha,
        COALESCE(p.grupo_reporte, 'comida') AS grupo,
        SUM(COALESCE(dp.cantidad, 1)) AS unidades_vendidas,
        SUM(COALESCE(dp.precio_unitario * dp.cantidad, ped.total, 0)) AS total_dinero
      FROM pedidos ped
      LEFT JOIN detalles_pedidos dp ON dp.pedido_id = ped.id
      LEFT JOIN productos p ON p.id = dp.producto_id
      WHERE ${whereClause}
      GROUP BY date(datetime(ped.fecha), 'localtime'), grupo
      ORDER BY date(datetime(ped.fecha), 'localtime') DESC;
    `;

    let filas = await dbAll(query, params);

    // Fallback de compatibilidad con ventas_detalle
    if (!filas || filas.length === 0) {
      let whereVentas = "1=1";
      const paramsVentas = [];
      if (rango === 'mes') {
        whereVentas += " AND strftime('%Y-%m', datetime(v.fecha), 'localtime') = strftime('%Y-%m', 'now', 'localtime')";
      } else if (fecha_inicio && fecha_fin) {
        whereVentas += " AND date(datetime(v.fecha), 'localtime') BETWEEN date(?) AND date(?)";
        paramsVentas.push(fecha_inicio, fecha_fin);
      } else if (fecha_inicio) {
        whereVentas += " AND date(datetime(v.fecha), 'localtime') = date(?)";
        paramsVentas.push(fecha_inicio);
      } else {
        whereVentas += " AND strftime('%Y-%m', datetime(v.fecha), 'localtime') = strftime('%Y-%m', 'now', 'localtime')";
      }
      const queryVentas = `
        SELECT 
          date(datetime(v.fecha), 'localtime') AS fecha,
          COALESCE(p.grupo_reporte, 'comida') AS grupo,
          SUM(COALESCE(vd.cantidad, 1)) AS unidades_vendidas,
          SUM(COALESCE(vd.precio_unitario * vd.cantidad, v.total, 0)) AS total_dinero
        FROM ventas v
        LEFT JOIN ventas_detalle vd ON vd.venta_id = v.id
        LEFT JOIN productos p ON p.id = vd.producto_id
        WHERE ${whereVentas}
        GROUP BY date(datetime(v.fecha), 'localtime'), grupo
        ORDER BY date(datetime(v.fecha), 'localtime') DESC;
      `;
      const fallbackFilas = await dbAll(queryVentas, paramsVentas);
      if (fallbackFilas && fallbackFilas.length > 0) {
        filas = fallbackFilas;
      }
    }

    // Reorganizar en formato de tabla cronológica agrupada por día
    const agrupadoPorDia = {};

    (filas || []).forEach(f => {
      if (!f.fecha) return;
      if (!agrupadoPorDia[f.fecha]) {
        agrupadoPorDia[f.fecha] = {
          fecha: f.fecha,
          comida: 0,
          jugos_naturales: 0,
          cervezas: 0,
          gaseosas_embotellados: 0,
          bebidas_calientes: 0,
          total_dia: 0
        };
      }
      const monto = Number(f.total_dinero) || 0;
      const g = (f.grupo || 'comida').toLowerCase();
      if (agrupadoPorDia[f.fecha].hasOwnProperty(g)) {
        agrupadoPorDia[f.fecha][g] += monto;
      } else {
        agrupadoPorDia[f.fecha].comida += monto;
      }
      agrupadoPorDia[f.fecha].total_dia += monto;
    });

    res.json(Object.values(agrupadoPorDia));
  } catch (error) {
    console.error("Error historial productividad:", error);
    res.status(500).json({ error: error.message });
  }
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
router.get('/caja/resumen-cierre/:sesion_id', async (req, res) => {
  const sesion_id = req.params.sesion_id;
  try {
    const sesion = await dbGet(`SELECT * FROM caja_sesiones WHERE id = ?`, [sesion_id]);
    if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });

    const rEfectivo = await dbGet(`SELECT SUM(total) as total FROM ventas WHERE sesion_id = ? AND metodo_pago = 'Efectivo'`, [sesion_id]);
    const efectivo = rEfectivo ? rEfectivo.total || 0 : 0;

    const rTransf = await dbGet(`SELECT SUM(total) as total FROM ventas WHERE sesion_id = ? AND metodo_pago = 'Transferencia'`, [sesion_id]);
    const transferencia = rTransf ? rTransf.total || 0 : 0;

    const rGastos = await dbGet(`SELECT SUM(valor) as total FROM gastos WHERE sesion_id = ?`, [sesion_id]);
    const gastos = rGastos ? rGastos.total || 0 : 0;

    const esperado = sesion.base_inicial + efectivo - gastos;

    // Obtener desglose de productividad para la sesión
    const queryProd = `
      SELECT 
        COALESCE(p.grupo_reporte, 'comida') AS grupo,
        SUM(dp.cantidad) AS unidades_vendidas,
        SUM(dp.precio_unitario * dp.cantidad) AS total_dinero
      FROM detalles_pedidos dp
      JOIN productos p ON p.id = dp.producto_id
      JOIN pedidos ped ON ped.id = dp.pedido_id
      WHERE ped.estado = 'cobrado' AND ped.caja_sesion_id = ?
      GROUP BY grupo;
    `;
    let productividadRows = await dbAll(queryProd, [sesion_id]);

    if (!productividadRows || productividadRows.length === 0) {
      const fallbackQuery = `
        SELECT 
          COALESCE(p.grupo_reporte, 'comida') AS grupo,
          SUM(vd.cantidad) AS unidades_vendidas,
          SUM(vd.precio_unitario * vd.cantidad) AS total_dinero
        FROM ventas_detalle vd
        JOIN productos p ON p.id = vd.producto_id
        JOIN ventas v ON v.id = vd.venta_id
        WHERE v.sesion_id = ?
        GROUP BY grupo;
      `;
      productividadRows = await dbAll(fallbackQuery, [sesion_id]);
    }

    const mapaProductividad = {
      comida: 0,
      jugos_naturales: 0,
      cervezas: 0,
      gaseosas_embotellados: 0,
      bebidas_calientes: 0
    };

    (productividadRows || []).forEach(r => {
      const g = (r.grupo || 'comida').toLowerCase();
      if (mapaProductividad[g] !== undefined) {
        mapaProductividad[g] += Number(r.total_dinero || 0);
      } else {
        mapaProductividad.comida += Number(r.total_dinero || 0);
      }
    });

    res.json({
      success: true,
      base_inicial: sesion.base_inicial,
      ingresos_efectivo: efectivo,
      ingresos_transferencia: transferencia,
      gastos: gastos,
      saldo_final_esperado: esperado,
      productividad: mapaProductividad,
      productividad_detalle: productividadRows || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

// GET - Historial de Abonos
router.get('/fiados/abonos', (req, res) => {
  const deudor = req.query.deudor || req.query.cliente_id;
  let sql = `SELECT * FROM abonos_credito ORDER BY id DESC LIMIT 100`;
  let params = [];
  if (deudor) {
    sql = `SELECT * FROM abonos_credito WHERE LOWER(cliente_id) = LOWER(?) OR LOWER(deudor) = LOWER(?) ORDER BY id DESC LIMIT 100`;
    params = [deudor, deudor];
  }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, abonos: rows || [] });
  });
});

router.get('/creditos/abonos', (req, res) => {
  const deudor = req.query.deudor || req.query.cliente_id;
  let sql = `SELECT * FROM abonos_credito ORDER BY id DESC LIMIT 100`;
  let params = [];
  if (deudor) {
    sql = `SELECT * FROM abonos_credito WHERE LOWER(cliente_id) = LOWER(?) OR LOWER(deudor) = LOWER(?) ORDER BY id DESC LIMIT 100`;
    params = [deudor, deudor];
  }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, abonos: rows || [] });
  });
});

// POST - Endpoint de Abonos / Créditos (actualización de saldo + socket sync)
router.post('/creditos/abono', async (req, res) => {
  const io = req.io || (typeof getIO === 'function' ? getIO() : null);
  const { cliente_id, deudor, monto, metodo_pago, sesion_id } = req.body;
  const targetCliente = String(cliente_id || deudor || '').trim();
  const montoAbono = Number(monto);

  if (!targetCliente || isNaN(montoAbono) || montoAbono <= 0) {
    return res.status(400).json({ error: 'Cliente y monto válido son requeridos.' });
  }

  const fechaHoy = new Date().toISOString();

  try {
    db.run(`CREATE TABLE IF NOT EXISTS abonos_credito (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id TEXT, deudor TEXT, monto REAL, metodo_pago TEXT, fecha DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS clientes_credito (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT UNIQUE, saldo_pendiente REAL DEFAULT 0, ultimo_abono REAL DEFAULT 0, fecha_ultimo_abono TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS abonos_fiados (id INTEGER PRIMARY KEY AUTOINCREMENT, deudor TEXT, monto REAL, metodo_pago TEXT, pedido_id INTEGER, sesion_id INTEGER, fecha DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`ALTER TABLE pedidos ADD COLUMN abono_parcial REAL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE pedidos ADD COLUMN ultimo_abono REAL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE pedidos ADD COLUMN fecha_ultimo_abono TEXT`, () => {});
    db.run(`ALTER TABLE pedidos ADD COLUMN metodo_pago_abono TEXT`, () => {});
    db.run(`ALTER TABLE clientes_credito ADD COLUMN ultimo_abono REAL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE clientes_credito ADD COLUMN fecha_ultimo_abono TEXT`, () => {});

    db.run(
      `INSERT INTO abonos_credito (cliente_id, deudor, monto, metodo_pago, fecha) VALUES (?, ?, ?, ?, datetime('now', 'localtime'))`,
      [targetCliente, targetCliente, montoAbono, metodo_pago || 'Efectivo']
    );
    db.run(
      `UPDATE clientes_credito SET saldo_pendiente = MAX(0, saldo_pendiente - ?), ultimo_abono = ?, fecha_ultimo_abono = ? WHERE LOWER(nombre) = LOWER(?)`,
      [montoAbono, montoAbono, fechaHoy, targetCliente.toLowerCase()]
    );

    db.all(
      `SELECT * FROM pedidos WHERE (TRIM(LOWER(deudor)) = TRIM(LOWER(?)) OR id = ?) AND LOWER(estado) IN ('fiado', 'credito') ORDER BY id ASC`,
      [targetCliente, targetCliente],
      (err, ordenes) => {
        if (!err && Array.isArray(ordenes) && ordenes.length > 0) {
          let restante = montoAbono;
          for (const ord of ordenes) {
            if (restante <= 0) break;
            let totalOrd = Number(ord.total || 0);
            if (totalOrd <= 0 && ord.items) {
              try {
                const items = typeof ord.items === 'string' ? JSON.parse(ord.items) : (ord.items || []);
                totalOrd = items.reduce((sum, item) => sum + (Number(item.precio || 0) * Number(item.cantidad || 1)), 0);
              } catch (e) {}
            }
            const abonoPrev = Number(ord.abono_parcial || 0);
            const saldoOrd = Math.max(0, totalOrd - abonoPrev);
            if (saldoOrd <= 0) continue;

            if (restante >= saldoOrd) {
              restante -= saldoOrd;
              db.run(`UPDATE pedidos SET estado = 'cobrado', pagado = 1, abono_parcial = ?, ultimo_abono = ?, fecha_ultimo_abono = ?, metodo_pago_abono = ? WHERE id = ?`, [totalOrd, saldoOrd, fechaHoy, metodo_pago || 'Efectivo', ord.id]);
              db.run(`INSERT INTO abonos_fiados (deudor, monto, metodo_pago, pedido_id, sesion_id) VALUES (?, ?, ?, ?, ?)`, [targetCliente, saldoOrd, metodo_pago || 'Efectivo', ord.id, sesion_id || null]);
            } else {
              const nuevoAbono = abonoPrev + restante;
              db.run(`UPDATE pedidos SET abono_parcial = ?, ultimo_abono = ?, fecha_ultimo_abono = ?, metodo_pago_abono = ? WHERE id = ?`, [nuevoAbono, restante, fechaHoy, metodo_pago || 'Efectivo', ord.id]);
              db.run(`INSERT INTO abonos_fiados (deudor, monto, metodo_pago, pedido_id, sesion_id) VALUES (?, ?, ?, ?, ?)`, [targetCliente, restante, metodo_pago || 'Efectivo', ord.id, sesion_id || null]);
              restante = 0;
            }
          }
        }

        if (io) {
          io.emit('credito_actualizado');
          io.emit('caja_actualizada');
          io.emit('pedidos_actualizados');
          io.emit('actualizar_pedidos');
          io.emit('dashboard:actualizado');
          io.emit('caja:estado');
        }

        return res.json({ success: true, deudor: targetCliente, montoAbonado: montoAbono, mensaje: "Abono registrado con éxito" });
      }
    );
  } catch (err) {
    console.error("Error al registrar abono a crédito:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST - Registrar abono a créditos/fiados con sistema FIFO
router.post('/fiados/abono', (req, res) => {
  const io = req.io || (typeof getIO === 'function' ? getIO() : null);
  const { deudor, cliente_id, monto, metodo_pago, sesion_id } = req.body;
  const targetDeudor = String(deudor || cliente_id || '').trim();
  const montoAbono = Number(monto);

  if (!targetDeudor || isNaN(montoAbono) || montoAbono <= 0) {
    return res.status(400).json({ error: 'Deudor y monto válido son requeridos.' });
  }

  const fechaHoy = new Date().toISOString();

  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS abonos_credito (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id TEXT, deudor TEXT, monto REAL, metodo_pago TEXT, fecha DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS clientes_credito (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT UNIQUE, saldo_pendiente REAL DEFAULT 0, ultimo_abono REAL DEFAULT 0, fecha_ultimo_abono TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS abonos_fiados (id INTEGER PRIMARY KEY AUTOINCREMENT, deudor TEXT, monto REAL, metodo_pago TEXT, pedido_id INTEGER, sesion_id INTEGER, fecha DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`ALTER TABLE pedidos ADD COLUMN abono_parcial REAL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE pedidos ADD COLUMN ultimo_abono REAL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE pedidos ADD COLUMN fecha_ultimo_abono TEXT`, () => {});
    db.run(`ALTER TABLE pedidos ADD COLUMN metodo_pago_abono TEXT`, () => {});
    db.run(`ALTER TABLE clientes_credito ADD COLUMN ultimo_abono REAL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE clientes_credito ADD COLUMN fecha_ultimo_abono TEXT`, () => {});

    db.run(
      `INSERT INTO abonos_credito (cliente_id, deudor, monto, metodo_pago, fecha) VALUES (?, ?, ?, ?, datetime('now', 'localtime'))`,
      [targetDeudor, targetDeudor, montoAbono, metodo_pago || 'Efectivo'],
      (err) => {
        if (err) console.error("Aviso al registrar abono_credito:", err.message);
      }
    );

    db.run(
      `UPDATE clientes_credito SET saldo_pendiente = MAX(0, saldo_pendiente - ?), ultimo_abono = ?, fecha_ultimo_abono = ? WHERE LOWER(nombre) = LOWER(?)`,
      [montoAbono, montoAbono, fechaHoy, targetDeudor.toLowerCase()],
      (err) => {
        if (err) console.error("Aviso al actualizar clientes_credito:", err.message);
      }
    );

    const sqlGet = `SELECT * FROM pedidos WHERE (TRIM(LOWER(deudor)) = TRIM(LOWER(?)) OR id = ?) AND LOWER(estado) IN ('fiado', 'credito') ORDER BY id ASC`;
    
    db.all(sqlGet, [targetDeudor, targetDeudor], (err, ordenes) => {
      if (err) return res.status(500).json({ error: err.message });

      let restante = montoAbono;
      db.run('BEGIN TRANSACTION');

      if (Array.isArray(ordenes) && ordenes.length > 0) {
        for (const ord of ordenes) {
          if (restante <= 0) break;

          let totalPedido = Number(ord.total || 0);
          if (totalPedido <= 0 && ord.items) {
            try {
              const items = typeof ord.items === 'string' ? JSON.parse(ord.items) : (ord.items || []);
              totalPedido = items.reduce((sum, item) => {
                const adicTotal = (item.adicionales || []).reduce((aSum, a) => aSum + (Number(a.precio || 0) * (a.cantidad || 1)), 0);
                return sum + ((Number(item.precio || 0) + adicTotal) * Number(item.cantidad || 1));
              }, 0);
            } catch (e) {}
          }

          const abonoPrevio = Number(ord.abono_parcial || 0);
          const saldoPendiente = Math.max(0, totalPedido - abonoPrevio);

          if (saldoPendiente <= 0) continue;

          if (restante >= saldoPendiente) {
            restante -= saldoPendiente;
            db.run(
              `UPDATE pedidos SET estado = 'cobrado', pagado = 1, abono_parcial = ?, ultimo_abono = ?, fecha_ultimo_abono = ?, metodo_pago_abono = ? WHERE id = ?`,
              [totalPedido, saldoPendiente, fechaHoy, metodo_pago || 'Efectivo', ord.id]
            );
            db.run(
              `INSERT INTO abonos_fiados (deudor, monto, metodo_pago, pedido_id, sesion_id) VALUES (?, ?, ?, ?, ?)`,
              [targetDeudor, saldoPendiente, metodo_pago || 'Efectivo', ord.id, sesion_id || null]
            );
          } else {
            const nuevoAbono = abonoPrevio + restante;
            db.run(
              `UPDATE pedidos SET abono_parcial = ?, ultimo_abono = ?, fecha_ultimo_abono = ?, metodo_pago_abono = ? WHERE id = ?`,
              [nuevoAbono, restante, fechaHoy, metodo_pago || 'Efectivo', ord.id]
            );
            db.run(
              `INSERT INTO abonos_fiados (deudor, monto, metodo_pago, pedido_id, sesion_id) VALUES (?, ?, ?, ?, ?)`,
              [targetDeudor, restante, metodo_pago || 'Efectivo', ord.id, sesion_id || null]
            );
            restante = 0;
          }
        }
      }

      db.run('COMMIT', (commitErr) => {
        if (commitErr) console.error("Commit abono aviso:", commitErr.message);
        if (io) {
          io.emit('credito_actualizado');
          io.emit('caja_actualizada');
          io.emit('pedidos_actualizados');
          io.emit('actualizar_pedidos');
          io.emit('dashboard:actualizado');
          io.emit('caja:estado');
        }
        return res.json({ success: true, deudor: targetDeudor, montoAbonado: montoAbono, remanenteNoAplicado: restante, mensaje: 'Abono registrado correctamente' });
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
  const { fecha, tipo_origen, mesa, total, metodo_pago, sesion_id, detalles, usuario, deudor, fecha_fiado, monto_efectivo, monto_transferencia, pedido_id } = req.body;
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
      if (pedido_id) {
        db.run(
          `UPDATE pedidos SET estado = 'cobrado', pagado = 1, caja_sesion_id = ? WHERE id = ? OR uuid = ?`,
          [sesion_id || null, pedido_id, pedido_id],
          () => {
            if (io) io.emit('pedidos_actualizados');
            emitirSincronizacionCompleta();
          }
        );
      }

      if (tipo_origen === 'Mesa' || (mesa && !String(mesa).toLowerCase().includes('deuda'))) {
        const mesaNum = String(mesa).replace(/\D/g, '');
        if (mesaNum) {
          db.run(`UPDATE mesas SET estado = 'libre' WHERE id = ? OR num = ?`, [mesaNum, mesaNum], () => {
            db.all('SELECT * FROM mesas', (errM, rowsM) => {
              if (!errM && io) io.emit('mesas_actualizadas', rowsM);
            });
          });
          db.run(
            `UPDATE pedidos SET estado = 'cobrado', pagado = 1, caja_sesion_id = ? WHERE (mesa = ? OR mesa = ?) AND estado NOT IN ('cobrado', 'cancelado', 'archivado', 'fiado', 'credito')`,
            [sesion_id || null, mesaNum, `Mesa ${mesaNum}`],

            () => {
              if (io) io.emit('pedidos_actualizados');
              emitirSincronizacionCompleta();

              // Asegurar vinculación en detalles_pedidos
              db.all(
                `SELECT id FROM pedidos WHERE (mesa = ? OR mesa = ?) AND estado = 'cobrado' ORDER BY id DESC LIMIT 1`,
                [mesaNum, `Mesa ${mesaNum}`],
                (errP, pRows) => {
                  if (!errP && pRows && pRows.length > 0 && Array.isArray(detalles) && detalles.length > 0) {
                    const targetPedId = pRows[0].id;
                    const stmtDP = db.prepare(`INSERT INTO detalles_pedidos (pedido_id, producto_id, cantidad, precio_unitario, subtotal, nombre) VALUES (?, ?, ?, ?, ?, ?)`);
                    detalles.forEach(d => {
                      stmtDP.run(targetPedId, d.producto_id || d.id, d.cantidad || 1, d.precio_unitario || 0, d.subtotal || 0, d.nombre_producto || d.nombre || '');
                    });
                    stmtDP.finalize();
                  }
                }
              );
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
