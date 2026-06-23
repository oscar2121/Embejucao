const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const axios = require('axios');

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
      // Quitar comillas si existen
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  });
}


const app = express();
const PORT = process.env.PORT || 3001;
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// --- CONFIGURACIÓN SOCKET.IO ---
const usuariosConectados = new Map(); // mesero_id -> socket_id

io.on('connection', (socket) => {
  console.log(`🔌 Dispositivo conectado: ${socket.id}`);

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

// ─── BASE DE DATOS ─────────────────────────────────────────
const dbPath = path.join(__dirname, 'embejucao.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Error opening DB:', err);
  else console.log('✅ Base de datos conectada:', dbPath);
});

// Hashing helper
const hashPin = (pin, salt = 'embejucao-shared-key-2026') => {
  return crypto.createHmac('sha256', salt).update(pin).digest('hex');
};

// Auxiliar de auditoría
const logAuditoria = (usuario, accion, detalle) => {
  const ahora = new Date().toISOString();
  db.run(
    `INSERT INTO auditoria (fecha, usuario, accion, detalle) VALUES (?, ?, ?, ?)`,
    [ahora, usuario || 'Sistema', accion, detalle || ''],
    (err) => {
      if (err) console.error('Error writing to audit log:', err);
    }
  );
};

// Inicializar tablas y migraciones
db.serialize(() => {
  // Tablas Existentes (Pedidos y Mesas)
  db.run(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      mesa INTEGER,
      fecha TEXT,
      hora TEXT,
      items TEXT,
      estado TEXT DEFAULT 'activo',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS mesas (
      id INTEGER PRIMARY KEY,
      num INTEGER,
      estado TEXT,
      fecha TEXT DEFAULT CURRENT_DATE
    )
  `);

  // --- NUEVAS TABLAS PARA LA AMPLIACIÓN ---

  // 1. Productos persistentes
  db.run(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cat INTEGER,
      nombre TEXT UNIQUE,
      precio REAL,
      desc TEXT,
      emoji TEXT,
      disp INTEGER DEFAULT 1
    )
  `);

  // 2. Ventas permanentes
  db.run(`
    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT,
      tipo_origen TEXT,
      mesa TEXT,
      total REAL,
      metodo_pago TEXT,
      sesion_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 3. Gastos
  db.run(`
    CREATE TABLE IF NOT EXISTS gastos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      descripcion TEXT,
      categoria TEXT,
      valor REAL,
      fecha TEXT,
      sesion_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Insumos (Inventario)
  db.run(`
    CREATE TABLE IF NOT EXISTS insumos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE,
      unidad TEXT,
      cantidad_actual REAL DEFAULT 0,
      stock_minimo REAL DEFAULT 0,
      precio_compra REAL DEFAULT 0
    )
  `);

  // 5. Movimientos Inventario
  db.run(`
    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      insumo_id INTEGER,
      tipo TEXT,
      cantidad REAL,
      fecha TEXT,
      motivo TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(insumo_id) REFERENCES insumos(id)
    )
  `);

  // 6. Pedidos Cancelados
  db.run(`
    CREATE TABLE IF NOT EXISTS pedidos_cancelados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT,
      mesa TEXT,
      items TEXT,
      motivo TEXT,
      usuario TEXT,
      estado TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 7. Sesiones de Caja
  db.run(`
    CREATE TABLE IF NOT EXISTS caja_sesiones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha_apertura TEXT,
      fecha_cierre TEXT,
      base_inicial REAL,
      saldo_final_real REAL,
      estado TEXT DEFAULT 'abierta'
    )
  `);

  // 8. Usuarios
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE,
      pin TEXT,
      rol TEXT,
      activo INTEGER DEFAULT 1
    )
  `);

  // 9. Ventas Detalle
  db.run(`
    CREATE TABLE IF NOT EXISTS ventas_detalle (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER,
      producto_id INTEGER,
      nombre_producto TEXT,
      cantidad INTEGER,
      precio_unitario REAL,
      subtotal REAL,
      FOREIGN KEY(venta_id) REFERENCES ventas(id)
    )
  `);

  // 10. Auditoría
  db.run(`
    CREATE TABLE IF NOT EXISTS auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT,
      usuario TEXT,
      accion TEXT,
      detalle TEXT
    )
  `);

  // Migraciones seguras (agregar columnas si no existen)
  db.run(`ALTER TABLE ventas ADD COLUMN deudor TEXT`, () => {});
  db.run(`ALTER TABLE ventas ADD COLUMN fecha_fiado TEXT`, () => {});
  db.run(`ALTER TABLE pedidos ADD COLUMN deudor TEXT`, () => {});
  db.run(`ALTER TABLE pedidos ADD COLUMN fecha_fiado TEXT`, () => {});
  db.run(`ALTER TABLE pedidos ADD COLUMN mesero_id TEXT`, () => {});

  console.log('✅ Estructuras de tablas inicializadas de forma segura');

  // Inicializar usuarios por defecto
  db.get(`SELECT COUNT(*) as count FROM usuarios`, (err, row) => {
    if (err) {
      console.error('Error checking usuarios table:', err);
      return;
    }
    if (row.count === 0) {
      const USUARIOS_INICIAL = [
        { nombre: "Administrador", pin: hashPin("1234"), rol: "admin", activo: 1 },
        { nombre: "Caja", pin: hashPin("1111"), rol: "caja", activo: 1 },
        { nombre: "Mesero", pin: hashPin("2222"), rol: "pedido", activo: 1 },
        { nombre: "Cocina", pin: hashPin("3333"), rol: "cocina", activo: 1 },
        { nombre: "Bar", pin: hashPin("4444",), rol: "bar", activo: 1 }
      ];
      const stmt = db.prepare(`INSERT OR IGNORE INTO usuarios (nombre, pin, rol, activo) VALUES (?, ?, ?, ?)`);
      USUARIOS_INICIAL.forEach(u => {
        stmt.run(u.nombre, u.pin, u.rol, u.activo);
      });
      stmt.finalize();
      console.log('✅ Usuarios iniciales cargados en SQLite');
    }
  });

  // Inicializar productos del catálogo si está vacío
  db.get(`SELECT COUNT(*) as count FROM productos`, (err, row) => {
    if (err) {
      console.error('Error checking productos table:', err);
      return;
    }
    if (row.count === 0) {
      const PRODUCTOS_INICIAL = [
        { id: 101, cat: 1, nombre: "Clásica", precio: 16000, desc: "Pan artesanal, 125g carne res, queso, vegetales, cebolla en salsa, papa chip", emoji: "🍔", disp: 1 },
        { id: 102, cat: 1, nombre: "Especial", precio: 18000, desc: "Pan artesanal, tocineta, plátano maduro, queso, vegetales, papa chip", emoji: "🍔", disp: 1 },
        { id: 103, cat: 1, nombre: "Doble Carne", precio: 22000, desc: "Pan artesanal, 250g carne res, queso, vegetales, cebolla en salsa, papa chip", emoji: "🍔", disp: 1 },
        { id: 104, cat: 1, nombre: "Mexicana", precio: 18000, desc: "Pan artesanal, carne res, pico de gallo, nachos, jalapeños", emoji: "🍔", disp: 1 },
        { id: 201, cat: 2, nombre: "Sencillo", precio: 13000, desc: "Pan artesanal, salchicha, cebolla en salsa, papa chip, queso gratinado con maíz dulce", emoji: "🌭", disp: 1 },
        { id: 202, cat: 2, nombre: "Choriperro", precio: 14000, desc: "Pan artesanal, chorizo, tocineta, cebolla en salsa, papa chip y queso gratinado", emoji: "🌭", disp: 1 },
        { id: 203, cat: 2, nombre: "Especial", precio: 16000, desc: "Pan artesanal, salchicha ranchera, plátano, tocineta, papa chip, queso gratinado", emoji: "🌭", disp: 1 },
        { id: 301, cat: 3, nombre: "Burrito Carne", precio: 16000, desc: "Carne desmechada, plátano maduro, queso, salchicha y maíz dulce", emoji: "🌯", disp: 1 },
        { id: 302, cat: 3, nombre: "Burrito Pollo", precio: 16000, desc: "Pollo desmechado, plátano maduro, queso, salchicha y maíz dulce", emoji: "🌯", disp: 1 },
        { id: 303, cat: 3, nombre: "Burrito Mixto", precio: 16000, desc: "Carne y pollo desmechado, plátano maduro, queso, salchicha y maíz dulce", emoji: "🌯", disp: 1 },
        { id: 401, cat: 4, nombre: "Sencilla", precio: 13000, desc: "300g papa francesa, salchicha y queso gratinado con maíz dulce", emoji: "🍟", disp: 1 },
        { id: 402, cat: 4, nombre: "Especial", precio: 20000, desc: "Papa francesa, carne, pollo, lechuga, papa chip, tocineta, chorizo, queso gratinado, salsa de la casa", emoji: "🍟", disp: 1 },
        { id: 501, cat: 5, nombre: "Mazorcada Especial", precio: 20000, desc: "Maíz dulce, salchicha, pollo, carne desmechada, tocineta, papa chip, salsa de la casa", emoji: "🌽", disp: 1 },
        { id: 601, cat: 6, nombre: "Jugo Agua 12oz", precio: 9000, desc: "Mandarina, Maracuyá, Lulo, Mora, Naranja, Mango, Guanábana o Fresa", emoji: "🥤", disp: 1 },
        { id: 602, cat: 6, nombre: "Jugo Agua 16oz", precio: 12000, desc: "Mandarina, Maracuyá, Lulo, Mora, Naranja, Mango, Guanábana o Fresa", emoji: "🥤", disp: 1 },
        { id: 603, cat: 6, nombre: "Jugo Leche 12oz", precio: 11000, desc: "Mandarina, Maracuyá, Lulo, Mora, Naranja, Mango, Guanábana o Fresa", emoji: "🥛", disp: 1 },
        { id: 604, cat: 6, nombre: "Jugo Leche 16oz", precio: 13000, desc: "Mandarina, Maracuyá, Lulo, Mora, Naranja, Mango, Guanábana o Fresa", emoji: "🥛", disp: 1 },
        { id: 605, cat: 6, nombre: "Jugo Combinado", precio: 9000, desc: "Sandía-Fresa-Limón / Maracuyá-Mango / Manzana-Piña-Hierbabuena", emoji: "🍹", disp: 1 },
        { id: 701, cat: 7, nombre: "Limonada Mango 12oz", precio: 9000, desc: "Limonada de mango natural", emoji: "🍋", disp: 1 },
        { id: 702, cat: 7, nombre: "Limonada Mango 16oz", precio: 12000, desc: "Limonada de mango natural", emoji: "🍋", disp: 1 },
        { id: 703, cat: 7, nombre: "Limonada Hierbabuena 12oz", precio: 9000, desc: "Limonada de hierbabuena fresca", emoji: "🍋", disp: 1 },
        { id: 704, cat: 7, nombre: "Limonada Hierbabuena 16oz", precio: 12000, desc: "Limonada de hierbabuena fresca", emoji: "🍋", disp: 1 },
        { id: 705, cat: 7, nombre: "Limonada Coco 12oz", precio: 9000, desc: "Limonada de coco tropical", emoji: "🍋", disp: 1 },
        { id: 706, cat: 7, nombre: "Limonada Coco 16oz", precio: 12000, desc: "Limonada de coco tropical", emoji: "🍋", disp: 1 },
        { id: 801, cat: 8, nombre: "Cerveza Club Colombia", precio: 6000, desc: "Cerveza nacional dorada", emoji: "🍺", disp: 1 },
        { id: 802, cat: 8, nombre: "Cerveza Corona", precio: 8000, desc: "Cerveza importada", emoji: "🍺", disp: 1 },
        { id: 803, cat: 8, nombre: "Gaseosa 350ml", precio: 4000, desc: "Coca-Cola, Postobón o Pepsi", emoji: "🥤", disp: 1 },
      ];

      const stmt = db.prepare(`INSERT OR IGNORE INTO productos (id, cat, nombre, precio, desc, emoji, disp) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      PRODUCTOS_INICIAL.forEach(p => {
        stmt.run(p.id, p.cat, p.nombre, p.precio, p.desc, p.emoji, p.disp);
      });
      stmt.finalize();
      console.log('✅ Catálogo de productos inicial cargado en SQLite');
    }
  });
});

// ─── ENDPOINTS ────────────────────────────────────────────

// ─── CATALOGO DE PRODUCTOS ───
// GET - Obtener catálogo
app.get('/api/productos', (req, res) => {
  db.all(`SELECT * FROM productos ORDER BY cat ASC, nombre ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ productos: rows.map(r => ({ ...r, disp: !!r.disp })) });
  });
});

