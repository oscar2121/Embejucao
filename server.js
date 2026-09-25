const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const http = require('http');
const { Server } = require('socket.io');

const JWT_SECRET = process.env.JWT_SECRET || 'embejucao_secreto_super_seguro_2026';

// Cargar variables de entorno desde .env local de forma manual (sin dependencias)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      let val = parts.slice(1).join('=').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  });
}

const app = express();
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const PORT = process.env.PORT || 3001;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// ─── CONEXIÓN Y MODULOS BACKEND ───
const { db, dbAll, dbGet } = require('./src/database/db');
const { hashPin, logAuditoria, obtenerBalanceTurnoActivo } = require('./src/utils/helpers');
const { setIO, getIO, broadcastComandasActivas, emitirSincronizacionCompleta, parsearItems } = require('./src/utils/socket');

// Vincular instancia Socket.io
setIO(io);

// Middleware para disponibilizar io en cada request
app.use((req, res, next) => {
  req.io = io;
  next();
});

// --- CONFIGURACIÓN SOCKET.IO ---
const usuariosConectados = new Map();

io.on('connection', async (socket) => {
  console.log(`🔌 Dispositivo conectado: ${socket.id}`);

  // Emitir estado de caja inmediato
  try {
    const sesion = await obtenerBalanceTurnoActivo();
    socket.emit('caja:estado', {
      abierta: Boolean(sesion),
      sesion: sesion,
      turno: sesion
    });
  } catch (e) {
    console.error('Error emitiendo estado de caja inicial:', e);
  }

  // Sincronización completa inmediata al conectar
  emitirSincronizacionCompleta(socket);

  // El cliente puede pedir sync manualmente
  socket.on('solicitar_sincronizacion', () => {
    emitirSincronizacionCompleta(socket);
  });

  // sync_datos legacy (mantener compatibilidad)
  socket.on('sync_datos', () => {
    emitirSincronizacionCompleta(socket);
  });

  socket.on('registrar_dispositivo', (data) => {
    const { rol, usuarioId } = data; // rol: 'cocina' | 'mesero', usuarioId: nombre del mesero
    if (rol === 'cocina') {
      socket.join('sala_cocina');
      console.log(`👨‍🍳 Cocina registrada: ${socket.id}`);
    } else if (rol === 'mesero') {
      socket.join(`sala_mesero_${usuarioId}`);
      usuariosConectados.set(usuarioId, socket.id);
      console.log(`🧑‍🍳 Mesero registrado: ${usuarioId} (${socket.id})`);
    }
  });

  // Socket listeners para Cocina y Pedidos en tiempo real
  socket.on('actualizar_pedido', (data) => {
    if (!data) return;
    const targetId = data.id || data.uuid;
    if (!targetId) return;

    db.get(`SELECT * FROM pedidos WHERE uuid = ? OR id = ?`, [targetId, targetId], (err, row) => {
      if (err || !row) return;
      const finalItems = data.items ? (typeof data.items === 'string' ? data.items : JSON.stringify(data.items)) : row.items;
      const finalEstado = data.estado || data.nuevoEstado || row.estado;

      db.run(`UPDATE pedidos SET items = ?, estado = ? WHERE id = ?`, [finalItems, finalEstado, row.id], (errUp) => {
        if (errUp) return;
        const parsedItems = typeof finalItems === 'string' ? JSON.parse(finalItems || '[]') : finalItems;
        io.emit('pedido_estado_cambiado', { uuid: row.uuid, id: row.id, items: parsedItems, nuevoEstado: finalEstado });
        io.emit('pedidos_actualizados');
        io.emit('actualizar_pedidos');
        broadcastComandasActivas();
      });
    });
  });

  socket.on('cocina_item_cambiado', (data) => {
    if (!data) return;
    const targetId = data.pedidoId || data.id || data.uuid;
    const itemIndex = data.itemIndex !== undefined ? data.itemIndex : data.itemIdx;
    const nuevoEstado = data.nuevoEstado;
    if (!targetId || itemIndex === undefined || !nuevoEstado) return;

    db.get(`SELECT * FROM pedidos WHERE uuid = ? OR id = ?`, [targetId, targetId], (err, row) => {
      if (err || !row) return;
      let items = [];
      try {
        items = JSON.parse(row.items || '[]');
      } catch (e) {
        items = [];
      }
      const idx = parseInt(itemIndex, 10);
      if (items[idx]) {
        items[idx].estado = nuevoEstado;
      }

      let nuevoEstadoPedido = row.estado || 'en_cocina';
      if (nuevoEstadoPedido === 'pendiente') {
        nuevoEstadoPedido = 'en_cocina';
      }
      if (['cobrado', 'cancelado', 'archivado', 'completado'].includes(String(nuevoEstadoPedido).toLowerCase())) {
        nuevoEstadoPedido = row.estado;
      }

      db.run(`UPDATE pedidos SET items = ?, estado = ? WHERE id = ?`, [JSON.stringify(items), nuevoEstadoPedido, row.id], (errUp) => {
        if (errUp) return;
        io.emit('pedido_estado_cambiado', { uuid: row.uuid, id: row.id, items, nuevoEstado: nuevoEstadoPedido });
        io.emit('cocina_item_cambiado', { pedidoId: row.uuid, id: row.id, itemIndex: idx, nuevoEstado });
        io.emit('pedidos_actualizados');
        io.emit('actualizar_pedidos');
        broadcastComandasActivas();
      });
    });
  });

  socket.on('cambiar_estado_comanda', (data) => {
    if (!data) return;
    const targetId = data.pedidoId || data.id || data.uuid;
    const nuevoEstado = data.nuevoEstado || data.estado;
    if (!targetId || !nuevoEstado) return;

    db.get(`SELECT * FROM pedidos WHERE uuid = ? OR id = ?`, [targetId, targetId], (err, row) => {
      if (err || !row) return;
      db.run(`UPDATE pedidos SET estado = ? WHERE id = ?`, [nuevoEstado, row.id], (errUp) => {
        if (errUp) return;
        const items = typeof row.items === 'string' ? JSON.parse(row.items || '[]') : (row.items || []);
        io.emit('pedido_estado_cambiado', { uuid: row.uuid, id: row.id, items, nuevoEstado });
        io.emit('pedidos_actualizados');
        io.emit('actualizar_pedidos');
        broadcastComandasActivas();
      });
    });
  });

  socket.on('disconnect', () => {
    for (let [usuarioId, socketId] of usuariosConectados.entries()) {
      if (socketId === socket.id) {
        usuariosConectados.delete(usuarioId);
        console.log(`❌ Mesero desconectado: ${usuarioId}`);
        break;
      }
    }
  });
});