// POST - Crear/Actualizar producto
app.post('/api/productos', (req, res) => {
  const { id, cat, nombre, precio, desc, emoji, disp, usuario } = req.body;
  const dispVal = disp !== false ? 1 : 0;
  
  if (id) {
    db.run(
      `UPDATE productos SET cat=?, nombre=?, precio=?, desc=?, emoji=?, disp=? WHERE id=?`,
      [cat, nombre, precio, desc, emoji, dispVal, id],
      function (err) {
        if (err) return res.status(400).json({ error: err.message });
        logAuditoria(usuario, 'producto_editado', `Producto modificado: ${nombre} ($${precio})`);
        res.json({ success: true, updated: this.changes });
      }
    );
  } else {
    db.run(
      `INSERT INTO productos (cat, nombre, precio, desc, emoji, disp) VALUES (?, ?, ?, ?, ?, ?)`,
      [cat, nombre, precio, desc, emoji, dispVal],
      function (err) {
        if (err) return res.status(400).json({ error: err.message });
        logAuditoria(usuario, 'producto_creado', `Nuevo producto agregado al catálogo: ${nombre} ($${precio})`);
        res.json({ success: true, id: this.lastID });
      }
    );
  }
});

// PUT - Toggle Disponibilidad de producto
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

// ─── SESIONES DE CAJA ───
// GET - Sesión Activa
app.get('/api/caja/sesion-activa', (req, res) => {
  db.get(`SELECT * FROM caja_sesiones WHERE estado = 'abierta' ORDER BY id DESC LIMIT 1`, [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ sesion: row || null });
  });
});

// POST - Abrir Caja
app.post('/api/caja/abrir', (req, res) => {
  const { base_inicial, usuario } = req.body;
  const ahora = new Date().toISOString();
  
  // Cerrar cualquier sesión previa abierta por seguridad
  db.run(`UPDATE caja_sesiones SET estado = 'cerrada', fecha_cierre = ? WHERE estado = 'abierta'`, [ahora], () => {
    db.run(
      `INSERT INTO caja_sesiones (fecha_apertura, base_inicial, estado) VALUES (?, ?, 'abierta')`,
      [ahora, base_inicial],
      function (err) {
        if (err) return res.status(400).json({ error: err.message });
        logAuditoria(usuario, 'caja_abierta', `Caja abierta con base inicial de $${base_inicial}`);
        db.get(`SELECT * FROM caja_sesiones WHERE id = ?`, [this.lastID], (errRow, row) => {
          res.json({ success: true, sesion: row });
        });
      }
    );
  });
});

// GET - Resumen de Cierre de Caja
app.get('/api/caja/resumen-cierre/:sesion_id', (req, res) => {
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
app.post('/api/caja/cerrar', (req, res) => {
  const { sesion_id, saldo_final_real, usuario } = req.body;
  const ahora = new Date().toISOString();

  db.get(`SELECT * FROM caja_sesiones WHERE id = ?`, [sesion_id], (err, sesion) => {
    if (err || !sesion) return res.status(400).json({ error: 'Sesión no encontrada' });
    if (sesion.estado === 'cerrada') return res.status(400).json({ error: 'La sesión ya está cerrada' });

    // 1. Obtener ingresos efectivo
    db.get(`SELECT SUM(total) as total FROM ventas WHERE sesion_id = ? AND metodo_pago = 'Efectivo'`, [sesion_id], (err1, rEfectivo) => {
      const efectivo = rEfectivo.total || 0;
      
      // 2. Obtener ingresos transferencia
      db.get(`SELECT SUM(total) as total FROM ventas WHERE sesion_id = ? AND metodo_pago = 'Transferencia'`, [sesion_id], (err2, rTransf) => {
        const transferencia = rTransf.total || 0;
        
        // 3. Obtener gastos
        db.get(`SELECT SUM(valor) as total FROM gastos WHERE sesion_id = ?`, [sesion_id], (err3, rGastos) => {
          const gastos = rGastos.total || 0;
          
          const esperado = sesion.base_inicial + efectivo - gastos;
          const diferencia = saldo_final_real - esperado;

          db.run(
            `UPDATE caja_sesiones SET fecha_cierre = ?, saldo_final_real = ?, estado = 'cerrada' WHERE id = ?`,
            [ahora, saldo_final_real, sesion_id],
            (errUpdate) => {
              if (errUpdate) return res.status(500).json({ error: errUpdate.message });
              logAuditoria(usuario, 'caja_cerrada', `Caja cerrada. Esperado: $${esperado}, Real: $${saldo_final_real}, Dif: $${diferencia}`);
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

// ─── PEDIDOS ───

// POST - Crear pedido
app.post('/api/pedidos', (req, res) => {
  const { uuid, mesa, hora, items, fecha, usuario } = req.body;
  
  db.run(
    `INSERT INTO pedidos (uuid, mesa, hora, items, fecha, synced, mesero_id) 
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [uuid, mesa, hora, JSON.stringify(items), fecha || new Date().toISOString().split('T')[0], usuario || 'Mesero'],
    function (err) {
      if (err) {
        console.error('Error creating pedido:', err);
        return res.status(400).json({ error: err.message });
      }
      logAuditoria(usuario, 'pedido_creado', `Pedido creado para ${mesa} con ${items.length} productos`);
      
      // Emitir en tiempo real a cocina
      io.to('sala_cocina').emit('pedido_recibido_cocina', {
        uuid,
        mesa,
        hora,
        items,
        mesero_id: usuario || 'Mesero',
        estado: 'pendiente'
      });

      res.json({ success: true, id: this.lastID });
    }
  );
});

// GET - Obtener pedidos del día (activos)
app.get('/api/pedidos/date/:fecha', (req, res) => {
  const fecha = req.params.fecha;
  
  db.all(
    `SELECT * FROM pedidos WHERE fecha = ? AND estado = 'activo' ORDER BY id DESC`,
    [fecha],
    (err, rows) => {
      if (err) {
        console.error('Error fetching pedidos:', err);
        return res.status(400).json({ error: err.message });
      }
      
      const pedidos = rows.map(p => ({
        ...p,
        items: JSON.parse(p.items)
      }));
      
      res.json({ pedidos });
    }
  );
});

// PUT - Actualizar estado de item en pedido
app.put('/api/pedidos/:uuid/item/:itemIdx', (req, res) => {
  const { uuid, itemIdx } = req.params;
  const { nuevoEstado } = req.body;
  
  db.get(`SELECT * FROM pedidos WHERE uuid = ?`, [uuid], (err, row) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    
    const items = JSON.parse(row.items);
    items[itemIdx].estado = nuevoEstado;
    
    db.run(
      `UPDATE pedidos SET items = ? WHERE uuid = ?`,
      [JSON.stringify(items), uuid],
      (err) => {
        if (err) return res.status(400).json({ error: err.message });

        // Emitir actualización general
        io.emit('pedido_estado_cambiado', { uuid, items, nuevoEstado });

        // Si el plato está LISTO, notificar al mesero específico que lo tomó
        if (nuevoEstado === 'listo') {
          const meseroId = row.mesero_id || 'Mesero';
          const nombrePlato = items[itemIdx]?.nombre || 'Plato';
          io.to(`sala_mesero_${meseroId}`).emit('pedido_listo_mesero', {
            uuid,
            mesa: row.mesa,
            plato: nombrePlato,
            mensaje: `¡El plato "${nombrePlato}" de la mesa ${row.mesa} está listo!`
          });
          console.log(`📤 Alerta enviada a sala_mesero_${meseroId} para Mesa ${row.mesa}: ${nombrePlato}`);
        }

        res.json({ success: true, items });
      }
    );
  });
});

// DELETE - Completar pedido (cuando mesa se factura y se completa)
app.delete('/api/pedidos/:uuid', (req, res) => {
  db.run(
    `UPDATE pedidos SET estado = 'completado' WHERE uuid = ?`,
    [req.params.uuid],
    (err) => {
      if (err) return res.status(400).json({ error: err.message });
      io.emit('pedido_completado_servidor', { uuid: req.params.uuid });
      res.json({ success: true });
    }
  );
});

// GET - Obtener pedidos fiados
app.get('/api/pedidos/fiado', (req, res) => {
  db.all(
    `SELECT * FROM pedidos WHERE estado = 'fiado' ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Error fetching fiados:', err);
        return res.status(400).json({ error: err.message });
      }
      const fiados = rows.map(p => ({
        ...p,
        items: JSON.parse(p.items)
      }));
      res.json({ fiados });
    }
  );
});

// PUT - Registrar/Actualizar pedido como fiado (soporta combinación/merge)
app.put('/api/pedidos/:uuid/fiado', (req, res) => {
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
    mesasALiberar.forEach(mesaNum => {
      db.run(`UPDATE mesas SET estado = 'libre' WHERE num = ?`, [mesaNum]);
    });
    
    logAuditoria(usuario, 'pedido_fiado', `Pedido registrado como fiado a favor de ${deudor} (Mesa ${targetMesa})`);
    res.json({ success: true });
  });
});

// ─── CANCELACIONES ───

// POST - Cancelar pedido post-cocina (sin eliminar físicamente de 'pedidos')
app.post('/api/pedidos/:uuid/cancelar', (req, res) => {
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
            io.emit('pedido_cancelado_servidor', { uuid });
            res.json({ success: true });
          }
        );
      }
    );
  });
});

// GET - Historial de Cancelados
app.get('/api/pedidos-cancelados', (req, res) => {
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

// ─── VENTAS ───

// POST - Registrar Venta Permanente con Detalle
app.post('/api/ventas', (req, res) => {
  const { fecha, tipo_origen, mesa, total, metodo_pago, sesion_id, detalles, usuario, deudor, fecha_fiado } = req.body;
  const ahora = fecha || new Date().toISOString();

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    db.run(
      `INSERT INTO ventas (fecha, tipo_origen, mesa, total, metodo_pago, sesion_id, deudor, fecha_fiado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ahora, tipo_origen, mesa, total, metodo_pago, sesion_id, deudor || null, fecha_fiado || null],
      function (err) {
        if (err) {
          db.run("ROLLBACK");
          return res.status(400).json({ error: err.message });
        }
        const ventaId = this.lastID;
        
        if (detalles && detalles.length > 0) {
          const stmt = db.prepare(`
            INSERT INTO ventas_detalle (venta_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          let insertError = null;
          detalles.forEach(d => {
            stmt.run([ventaId, d.producto_id, d.nombre_producto, d.cantidad, d.precio_unitario, d.subtotal], (errStmt) => {
              if (errStmt) insertError = errStmt;
            });
          });
          stmt.finalize((errFinal) => {
            if (insertError || errFinal) {
              db.run("ROLLBACK");
              return res.status(400).json({ error: insertError ? insertError.message : 'Error al registrar detalles' });
            }
            db.run("COMMIT");
            logAuditoria(usuario, 'pedido_cobrado', `Cobro registrado para ${tipo_origen} ${mesa} por $${total} (${metodo_pago})`);
            res.json({ success: true, id: ventaId });
          });
        } else {
          db.run("COMMIT");
          logAuditoria(usuario, 'pedido_cobrado', `Cobro registrado para ${tipo_origen} ${mesa} por $${total} (${metodo_pago})`);
          res.json({ success: true, id: ventaId });
        }
      }
    );
  });
});

// GET - Obtener Ventas Históricas
app.get('/api/ventas', (req, res) => {
  db.all(`SELECT * FROM ventas ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ventas: rows });
  });
});

// Nota: No se implementa ningún endpoint DELETE ni UPDATE para 'ventas' por seguridad, tal como se especificó.

// ─── GASTOS ───

// POST - Registrar Gasto
app.post('/api/gastos', (req, res) => {
  const { descripcion, categoria, valor, fecha, sesion_id, usuario } = req.body;
  const fechaGasto = fecha || new Date().toISOString().split('T')[0];

  db.run(
    `INSERT INTO gastos (descripcion, categoria, valor, fecha, sesion_id) VALUES (?, ?, ?, ?, ?)`,
    [descripcion, categoria, valor, fechaGasto, sesion_id],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      logAuditoria(usuario, 'gasto_registrado', `Gasto registrado: ${descripcion} ($${valor}) en cat. ${categoria}`);
      res.json({ success: true, id: this.lastID });
    }
  );
});

// GET - Obtener Gastos
app.get('/api/gastos', (req, res) => {
  db.all(`SELECT * FROM gastos ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ gastos: rows });
  });
});