app.use(cors());
app.use(express.json());

// LOG de todas las peticiones entrantes (debug)
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url} desde ${req.ip}`);
  next();
});

// ─── IMPORTACIÓN Y MONTAJE DE ROUTERS MODULARES ───
const cajaRoutes = require('./src/routes/caja.routes');
const mesasRoutes = require('./src/routes/mesas.routes');
const pedidosRoutes = require('./src/routes/pedidos.routes');

app.use('/api', cajaRoutes);
app.use('/', cajaRoutes); // Retrocompatibilidad con /pedidos/fiado
app.use('/api', mesasRoutes);
app.use('/api', pedidosRoutes);
app.use('/', pedidosRoutes); // Retrocompatibilidad con /pedidos

// ─── SUBIDA DE IMÁGENES ───
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'uploads', 'productos'))
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

app.post('/api/upload', upload.single('imagen'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
  res.json({ success: true, url: `/uploads/productos/${req.file.filename}` });
});

// ─── CATALOGO DE PRODUCTOS Y ADICIONALES ───
app.get('/api/adicionales', (req, res) => {
  db.all('SELECT * FROM adicionales ORDER BY nombre ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/adicionales', (req, res) => {
  const { nombre, precio } = req.body;
  if (!nombre || precio === undefined) return res.status(400).json({ error: 'Faltan datos' });
  db.run('INSERT INTO adicionales (nombre, precio, disponible) VALUES (?, ?, 1)', [nombre, precio], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, success: true });
  });
});

app.put('/api/adicionales/:id', (req, res) => {
  const { nombre, precio, disponible } = req.body;
  let query = 'UPDATE adicionales SET ';
  const params = [];
  
  if (nombre) { query += 'nombre = ?, '; params.push(nombre); }
  if (precio !== undefined) { query += 'precio = ?, '; params.push(precio); }
  if (disponible !== undefined) { query += 'disponible = ?, '; params.push(disponible ? 1 : 0); }
  
  query = query.slice(0, -2) + ' WHERE id = ?';
  params.push(req.params.id);
  
  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});

app.delete('/api/adicionales/:id', (req, res) => {
  db.run('DELETE FROM adicionales WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});

app.get('/api/productos/:id/insumos', (req, res) => {
  const { id } = req.params;
  db.all(`
    SELECT pi.id, pi.insumo_id, pi.cantidad, i.nombre, i.unidad, i.cantidad_actual
    FROM producto_insumos pi
    JOIN insumos i ON pi.insumo_id = i.id
    WHERE pi.producto_id = ?
  `, [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ingredientes: rows || [] });
  });
});

app.post('/api/productos/:id/insumos', (req, res) => {
  const productoId = req.params.id;
  const { ingredientes } = req.body;

  if (!Array.isArray(ingredientes)) {
    return res.status(400).json({ error: 'Formato de ingredientes inválido' });
  }

  db.serialize(() => {
    db.run(`DELETE FROM producto_insumos WHERE producto_id = ?`, [productoId], (errDel) => {
      if (errDel) return res.status(500).json({ error: errDel.message });

      if (ingredientes.length === 0) {
        return res.json({ success: true, count: 0 });
      }

      const stmt = db.prepare(`INSERT INTO producto_insumos (producto_id, insumo_id, cantidad) VALUES (?, ?, ?)`);
      for (const item of ingredientes) {
        if (item.insumo_id && Number(item.cantidad) > 0) {
          stmt.run([productoId, item.insumo_id, parseFloat(item.cantidad)]);
        }
      }
      stmt.finalize((errFinal) => {
        if (errFinal) return res.status(500).json({ error: errFinal.message });
        res.json({ success: true, count: ingredientes.length });
      });
    });
  });
});

app.get('/api/productos', (req, res) => {
  db.all(`SELECT * FROM productos ORDER BY cat ASC, nombre ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ productos: rows.map(r => ({ ...r, disp: !!r.disp })) });
  });
});