// ─── FINANZAS / REPORTES ───
app.get('/api/finanzas/reporte', (req, res) => {
  const hoy = new Date().toISOString().split('T')[0];
  
  // 1. Ingresos totales (Ventas)
  db.get(`SELECT SUM(total) as total, COUNT(*) as count FROM ventas`, [], (err1, rTotal) => {
    const ingresosTot = rTotal ? rTotal.total || 0 : 0;
    const cantVentas = rTotal ? rTotal.count || 0 : 0;
    
    // 2. Gastos totales
    db.get(`SELECT SUM(valor) as total FROM gastos`, [], (err2, rGastos) => {
      const gastosTot = rGastos ? rGastos.total || 0 : 0;
      
      // 2b. Gastos de Hoy
      db.get(`SELECT SUM(valor) as total FROM gastos WHERE date(fecha) = date('now', 'localtime') OR fecha LIKE ?`, [hoy + '%'], (errG, rG) => {
        const gastosHoy = rG ? rG.total || 0 : 0;
        
        // 3. Ventas Hoy
        db.get(`SELECT SUM(total) as total FROM ventas WHERE date(fecha) = date('now', 'localtime') OR fecha LIKE ?`, [hoy + '%'], (err3, rHoy) => {
          const ventasHoy = rHoy ? rHoy.total || 0 : 0;
          
          // 4. Ventas Semana (últimos 7 días)
          db.get(`SELECT SUM(total) as total FROM ventas WHERE date(fecha) >= date('now', '-6 days', 'localtime')`, [], (err4, rSemana) => {
            const ventasSemana = rSemana ? rSemana.total || 0 : 0;
            
            // 5. Ventas Mes (mes actual)
            db.get(`SELECT SUM(total) as total FROM ventas WHERE strftime('%Y-%m', fecha) = strftime('%Y-%m', 'now', 'localtime')`, [], (err5, rMes) => {
              const ventasMes = rMes ? rMes.total || 0 : 0;
              
              // 6. Desglose Métodos de Pago
              db.get(`SELECT SUM(total) as total FROM ventas WHERE metodo_pago = 'Efectivo'`, [], (errE, rEfectivo) => {
                const efectivo = rEfectivo ? rEfectivo.total || 0 : 0;
                
                db.get(`SELECT SUM(total) as total FROM ventas WHERE metodo_pago = 'Transferencia'`, [], (errT, rTransf) => {
                  const transferencia = rTransf ? rTransf.total || 0 : 0;
                  
                  // 7. Promedios: Promedio por venta / Ticket Promedio, Promedio Diario, Promedio Semanal
                  // Promedio por venta (Ticket Promedio)
                  const ticketPromedio = cantVentas > 0 ? (ingresosTot / cantVentas) : 0;
   
                  // Promedio Diario: total ventas / cantidad de días diferentes con ventas
                  db.get(`SELECT COUNT(DISTINCT date(fecha)) as dias FROM ventas`, [], (errDays, rDays) => {
                    const diasConVentas = rDays ? rDays.dias || 1 : 1;
                    const promedioDiario = ingresosTot / (diasConVentas || 1);
   
                    // Promedio Semanal
                    db.get(`SELECT COUNT(DISTINCT strftime('%W-%Y', fecha)) as semanas FROM ventas`, [], (errWeeks, rWeeks) => {
                      const semanasConVentas = rWeeks ? rWeeks.semanas || 1 : 1;
                      const promedioSemanal = ingresosTot / (semanasConVentas || 1);
   
                      // 8. Lista de gastos recientes
                      db.all(`SELECT * FROM gastos ORDER BY id DESC LIMIT 50`, [], (errList, listGastos) => {
                        db.all(`SELECT * FROM ventas ORDER BY id DESC LIMIT 50`, [], (errSales, listSales) => {
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
                            ventas: listSales || []
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


// ─── INVENTARIO (INSUMOS Y MOVIMIENTOS) ───

// GET - Insumos
app.get('/api/inventario/insumos', (req, res) => {
  db.all(`SELECT * FROM insumos ORDER BY nombre ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ insumos: rows });
  });
});

// POST - Crear Insumo
app.post('/api/inventario/insumos', (req, res) => {
  const { nombre, unidad, cantidad_actual, stock_minimo, precio_compra, usuario } = req.body;
  
  db.run(
    `INSERT INTO insumos (nombre, unidad, cantidad_actual, stock_minimo, precio_compra) VALUES (?, ?, ?, ?, ?)`,
    [nombre, unidad, cantidad_actual || 0, stock_minimo || 0, precio_compra || 0],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      logAuditoria(usuario, 'insumo_creado', `Insumo registrado: ${nombre} (${cantidad_actual} ${unidad})`);
      res.json({ success: true, id: this.lastID });
    }
  );
});

// POST - Registrar Movimiento (Entrada o Ajuste)
app.post('/api/inventario/insumos/:id/movimiento', (req, res) => {
  const insumoId = req.params.id;
  const { tipo, cantidad, motivo, fecha, usuario } = req.body;
  const fechaMov = fecha || new Date().toISOString().split('T')[0];

  // Ejecutar en transacción
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    db.get(`SELECT nombre, cantidad_actual FROM insumos WHERE id = ?`, [insumoId], (errInsumo, insumo) => {
      if (errInsumo || !insumo) {
        db.run("ROLLBACK");
        return res.status(404).json({ error: 'Insumo no encontrado' });
      }

      // Calcular nueva cantidad
      let nuevaCantidad = insumo.cantidad_actual;
      if (tipo === 'entrada') {
        nuevaCantidad += parseFloat(cantidad);
      } else if (tipo === 'ajuste') {
        nuevaCantidad = parseFloat(cantidad);
      }

      // Registrar movimiento
      db.run(
        `INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, fecha, motivo) VALUES (?, ?, ?, ?, ?)`,
        [insumoId, tipo, cantidad, fechaMov, motivo || 'Sin motivo'],
        function (errInsert) {
          if (errInsert) {
            db.run("ROLLBACK");
            return res.status(400).json({ error: errInsert.message });
          }

          // Actualizar insumos
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
              res.json({ success: true, nuevaCantidad });
            }
          );
        }
      );
    });
  });
});

// GET - Logs de Movimientos
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

// Memoria para registrar intentos fallidos de login
const loginAttempts = {}; // { [usuario]: { intentos: 0, bloqueadoHasta: null } }

// ─── SEGURIDAD / LOGIN ───
// POST - Iniciar sesión por PIN
app.post('/api/login', (req, res) => {
  const { usuario, pin } = req.body;
  if (!usuario || !pin) {
    return res.status(400).json({ success: false, message: 'Usuario y PIN requeridos' });
  }

  // 1. Validar si está bloqueado temporalmente
  const now = Date.now();
  if (loginAttempts[usuario] && loginAttempts[usuario].bloqueadoHasta && loginAttempts[usuario].bloqueadoHasta > now) {
    const restante = Math.ceil((loginAttempts[usuario].bloqueadoHasta - now) / 1000);
    return res.json({ 
      success: false, 
      message: `Bloqueado temporalmente. Intente en ${restante} segundos.` 
    });
  }

  // Hash del PIN enviado
  const hashedPin = hashPin(pin);

  db.get(`SELECT * FROM usuarios WHERE nombre = ?`, [usuario], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!row) {
      return res.json({ success: false, message: 'Usuario no encontrado' });
    }
    if (!row.activo) {
      return res.json({ success: false, message: 'El usuario se encuentra desactivado' });
    }

    // 2. Verificar PIN
    if (row.pin !== hashedPin) {
      // Registrar intento fallido
      if (!loginAttempts[usuario]) {
        loginAttempts[usuario] = { intentos: 0, bloqueadoHasta: null };
      }
      loginAttempts[usuario].intentos += 1;
      
      let msg = 'PIN incorrecto.';
      if (loginAttempts[usuario].intentos >= 5) {
        loginAttempts[usuario].bloqueadoHasta = Date.now() + 30000; // Bloqueo de 30 segundos
        loginAttempts[usuario].intentos = 0; // reset
        msg = 'Demasiados intentos fallidos. Cuenta bloqueada por 30 segundos.';
      } else {
        msg += ` Intentos restantes: ${5 - loginAttempts[usuario].intentos}`;
      }

      logAuditoria(usuario, 'login_fallido', `Intento de login fallido. Razón: PIN incorrecto.`);
      return res.json({ success: false, message: msg });
    }

    // Login correcto - resetear intentos
    if (loginAttempts[usuario]) {
      loginAttempts[usuario].intentos = 0;
      loginAttempts[usuario].bloqueadoHasta = null;
    }

    // Verificar si es administrador y está usando el PIN por defecto "1234"
    const forcePinChange = (row.rol === 'admin' && hashedPin === hashPin('1234'));

    logAuditoria(row.nombre, 'login', `Inicio de sesión exitoso como ${row.rol}`);
    res.json({ 
      success: true, 
      usuario: row.nombre, 
      rol: row.rol, 
      forcePinChange 
    });
  });
});

// POST - Cerrar sesión
app.post('/api/logout', (req, res) => {
  const { usuario } = req.body;
  logAuditoria(usuario, 'logout', `Sesión cerrada`);
  res.json({ success: true });
});

// ─── GESTIÓN DE USUARIOS ───
// GET - Obtener usuarios (excluyendo PIN por seguridad)
app.get('/api/usuarios', (req, res) => {
  db.all(`SELECT id, nombre, rol, activo FROM usuarios ORDER BY nombre ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ usuarios: rows });
  });
});

// POST - Crear o actualizar usuario
app.post('/api/usuarios', (req, res) => {
  const { id, nombre, pin, rol, activo, administrador_usuario } = req.body;
  
  if (id) {
    // Actualización de usuario existente
    if (pin) {
      // Si se desea actualizar el PIN
      if (pin.length < 4 || pin.length > 6 || isNaN(Number(pin))) {
        return res.status(400).json({ error: 'El PIN debe tener entre 4 y 6 dígitos' });
      }
      const hashed = hashPin(pin);
      db.run(
        `UPDATE usuarios SET nombre=?, pin=?, rol=? WHERE id=?`,
        [nombre, hashed, rol, id],
        function (err) {
          if (err) return res.status(400).json({ error: err.message });
          logAuditoria(administrador_usuario, 'pin_cambiado', `PIN y datos actualizados para usuario: ${nombre}`);
          res.json({ success: true });
        }
      );
    } else {
      // Actualizar solo nombre y rol
      db.run(
        `UPDATE usuarios SET nombre=?, rol=? WHERE id=?`,
        [nombre, rol, id],
        function (err) {
          if (err) return res.status(400).json({ error: err.message });
          logAuditoria(administrador_usuario, 'usuario_editado', `Datos actualizados para usuario: ${nombre}`);
          res.json({ success: true });
        }
      );
    }
  } else {
    // Crear nuevo usuario
    if (!pin || pin.length < 4 || pin.length > 6 || isNaN(Number(pin))) {
      return res.status(400).json({ error: 'El PIN debe tener entre 4 y 6 dígitos' });
    }
    const hashed = hashPin(pin);
    const activoVal = activo !== false ? 1 : 0;
    db.run(
      `INSERT INTO usuarios (nombre, pin, rol, activo) VALUES (?, ?, ?, ?)`,
      [nombre, hashed, rol, activoVal],
      function (err) {
        if (err) return res.status(400).json({ error: err.message });
        logAuditoria(administrador_usuario, 'usuario_creado', `Nuevo usuario creado: ${nombre} (${rol})`);
        res.json({ success: true, id: this.lastID });
      }
    );
  }
});

// PUT - Activar/Desactivar estado de usuario
app.put('/api/usuarios/:id/estado', (req, res) => {
  const { id } = req.params;
  const { activo, administrador_usuario } = req.body;
  const activoVal = activo ? 1 : 0;

  db.get(`SELECT nombre FROM usuarios WHERE id = ?`, [id], (errGet, userRow) => {
    if (errGet || !userRow) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    db.run(
      `UPDATE usuarios SET activo = ? WHERE id = ?`,
      [activoVal, id],
      function (err) {
        if (err) return res.status(400).json({ error: err.message });
        const accionStr = activo ? 'usuario_activado' : 'usuario_desactivado';
        const detalleStr = activo ? `Usuario reactivado: ${userRow.nombre}` : `Usuario desactivado: ${userRow.nombre}`;
        logAuditoria(administrador_usuario, accionStr, detalleStr);
        res.json({ success: true });
      }
    );
  });
});

// ─── EDICIÓN DE PEDIDO ───
// PUT - Actualizar pedido completo (edición de mesero)
app.put('/api/pedidos/:uuid', (req, res) => {
  const { uuid } = req.params;
  const { items, usuario } = req.body;

  db.get(`SELECT mesa FROM pedidos WHERE uuid = ?`, [uuid], (errGet, pRow) => {
    const mesaLabel = pRow ? pRow.mesa : 'desconocida';
    db.run(
      `UPDATE pedidos SET items = ? WHERE uuid = ?`,
      [JSON.stringify(items), uuid],
      function (err) {
        if (err) return res.status(400).json({ error: err.message });
        logAuditoria(usuario, 'pedido_editado', `Pedido editado para mesa ${mesaLabel} (${items.length} productos en total)`);
        res.json({ success: true });
      }
    );
  });
});

// ─── VENTAS DETALLADAS ───
// GET - Obtener detalles de una venta específica
app.get('/api/ventas/:id/detalles', (req, res) => {
  const ventaId = req.params.id;
  db.all(`SELECT * FROM ventas_detalle WHERE venta_id = ?`, [ventaId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ detalles: rows });
  });
});

// ─── HISTORIAL DE AUDITORÍA ───
// GET - Obtener logs de auditoría con filtros opcionales
app.get('/api/auditoria', (req, res) => {
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

// Endpoint para descargar un asset específico de GitHub Releases actuando como Proxy
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
      timeout: 60000 // 60s timeout para descargas grandes
    });

    // Determinar Content-Type
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

// Endpoint para comprobar actualizaciones de la app y del servidor
app.get('/api/check-update', async (req, res) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token || token === 'tu_token_personal_de_github_aqui') {
    console.error('❌ Error de actualización: GITHUB_TOKEN no configurado en el servidor.');
    return res.status(500).json({ error: 'GitHub Token no configurado en el servidor' });
  }

  try {
    console.log('📡 Buscando última release en GitHub...');
    const response = await axios.get(
      'https://api.github.com/repos/oscar2121/Embejucao/releases/latest',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Node-Express-Server'
        },
        timeout: 10000 // 10s timeout
      }
    );

    const release = response.data;
    const rawVersion = release.tag_name;
    const version = rawVersion.replace(/^v/, ''); // Limpiar 'v'

    // Extraer notas de versión (changelog)
    const notes = release.body 
      ? release.body.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0)
      : [];

    let apkAsset = null;
    let zipAsset = null;

    if (release.assets && Array.isArray(release.assets)) {
      apkAsset = release.assets.find(a => a.name.toLowerCase().endsWith('.apk'));
      zipAsset = release.assets.find(a => a.name.toLowerCase().endsWith('.zip'));
    }

    // Resolver IP/Puerto dinámicamente según la petición recibida
    const host = req.get('host') || `localhost:${PORT}`;
    const protocol = req.protocol || 'http';
    const serverBaseUrl = `${protocol}://${host}`;

    const apkUrl = apkAsset 
      ? `${serverBaseUrl}/api/download-asset/${apkAsset.id}/${apkAsset.name}`
      : null;

    const serverUrl = zipAsset 
      ? `${serverBaseUrl}/api/download-asset/${zipAsset.id}/${zipAsset.name}`
      : null;

    res.json({
      version,
      notes,
      apkUrl,
      serverUrl
    });
  } catch (error) {
    console.error('❌ Error al buscar actualizaciones en GitHub:', error.message);
    res.status(500).json({ 
      error: 'Error al conectar con GitHub para buscar actualizaciones',
      details: error.message 
    });
  }
});

// GET - Health check
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