app.post('/api/productos', (req, res) => {
  const { id, cat, nombre, precio, desc, emoji, disp, usuario, imagen } = req.body;
  const dispVal = disp !== false ? 1 : 0;
  
  if (id) {
    db.run(
      `UPDATE productos SET cat=?, nombre=?, precio=?, desc=?, emoji=?, disp=?, imagen=? WHERE id=?`,
      [cat, nombre, precio, desc, emoji, dispVal, imagen, id],
      function (err) {
        if (err) return res.status(400).json({ error: err.message });
        logAuditoria(usuario, 'producto_editado', `Producto modificado: ${nombre} ($${precio})`);
        res.json({ success: true, updated: this.changes });
      }
    );
  } else {
    db.run(
      `INSERT INTO productos (cat, nombre, precio, desc, emoji, disp, imagen) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [cat, nombre, precio, desc, emoji, dispVal, imagen],
      function (err) {
        if (err) return res.status(400).json({ error: err.message });
        logAuditoria(usuario, 'producto_creado', `Nuevo producto agregado al catálogo: ${nombre} ($${precio})`);
        res.json({ success: true, id: this.lastID });
      }
    );
  }
});

app.put('/api/productos/:id', (req, res) => {
  const { nombre, precio, cat, activo } = req.body;
  const usuario = req.body.usuario || 'Admin';
  
  db.run(
    `UPDATE productos SET nombre = COALESCE(?, nombre), precio = COALESCE(?, precio), cat = COALESCE(?, cat), disp = COALESCE(?, disp) WHERE id = ?`,
    [nombre, precio, cat, activo !== undefined ? activo : 1, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      logAuditoria(usuario, 'producto_actualizado', `Producto modificado: ${nombre || req.params.id} ($${precio || 'Sin cambio'})`);
      res.json({ success: true, updatedID: req.params.id });
    }
  );
});

app.put('/api/productos/:id/disponibilidad', (req, res) => {
  const { disp, usuario } = req.body;
  db.get(`SELECT nombre FROM productos WHERE id = ?`, [req.params.id], (errGet, prod) => {
    const prodName = prod ? prod.nombre : 'Producto #' + req.params.id;
    db.run(
      `UPDATE productos SET disp = ? WHERE id = ?`,
      [disp ? 1 : 0, req.params.id],
      function (err) {
        if (err) return res.status(400).json({ error: err.message });
        logAuditoria(usuario, 'disponibilidad_cambiada', `Disponibilidad de ${prodName} cambiada a: ${disp ? 'Disponible' : 'No Disponible'}`);
        res.json({ success: true });
      }
    );
  });
});

app.delete('/api/productos/:id', (req, res) => {
  const { id } = req.params;
  const usuario = req.body?.usuario || 'Admin';
  
  db.get(`SELECT nombre FROM productos WHERE id = ?`, [id], (errGet, prod) => {
    const prodName = prod ? prod.nombre : 'Producto #' + id;
    db.run(`DELETE FROM productos WHERE id = ?`, [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      logAuditoria(usuario, 'producto_eliminado', `Producto eliminado: ${prodName}`);
      if (typeof io !== 'undefined') io.emit('productos_actualizados');
      res.json({ success: true, deleted: this.changes });
    });
  });
});

app.get('/api/categorias', (req, res) => {
  // Intenta sacar las de la tabla categorias, pero también de productos para no perder ninguna en la migración
  db.all(`SELECT id, nombre, color FROM categorias ORDER BY nombre ASC`, [], (err, rowsCat) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.all(`SELECT DISTINCT cat as categoria FROM productos WHERE cat IS NOT NULL AND cat != ''`, [], (err2, rowsProd) => {
      let categorias = [...(rowsCat || [])];
      
      // Añadir las que estén en productos pero no en categorias (migración silenciosa)
      if (rowsProd && rowsProd.length > 0) {
        rowsProd.forEach(p => {
          const n = String(p.categoria).trim();
          if (!categorias.find(c => String(c.nombre).trim().toLowerCase() === n.toLowerCase()) && isNaN(Number(n))) {
            categorias.push({ id: `temp-${n}`, nombre: n, color: '#cccccc' });
          }
        });
      }
      res.json({ categorias });
    });
  });
});

app.post('/api/categorias', (req, res) => {
  const { nombre, color } = req.body;
  db.run(`INSERT INTO categorias (nombre, color) VALUES (?, ?)`, [nombre, color || '#cccccc'], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: this.lastID, nombre, color });
  });
});

app.put('/api/categorias/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, nombreAntiguo } = req.body;
  
  const updateProducts = (oldName, newName) => {
    db.run(`UPDATE productos SET cat = ? WHERE cat = ?`, [newName, oldName], (err2) => {
      if (err2) console.error("Error en cascada:", err2);
      if (typeof io !== 'undefined') io.emit('productos_actualizados');
      res.json({ success: true });
    });
  };

  if (String(id).startsWith('temp-')) {
    // Es una categoría que solo existía en productos, la creamos ahora
    db.run(`INSERT INTO categorias (nombre, color) VALUES (?, ?)`, [nombre, '#cccccc'], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      updateProducts(nombreAntiguo, nombre);
    });
  } else {
    db.run(`UPDATE categorias SET nombre = ? WHERE id = ?`, [nombre, id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      updateProducts(nombreAntiguo, nombre);
    });
  }
});

app.delete('/api/categorias/:id', (req, res) => {
  const { id } = req.params;
  const nombre = req.query.nombre || req.body.nombre; 

  const deleteAndReassign = (catName) => {
    db.run(`UPDATE productos SET cat = 'Otros' WHERE cat = ?`, [catName], (errUpdate) => {
      if (errUpdate) console.error("Error reasignando productos:", errUpdate);
      
      if (!String(id).startsWith('temp-')) {
        db.run(`DELETE FROM categorias WHERE id = ?`, [id], function (errDel) {
           if (errDel) return res.status(500).json({ error: errDel.message });
           if (typeof io !== 'undefined') io.emit('productos_actualizados');
           res.json({ success: true });
        });
      } else {
         if (typeof io !== 'undefined') io.emit('productos_actualizados');
         res.json({ success: true });
      }
    });
  };

  if (nombre) {
    deleteAndReassign(nombre);
  } else {
    db.get(`SELECT nombre FROM categorias WHERE id = ?`, [id], (errGet, catRow) => {
      if (!catRow) return res.status(404).json({ error: "Categoría no encontrada" });
      deleteAndReassign(catRow.nombre);
    });
  }
});

// ─── GASTOS ───
app.post('/api/gastos', authorize(['admin', 'caja']), (req, res) => {
  const { descripcion, categoria, valor, fecha, sesion_id } = req.body;
  const fechaGasto = fecha || new Date().toISOString().split('T')[0];
  const usuarioResp = req.user ? req.user.nombre : 'Desconocido';

  const resolveSesionId = new Promise((resolve) => {
    if (sesion_id && sesion_id !== 1) {
      resolve(sesion_id);
    } else {
      db.get(`SELECT id FROM caja_sesiones WHERE estado = 'abierta' ORDER BY id DESC LIMIT 1`, [], (err, row) => {
        resolve(row ? row.id : null);
      });
    }
  });

  const valorLimpio = typeof valor === 'string'
    ? parseInt(valor.replace(/\D/g, ''), 10) || 0
    : Number(valor || 0);

  resolveSesionId.then((final_sesion_id) => {
    db.run(
      `INSERT INTO gastos (descripcion, categoria, valor, fecha, sesion_id, usuario) VALUES (?, ?, ?, ?, ?, ?)`,
      [descripcion, categoria, valorLimpio, fechaGasto, final_sesion_id, usuarioResp],
      async function (err) {
        if (err) return res.status(400).json({ error: err.message });
        logAuditoria(usuarioResp, 'gasto_registrado', `Gasto registrado: ${descripcion} ($${valorLimpio}) en cat. ${categoria}`);
        res.json({ success: true, id: this.lastID });

        if (typeof io !== 'undefined') {
          io.emit('dashboard:actualizado');
          io.emit('caja:estado');
        }

        try {
          const balanceActual = await obtenerBalanceTurnoActivo();
          io.emit('caja:estado', { abierta: Boolean(balanceActual), sesion: balanceActual, turno: balanceActual });
          io.emit('dashboard:actualizado');
        } catch (e) {
          console.error("Error emitiendo actualizacion de gasto", e);
        }
      }
    );
  });
});

app.get('/api/gastos', (req, res) => {
  db.all(`SELECT * FROM gastos ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ gastos: rows });
  });
});

// ─── FINANZAS / REPORTES ───
app.get('/api/finanzas/reporte', (req, res) => {
  db.get(`SELECT SUM(total) as total, COUNT(*) as count FROM ventas`, [], (err1, rTotal) => {
    const ingresosTot = rTotal ? rTotal.total || 0 : 0;
    const cantVentas = rTotal ? rTotal.count || 0 : 0;
    
    db.get(`SELECT SUM(valor) as total FROM gastos`, [], (err2, rGastos) => {
      const gastosTot = rGastos ? rGastos.total || 0 : 0;
      
      db.get(`SELECT SUM(valor) as total FROM gastos WHERE date(datetime(fecha, 'localtime')) = date('now', 'localtime')`, [], (errG, rG) => {
        const gastosHoy = rG ? rG.total || 0 : 0;
        
        db.get(`SELECT SUM(total) as total FROM ventas WHERE date(datetime(fecha, 'localtime')) = date('now', 'localtime')`, [], (err3, rHoy) => {
          const ventasHoy = rHoy ? rHoy.total || 0 : 0;
          
          db.get(`SELECT SUM(total) as total FROM ventas WHERE date(datetime(fecha, 'localtime')) >= date('now', '-6 days', 'localtime')`, [], (err4, rSemana) => {
            const ventasSemana = rSemana ? rSemana.total || 0 : 0;
            
            db.get(`SELECT SUM(total) as total FROM ventas WHERE strftime('%Y-%m', datetime(fecha, 'localtime')) = strftime('%Y-%m', 'now', 'localtime')`, [], (err5, rMes) => {
              const ventasMes = rMes ? rMes.total || 0 : 0;
              
              db.get(`SELECT SUM(total) as total FROM ventas WHERE metodo_pago = 'Efectivo'`, [], (errE, rEfectivo) => {
                const efectivo = rEfectivo ? rEfectivo.total || 0 : 0;
                
                db.get(`SELECT SUM(total) as total FROM ventas WHERE metodo_pago = 'Transferencia'`, [], (errT, rTransf) => {
                  const transferencia = rTransf ? rTransf.total || 0 : 0;
                  
                  const ticketPromedio = cantVentas > 0 ? (ingresosTot / cantVentas) : 0;
   
                  db.get(`SELECT COUNT(DISTINCT date(fecha)) as dias FROM ventas`, [], (errDays, rDays) => {
                    const diasConVentas = rDays ? rDays.dias || 1 : 1;
                    const promedioDiario = ingresosTot / (diasConVentas || 1);
   
                    db.get(`SELECT COUNT(DISTINCT strftime('%W-%Y', fecha)) as semanas FROM ventas`, [], (errWeeks, rWeeks) => {
                      const semanasConVentas = rWeeks ? rWeeks.semanas || 1 : 1;
                      const promedioSemanal = ingresosTot / (semanasConVentas || 1);
   
                      db.all(`SELECT * FROM gastos ORDER BY id DESC LIMIT 50`, [], (errList, listGastos) => {
                        db.all(`SELECT * FROM ventas ORDER BY id DESC LIMIT 50`, [], (errSales, listSales) => {
                          db.all(`SELECT nombre_producto, SUM(cantidad) as cantidad_total, SUM(subtotal) as total_generado FROM ventas_detalle GROUP BY nombre_producto ORDER BY cantidad_total DESC, total_generado DESC`, [], (errRank, rankList) => {
                            res.json({
                              ventasHoy,
                              ventasSemana,
                              ventasMes,
                              promedioDiario,
                              promedioSemanal,
                              ticketPromedio,
                              pagoEfectivo: efectivo,
                              pagoTransferencia: transferencia,
                              ingresosTotales: ingresosTot,
                              gastosTotales: gastosTot,
                              gastosHoy,
                              balanceActual: ingresosTot - gastosTot,
                              gastos: listGastos || [],
                              ventas: listSales || [],
                              rankingProductos: rankList || []
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

// GET - Dashboard Financiero Interactivo
app.get('/api/dashboard/financiero', authorize(['admin']), (req, res) => {
  const { rango, fecha } = req.query;
  const sqlFecha = (col) => `date(datetime(${col}), 'localtime')`;

  let dateConditionVentas = `${sqlFecha('fecha')} = date('now', 'localtime')`;
  let dateConditionGastos = `(${sqlFecha('fecha')} = date('now', 'localtime') OR substr(fecha, 1, 10) = date('now', 'localtime'))`;
  let dateConditionCaja = `${sqlFecha('fecha_apertura')} = date('now', 'localtime')`;

  if (rango === 'semana') {
    dateConditionVentas = `${sqlFecha('fecha')} >= date('now', '-6 days', 'localtime')`;
    dateConditionGastos = `(${sqlFecha('fecha')} >= date('now', '-6 days', 'localtime') OR substr(fecha, 1, 10) >= date('now', '-6 days', 'localtime'))`;
    dateConditionCaja = `${sqlFecha('fecha_apertura')} >= date('now', '-6 days', 'localtime')`;
  } else if (rango === 'mes') {
    dateConditionVentas = `strftime('%Y-%m', datetime(fecha), 'localtime') = strftime('%Y-%m', 'now', 'localtime')`;
    dateConditionGastos = `(strftime('%Y-%m', datetime(fecha), 'localtime') = strftime('%Y-%m', 'now', 'localtime') OR substr(fecha, 1, 7) = strftime('%Y-%m', 'now', 'localtime'))`;
    dateConditionCaja = `strftime('%Y-%m', datetime(fecha_apertura), 'localtime') = strftime('%Y-%m', 'now', 'localtime')`;
  } else if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    dateConditionVentas = `${sqlFecha('fecha')} = '${fecha}'`;
    dateConditionGastos = `(${sqlFecha('fecha')} = '${fecha}' OR substr(fecha, 1, 10) = '${fecha}')`;
    dateConditionCaja = `${sqlFecha('fecha_apertura')} = '${fecha}'`;
  } else if (rango && /^\d{4}-\d{2}-\d{2}$/.test(rango)) {
    dateConditionVentas = `${sqlFecha('fecha')} = '${rango}'`;
    dateConditionGastos = `(${sqlFecha('fecha')} = '${rango}' OR substr(fecha, 1, 10) = '${rango}')`;
    dateConditionCaja = `${sqlFecha('fecha_apertura')} = '${rango}'`;
  }

  const queryVentas = `
    SELECT 
      COALESCE(SUM(total), 0) AS total_ventas,
      COALESCE(SUM(CASE 
        WHEN LOWER(COALESCE(metodo_pago, '')) LIKE '%transfer%' 
          OR LOWER(COALESCE(metodo_pago, '')) LIKE '%nequi%' 
          OR LOWER(COALESCE(metodo_pago, '')) LIKE '%daviplata%' 
          OR LOWER(COALESCE(metodo_pago, '')) LIKE '%bancolombia%' 
        THEN total ELSE 0 END), 0) AS total_transferencia,
      COALESCE(SUM(CASE 
        WHEN LOWER(COALESCE(metodo_pago, '')) LIKE '%efectivo%' 
          OR metodo_pago IS NULL 
          OR TRIM(metodo_pago) = '' 
        THEN total ELSE 0 END), 0) AS total_efectivo
    FROM ventas 
    WHERE ${dateConditionVentas}
  `;

  db.get(queryVentas, [], (err, rVentas) => {
    if (err) console.error('Error calculando ventas:', err);
    
    const ventas = Number(rVentas?.total_ventas || 0);
    let transferencia = Number(rVentas?.total_transferencia || 0);
    let efectivo = Number(rVentas?.total_efectivo || 0);

    console.log(`[DASHBOARD DEBUG] Rango: ${rango || 'hoy'} | Ventas: ${ventas} | Efe: ${efectivo} | Trans: ${transferencia}`);
    
    db.get(`SELECT COALESCE(SUM(valor), 0) as total FROM gastos WHERE ${dateConditionGastos}`, [], (err, rGastos) => {
      const gastos = Number(rGastos?.total || 0);
      
      db.all(`SELECT categoria, SUM(valor) as total FROM gastos WHERE ${dateConditionGastos} GROUP BY categoria`, [], (err, catList) => {
        const gastosPorCategoria = catList || [];
        
        db.all(`SELECT * FROM gastos WHERE ${dateConditionGastos} ORDER BY id DESC LIMIT 50`, [], (err, ultimosGastos) => {
          let flowSelect = "strftime('%H:00', datetime(fecha, 'localtime')) as label";
          if (rango === 'semana' || rango === 'mes') {
            flowSelect = `substr(${sqlFecha('fecha')}, 1, 10) as label`;
          }

          db.all(`SELECT ${flowSelect}, SUM(total) as total FROM ventas WHERE ${dateConditionVentas} GROUP BY label ORDER BY label ASC`, [], (err, flujoVentas) => {
            db.all(`SELECT ${flowSelect}, SUM(valor) as total FROM gastos WHERE ${dateConditionGastos} GROUP BY label ORDER BY label ASC`, [], (err, flujoGastos) => {
              
              const fVentas = flujoVentas || [];
              const fGastos = flujoGastos || [];
              const labels = [...new Set([...fVentas.map(v => v.label), ...fGastos.map(g => g.label)])].sort();
              const comparativaData = labels.map(label => {
                const v = fVentas.find(x => x.label === label);
                const g = fGastos.find(x => x.label === label);
                return {
                  label,
                  ingresos: v ? v.total : 0,
                  gastos: g ? g.total : 0
                };
              });

              db.all(`SELECT * FROM caja_sesiones WHERE ${dateConditionCaja} ORDER BY id DESC`, [], async (err, cajaSesiones) => {
                const sesionActiva = await obtenerBalanceTurnoActivo();
                console.log("🔍 SESION ENVIADA AL DASHBOARD:", sesionActiva);

                res.json({
                  rango: rango || 'hoy',
                  ventas,
                  gastos,
                  balance: ventas - gastos,
                  gastosPorCategoria,
                  ultimosGastos: ultimosGastos || [],
                  efectivo,
                  transferencia,
                  comparativaData,
                  flujoVentas: fVentas,
                  flujoGastos: fGastos,
                  cajaSesiones: cajaSesiones || [],
                  sesion: sesionActiva,
                  cajaAbierta: Boolean(sesionActiva)
                });
              });
            });
          });
        });
      });
    });
  });
});

// ─── INVENTARIO (INSUMOS Y MOVIMIENTOS) ───
app.get('/api/inventario/insumos', (req, res) => {
  db.all(`SELECT * FROM insumos ORDER BY nombre ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ insumos: rows });
  });
});

app.post('/api/inventario/insumos', (req, res) => {
  const { nombre, unidad, cantidad_actual, stock_minimo, precio_compra, usuario, metodo_pago } = req.body;
  
  db.run(
    `INSERT INTO insumos (nombre, unidad, cantidad_actual, stock_minimo, precio_compra) VALUES (?, ?, ?, ?, ?)`,
    [nombre, unidad, cantidad_actual || 0, stock_minimo || 0, precio_compra || 0],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      const insumoId = this.lastID;
      logAuditoria(usuario, 'insumo_creado', `Insumo registrado: ${nombre} (${cantidad_actual} ${unidad})`);
      
      const costoTotalCompra = (parseFloat(cantidad_actual) || 0) * (parseFloat(precio_compra) || 0);
      if (costoTotalCompra > 0) {
        const formaPagoGasto = (metodo_pago || 'efectivo').toLowerCase();
        const fechaGasto = new Date().toISOString();

        db.run(`
          INSERT INTO gastos (descripcion, monto, categoria, metodo_pago, fecha)
          VALUES (?, ?, 'Insumos', ?, ?)
        `, [`Compra inicial: ${nombre}`, costoTotalCompra, formaPagoGasto, fechaGasto], () => {
          if (typeof io !== 'undefined') io.emit('dashboard:actualizado');
        });
      }

      res.json({ success: true, id: insumoId });
    }
  );
});

app.post('/api/inventario/insumos/:id/movimiento', (req, res) => {
  const insumoId = req.params.id;
  const { tipo, cantidad, motivo, fecha, usuario } = req.body;
  const fechaMov = fecha || new Date().toISOString().split('T')[0];

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    db.get(`SELECT nombre, cantidad_actual, precio_compra, unidad FROM insumos WHERE id = ?`, [insumoId], (errInsumo, insumo) => {
      if (errInsumo || !insumo) {
        db.run("ROLLBACK");
        return res.status(404).json({ error: 'Insumo no encontrado' });
      }

      let nuevaCantidad = insumo.cantidad_actual;
      if (tipo === 'entrada') {
        nuevaCantidad += parseFloat(cantidad);
      } else if (tipo === 'ajuste') {
        nuevaCantidad = parseFloat(cantidad);
      }

      db.run(
        `INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, fecha, motivo) VALUES (?, ?, ?, ?, ?)`,
        [insumoId, tipo, cantidad, fechaMov, motivo || 'Sin motivo'],
        function (errInsert) {
          if (errInsert) {
            db.run("ROLLBACK");
            return res.status(400).json({ error: errInsert.message });
          }

          db.run(
            `UPDATE insumos SET cantidad_actual = ? WHERE id = ?`,
            [nuevaCantidad, insumoId],
            (errUpdate) => {
              if (errUpdate) {
                db.run("ROLLBACK");
                return res.status(400).json({ error: errUpdate.message });
              }

              db.run("COMMIT");
              const accionAuditoria = tipo === 'entrada' ? 'entrada_inventario' : 'ajuste_inventario';
              const detalleAuditoria = tipo === 'entrada' 
                ? `Entrada de ${cantidad} unidades de ${insumo.nombre}. Motivo: ${motivo}`
                : `Ajuste de stock de ${insumo.nombre} a ${cantidad} unidades. Motivo: ${motivo}`;
              logAuditoria(usuario, accionAuditoria, detalleAuditoria);

              if (tipo === 'entrada') {
                const precioUnit = parseFloat(req.body.precio_compra) || parseFloat(insumo.precio_compra) || 0;
                const subtotalGasto = parseFloat(cantidad) * precioUnit;
                if (subtotalGasto > 0) {
                  const formaPago = (req.body.metodo_pago || 'efectivo').toLowerCase();
                  db.run(`
                    INSERT INTO gastos (descripcion, monto, categoria, metodo_pago, fecha)
                    VALUES (?, ?, 'Insumos', ?, ?)
                  `, [`Entrada insumo: ${insumo.nombre} (${cantidad} ${insumo.unidad})`, subtotalGasto, formaPago, new Date().toISOString()], () => {
                    if (typeof io !== 'undefined') io.emit('dashboard:actualizado');
                  });
                }
              }

              res.json({ success: true, insumo_id: insumoId });
            }
          );
        }
      );
    });
  });
});

app.get('/api/inventario/movimientos', (req, res) => {
  db.all(
    `SELECT m.*, i.nombre as insumo_nombre, i.unidad 
     FROM movimientos_inventario m 
     JOIN insumos i ON m.insumo_id = i.id 
     ORDER BY m.id DESC LIMIT 100`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ movimientos: rows });
    }
  );
});

// ─── SEGURIDAD / LOGIN ───
const loginAttempts = {};

function authorize(rolesPermitidos = []) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Falta token de autenticación' });
    }
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      
      if (rolesPermitidos.length === 0) return next();
      
      const tieneRol = req.user.roles && req.user.roles.some(rol => rolesPermitidos.includes(rol));
      if (!tieneRol) {
        return res.status(403).json({ error: 'No tienes permisos suficientes (Roles requeridos: ' + rolesPermitidos.join(', ') + ')' });
      }
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
  };
}

app.post('/api/login', (req, res) => {
  const { usuario, pin } = req.body;
  if (!usuario || !pin) {
    return res.status(400).json({ success: false, message: 'Usuario y PIN requeridos' });
  }

  const now = Date.now();
  if (loginAttempts[usuario] && loginAttempts[usuario].bloqueadoHasta && loginAttempts[usuario].bloqueadoHasta > now) {
    const restante = Math.ceil((loginAttempts[usuario].bloqueadoHasta - now) / 1000);
    return res.json({ 
      success: false, 
      message: `Bloqueado temporalmente. Intente en ${restante} segundos.` 
    });
  }

  const hashedPin = hashPin(pin);

  db.get(`SELECT * FROM usuarios WHERE nombre = ?`, [usuario], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!row) {
      return res.json({ success: false, message: 'Usuario no encontrado' });
    }
    if (!row.activo) {
      return res.json({ success: false, message: 'El usuario se encuentra desactivado' });
    }

    if (row.pin !== hashedPin) {
      if (!loginAttempts[usuario]) {
        loginAttempts[usuario] = { intentos: 0, bloqueadoHasta: null };
      }
      loginAttempts[usuario].intentos += 1;
      
      let msg = 'PIN incorrecto.';
      if (loginAttempts[usuario].intentos >= 5) {
        loginAttempts[usuario].bloqueadoHasta = Date.now() + 30000;
        loginAttempts[usuario].intentos = 0;
        msg = 'Demasiados intentos fallidos. Cuenta bloqueada por 30 segundos.';
      } else {
        msg += ` Intentos restantes: ${5 - loginAttempts[usuario].intentos}`;
      }

      logAuditoria(usuario, 'login_fallido', `Intento de login fallido. Razón: PIN incorrecto.`);
      return res.json({ success: false, message: msg });
    }

    if (loginAttempts[usuario]) {
      loginAttempts[usuario].intentos = 0;
      loginAttempts[usuario].bloqueadoHasta = null;
    }

    db.all(`SELECT rol_id FROM usuario_roles WHERE usuario_id = ?`, [row.id], (errRoles, rolesRows) => {
      let roles = [];
      if (!errRoles && rolesRows && rolesRows.length > 0) {
        roles = rolesRows.map(r => r.rol_id);
      } else if (row.rol) {
        roles = [row.rol];
      }

      const isAdmin = roles.includes('admin');
      const forcePinChange = (isAdmin && hashedPin === hashPin('1234'));

      logAuditoria(row.nombre, 'login', `Inicio de sesión exitoso con roles: ${roles.join(', ')}`);

      const tokenPayload = {
        id: row.id,
        nombre: row.nombre,
        roles: roles
      };
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '12h' });

      res.json({ 
        success: true, 
        usuario: row.nombre, 
        roles: roles,
        token: token,
        forcePinChange 
      });
    });
  });
});

app.post('/api/logout', (req, res) => {
  const { usuario } = req.body;
  logAuditoria(usuario, 'logout', `Sesión cerrada`);
  res.json({ success: true });
});

// ─── GESTIÓN DE USUARIOS ───
app.get('/api/usuarios', (req, res) => {
  const query = `
    SELECT u.id, u.nombre, u.rol as legacy_rol, u.activo, GROUP_CONCAT(ur.rol_id) as roles
    FROM usuarios u
    LEFT JOIN usuario_roles ur ON u.id = ur.usuario_id
    GROUP BY u.id
    ORDER BY u.nombre ASC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const usuarios = rows.map(r => ({
      id: r.id,
      nombre: r.nombre,
      activo: r.activo,
      roles: r.roles ? r.roles.split(',') : (r.legacy_rol ? [r.legacy_rol] : [])
    }));
    res.json({ usuarios });
  });
});

app.post('/api/usuarios', authorize(['admin']), (req, res) => {
  const { id, nombre, pin, roles, activo, administrador_usuario } = req.body;
  const dbRoles = Array.isArray(roles) ? roles : [];
  const legacyRol = dbRoles[0] || 'pedido';
  
  const syncRoles = (userId, successMessage, res) => {
    db.run(`DELETE FROM usuario_roles WHERE usuario_id = ?`, [userId], function(err) {
      if (err) return res.status(400).json({ error: err.message });
      if (dbRoles.length === 0) {
        logAuditoria(administrador_usuario || req.user?.nombre || 'Admin', id ? 'usuario_editado' : 'usuario_creado', successMessage);
        return res.json({ success: true, id: userId });
      }
      
      let placeholders = dbRoles.map(() => '(?, ?)').join(',');
      let params = [];
      dbRoles.forEach(r => { params.push(userId, r); });
      
      db.run(`INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ${placeholders}`, params, function(err2) {
        if (err2) return res.status(400).json({ error: err2.message });
        logAuditoria(administrador_usuario || req.user?.nombre || 'Admin', id ? 'usuario_editado' : 'usuario_creado', successMessage);
        res.json({ success: true, id: userId });
      });
    });
  };

  if (id) {
    if (pin) {
      if (pin.length < 4 || pin.length > 6 || isNaN(Number(pin))) {
        return res.status(400).json({ error: 'El PIN debe tener entre 4 y 6 dígitos' });
      }
      const hashed = hashPin(pin);
      db.run(`UPDATE usuarios SET nombre=?, pin=?, rol=? WHERE id=?`, [nombre, hashed, legacyRol, id], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        syncRoles(id, `PIN, roles y datos actualizados para usuario: ${nombre}`, res);
      });
    } else {
      db.run(`UPDATE usuarios SET nombre=?, rol=? WHERE id=?`, [nombre, legacyRol, id], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        syncRoles(id, `Datos y roles actualizados para usuario: ${nombre}`, res);
      });
    }
  } else {
    if (!pin || pin.length < 4 || pin.length > 6 || isNaN(Number(pin))) {
      return res.status(400).json({ error: 'El PIN debe tener entre 4 y 6 dígitos' });
    }
    const hashed = hashPin(pin);
    const activoVal = activo !== false ? 1 : 0;
    db.run(`INSERT INTO usuarios (nombre, pin, rol, activo) VALUES (?, ?, ?, ?)`, [nombre, hashed, legacyRol, activoVal], function (err) {
      if (err) return res.status(400).json({ error: err.message });
      syncRoles(this.lastID, `Nuevo usuario creado: ${nombre} (${dbRoles.join(', ')})`, res);
    });
  }
});

app.put('/api/usuarios/:id/estado', authorize(['admin']), (req, res) => {
  const { id } = req.params;
  const { activo, administrador_usuario } = req.body;
  const activoVal = activo ? 1 : 0;

  db.get(`SELECT nombre FROM usuarios WHERE id = ?`, [id], (errGet, userRow) => {
    if (errGet || !userRow) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    db.run(`UPDATE usuarios SET activo = ? WHERE id = ?`, [activoVal, id], function (err) {
      if (err) return res.status(400).json({ error: err.message });
      const accionStr = activo ? 'usuario_activado' : 'usuario_desactivado';
      const detalleStr = activo ? `Usuario reactivado: ${userRow.nombre}` : `Usuario desactivado: ${userRow.nombre}`;
      logAuditoria(administrador_usuario || req.user?.nombre || 'Admin', accionStr, detalleStr);
      res.json({ success: true });
    });
  });
});

app.delete('/api/usuarios/:id', authorize(['admin']), (req, res) => {
  const { id } = req.params;
  const { administrador_usuario } = req.body;

  db.get(`SELECT nombre FROM usuarios WHERE id = ?`, [id], (errGet, userRow) => {
    if (errGet || !userRow) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    db.run(`DELETE FROM usuarios WHERE id = ?`, [id], function(err) {
      if (err) return res.status(400).json({ error: err.message });
      db.run(`DELETE FROM usuario_roles WHERE usuario_id = ?`, [id]);
      logAuditoria(administrador_usuario || req.user?.nombre || 'Admin', 'usuario_eliminado', `Usuario eliminado permanentemente: ${userRow.nombre}`);
      res.json({ success: true });
    });
  });
});

// ─── HISTORIAL DE AUDITORÍA ───
app.get('/api/auditoria', authorize(['admin']), (req, res) => {
  const { usuario, fecha, accion } = req.query;
  let query = `SELECT * FROM auditoria WHERE 1=1`;
  const params = [];

  if (usuario) {
    query += ` AND usuario = ?`;
    params.push(usuario);
  }
  if (fecha) {
    query += ` AND date(fecha) = date(?)`;
    params.push(fecha);
  }
  if (accion) {
    query += ` AND accion = ?`;
    params.push(accion);
  }

  query += ` ORDER BY id DESC LIMIT 200`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ logs: rows });
  });
});

// ─── SISTEMA DE ACTUALIZACIONES AUTOMÁTICAS (GITHUB PRIVADO) ───
app.get('/api/download-asset/:assetId/:filename', async (req, res) => {
  const { assetId, filename } = req.params;
  const token = process.env.GITHUB_TOKEN;
  
  if (!token || token === 'tu_token_personal_de_github_aqui') {
    console.error('❌ Error de actualización: GITHUB_TOKEN no configurado en el servidor.');
    return res.status(500).json({ error: 'GitHub Token no configurado en el servidor' });
  }

  try {
    console.log(`📡 Descargando asset de GitHub: ID ${assetId} (${filename})...`);
    const response = await axios({
      method: 'get',
      url: `https://api.github.com/repos/oscar2121/Embejucao/releases/assets/${assetId}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/octet-stream',
        'User-Agent': 'Node-Express-Server'
      },
      responseType: 'stream',
      timeout: 60000
    });

    let contentType = 'application/octet-stream';
    if (filename.toLowerCase().endsWith('.apk')) {
      contentType = 'application/vnd.android.package-archive';
    } else if (filename.toLowerCase().endsWith('.zip')) {
      contentType = 'application/zip';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    response.data.pipe(res);
  } catch (error) {
    console.error(`❌ Error al descargar asset (${filename}) de GitHub:`, error.message);
    res.status(500).json({ error: 'Error al descargar el archivo desde GitHub', details: error.message });
  }
});

app.get('/api/check-update', async (req, res) => {
  const platform = req.query.platform || 'mobile';
  
  try {
    console.log(`📡 Buscando última release en GitHub para plataforma: ${platform}...`);
    const response = await axios.get(
      'https://api.github.com/repos/oscar2121/Embejucao/releases/latest',
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Embejucao-App'
        },
        timeout: 10000
      }
    );

    const release = response.data;
    const latestVersion = release.tag_name ? release.tag_name.replace(/^v/, '') : '';

    const notes = release.body 
      ? release.body.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0)
      : [];

    let downloadUrl = null;
    if (release.assets && Array.isArray(release.assets)) {
      const asset = release.assets.find(a => {
        const name = a.name.toLowerCase();
        return platform === 'mobile' ? name.endsWith('.apk') : name.endsWith('.exe');
      });
      if (asset) {
        downloadUrl = asset.browser_download_url;
      }
    }

    res.json({
      updateAvailable: true,
      latestVersion,
      releaseNotes: notes,
      downloadUrl
    });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.json({ updateAvailable: false, message: 'Sin releases disponibles' });
    }
    console.error('❌ Error al buscar actualizaciones en GitHub:', error.message);
    res.json({ updateAvailable: false, message: 'Error de red o límite de GitHub' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Iniciar servidor
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📡 API disponible en http://localhost:${PORT}/api`);
});

process.on('SIGINT', () => {
  db.close();
  process.exit();
});
