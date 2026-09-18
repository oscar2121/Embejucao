const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const axios = require('axios');
const jwt = require('jsonwebtoken');

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
      // Quitar comillas si existen
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  });
}


const app = express();
const multer = require('multer');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
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

  db.run(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE
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
  `, (err) => {
    // Migration: Add usuario column to existing table
    db.run(`ALTER TABLE gastos ADD COLUMN usuario TEXT`, (errAlter) => {
      // Ignorar error si la columna ya existe
    });
    // Migration: Add uuid column for idempotency
    db.run(`ALTER TABLE gastos ADD COLUMN uuid TEXT UNIQUE`, (errAlter) => {
      // Ignorar error
    });
  });

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
      rol TEXT, -- OBSOLETO, mantener por retrocompatibilidad
      activo INTEGER DEFAULT 1
    )
  `);

  // 8.1 Roles
  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      nombre TEXT,
      descripcion TEXT
    )
  `);

  // 8.2 Usuario_Roles (Muchos a Muchos)
  db.run(`
    CREATE TABLE IF NOT EXISTS usuario_roles (
      usuario_id INTEGER,
      rol_id TEXT,
      PRIMARY KEY (usuario_id, rol_id),
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY(rol_id) REFERENCES roles(id) ON DELETE CASCADE
    )
  `);

  // Insertar roles por defecto
  db.run(`INSERT OR IGNORE INTO roles (id, nombre, descripcion) VALUES 
    ('admin', 'Administrador', 'Acceso total al sistema'),
    ('caja', 'Cajero', 'Acceso a facturación y pagos'),
    ('cocina', 'Cocina', 'Acceso a gestión de comandas'),
    ('pedido', 'Mesero', 'Acceso a toma de pedidos')
  `);

  // 8.3 Adicionales
  db.run(`
    CREATE TABLE IF NOT EXISTS adicionales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE,
      precio REAL,
      disponible INTEGER DEFAULT 1
    )
  `, (err) => {
    if (!err) {
      db.run(`INSERT OR IGNORE INTO adicionales (id, nombre, precio, disponible) VALUES 
        (1, 'Porción de Papa', 3000, 1),
        (2, 'Queso Extra', 2000, 1),
        (3, 'Tocineta', 2500, 1),
        (4, 'Salsa Extra', 1000, 1),
        (5, 'Carne Extra', 5000, 1)
      `);
    }
  });

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
        { nombre: "Cocina", pin: hashPin("3333"), rol: "cocina", activo: 1 }
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

// ─── CATALOGO DE PRODUCTOS ───
// GET - Obtener catálogo
// ─── ENDPOINTS ADICIONALES ───
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

// ─── ENDPOINTS PRODUCTOS ───
app.get('/api/productos', (req, res) => {
  db.all(`SELECT * FROM productos ORDER BY cat ASC, nombre ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ productos: rows.map(r => ({ ...r, disp: !!r.disp })) });
  });
});

// POST - Crear/Actualizar producto
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

// ─── MESAS ───
// GET - Obtener todas las mesas
app.get('/api/mesas', (req, res) => {
  db.all(`SELECT * FROM mesas ORDER BY num ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (rows.length === 0) {
      // Inicializar si está vacío
      const iniciales = [
        { num: 1, estado: "libre" },
        { num: 2, estado: "libre" },
        { num: 3, estado: "libre" },
        { num: 4, estado: "libre" }
      ];
      
      const stmt = db.prepare(`INSERT INTO mesas (num, estado) VALUES (?, ?)`);
      iniciales.forEach(m => stmt.run(m.num, m.estado));
      stmt.finalize(() => {
        db.all(`SELECT * FROM mesas ORDER BY num ASC`, [], (err2, newRows) => {
          res.json({ mesas: newRows });
        });
      });
    } else {
      res.json({ mesas: rows });
    }
  });
});

// PUT - Actualizar cantidad de mesas
app.put('/api/mesas/cantidad', (req, res) => {
  const { cantidad, usuario } = req.body;
  if (!cantidad || cantidad < 1 || cantidad > 100) return res.status(400).json({ error: "Cantidad inválida (1-100)" });
  
  db.all(`SELECT * FROM mesas ORDER BY num ASC`, [], (err, mesasActuales) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const cantidadActual = mesasActuales.length;
    
    if (cantidad === cantidadActual) {
      return res.json({ success: true, message: "La cantidad ya es correcta." });
    }
    
    if (cantidad > cantidadActual) {
      // Agregar nuevas mesas
      const stmt = db.prepare(`INSERT INTO mesas (num, estado) VALUES (?, 'libre')`);
      for (let i = cantidadActual + 1; i <= cantidad; i++) {
        stmt.run(i);
      }
      stmt.finalize(() => {
        logAuditoria(usuario, 'mesas_actualizadas', `Cantidad de mesas aumentada a ${cantidad}`);
        db.all(`SELECT * FROM mesas ORDER BY num ASC`, [], (err2, rows) => {
          io.emit('mesas_actualizadas', rows);
          res.json({ success: true, mesas: rows });
        });
      });
    } else {
      // Reducir mesas, primero verificar si las que se van a eliminar están ocupadas
      const mesasAEliminar = mesasActuales.filter(m => m.num > cantidad);
      const mesasOcupadas = mesasAEliminar.filter(m => m.estado !== 'libre');
      
      if (mesasOcupadas.length > 0) {
        const nums = mesasOcupadas.map(m => m.num).join(', ');
        return res.status(400).json({ error: `No se puede reducir la cantidad. Las siguientes mesas están ocupadas o en cuenta: ${nums}` });
      }
      
      db.run(`DELETE FROM mesas WHERE num > ?`, [cantidad], (errDelete) => {
        if (errDelete) return res.status(500).json({ error: errDelete.message });
        logAuditoria(usuario, 'mesas_actualizadas', `Cantidad de mesas reducida a ${cantidad}`);
        
        db.all(`SELECT * FROM mesas ORDER BY num ASC`, [], (err2, rows) => {
          io.emit('mesas_actualizadas', rows);
          res.json({ success: true, mesas: rows });
        });
      });
    }
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
          io.emit('caja_actualizada', row);
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
              io.emit('caja_actualizada', null);
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
      const payloadPedido = {
        id: this.lastID,
        uuid,
        mesa,
        hora,
        items,
        mesero_id: usuario || 'Mesero',
        estado: 'pendiente'
      };
      io.to('sala_cocina').emit('pedido_recibido_cocina', payloadPedido);

      // Actualizar el estado de la mesa física a 'ocupada'
      const numMesa = parseInt(mesa);
      if (!isNaN(numMesa)) {
        db.run(`UPDATE mesas SET estado = 'ocupada' WHERE num = ?`, [numMesa], (errMesa) => {
          if (errMesa) console.error('Error actualizando estado de mesa:', errMesa);
        });
      }

      res.json({ success: true, id: this.lastID });
    }
  );
});

// GET - Obtener pedidos del día (activos)
app.get('/api/pedidos/date/:fecha', (req, res) => {
  const fecha = req.params.fecha;
  
  db.all(
    `SELECT * FROM pedidos WHERE fecha LIKE ? AND estado NOT IN ('completado', 'cancelado') ORDER BY id DESC`,
    [`${fecha}%`],
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

// POST - Actualizar estado general de un pedido y sus items en batch (Cocina)
app.post('/api/pedidos/estado', (req, res) => {
  const { uuid, items, nuevoEstado } = req.body;
  
  if (!uuid || !items || !nuevoEstado) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos (uuid, items, nuevoEstado)' });
  }

  db.run(
    `UPDATE pedidos SET items = ?, estado = ? WHERE uuid = ?`,
    [JSON.stringify(items), nuevoEstado, uuid],
    (err) => {
      if (err) {
        console.error('Error actualizando estado del pedido en batch:', err);
        return res.status(500).json({ error: err.message });
      }

      // Emitir el cambio a todos los clientes conectados
      io.emit('pedido_estado_cambiado', { uuid, items, nuevoEstado });

      // Si el pedido entero está listo y pasa a 'cuenta', podemos emitir un evento específico
      if (nuevoEstado === 'cuenta') {
        io.emit('pedido_listo_para_entregar', { uuid });
      }

      res.json({ success: true, items, estado: nuevoEstado });
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
  const uuid = req.params.uuid;
  db.get(`SELECT mesa FROM pedidos WHERE uuid = ?`, [uuid], (err, row) => {
    if (err || !row) return res.status(400).json({ error: 'Pedido no encontrado' });
    
    db.run(
      `UPDATE pedidos SET estado = 'completado' WHERE uuid = ?`,
      [uuid],
      (errUpdate) => {
        if (errUpdate) return res.status(400).json({ error: errUpdate.message });
        io.emit('pedido_completado_servidor', { uuid });
        
        // Liberar mesa física
        const targetMesa = row.mesa || '';
        const mesasALiberar = String(targetMesa).split(',').map(m => Number(m.trim())).filter(m => !isNaN(m));
        
        if (mesasALiberar.length > 0) {
          let updates = 0;
          mesasALiberar.forEach(mesaNum => {
            db.run(`UPDATE mesas SET estado = 'libre' WHERE num = ?`, [mesaNum], () => {
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

// GET - Obtener todos los clientes historicos
app.get('/api/clientes', (req, res) => {
  db.all(`SELECT nombre FROM clientes ORDER BY nombre ASC`, [], (err, rows) => {
    if (err) return res.status(400).json({ error: err.message });
    const clientes = rows.map(r => r.nombre);
    res.json({ clientes });
  });
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
    
    // Notificar a todos que el pedido ya no está activo
    if (deudor) {
      db.run('INSERT OR IGNORE INTO clientes (nombre) VALUES (?)', [deudor.trim()]);
    }
    
    // Emitir el evento de fiado para que se actualice en la caja en tiempo real (Créditos)
    // El móvil (App.js) lo removerá de sus activos automáticamente al recibir pedido_fiado_servidor
    db.get('SELECT * FROM pedidos WHERE uuid = ?', [uuid], (errSel, row) => {
      if (row) {
        row.items = JSON.parse(row.items);
        io.emit('pedido_fiado_servidor', row);
      }
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
    db.run(
      `INSERT INTO ventas (fecha, tipo_origen, mesa, total, metodo_pago, sesion_id, deudor, fecha_fiado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ahora, tipo_origen, mesa, total, metodo_pago, sesion_id, deudor || null, fecha_fiado || null],
      function (err) {
        if (err) {
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
              return res.status(400).json({ error: insertError ? insertError.message : 'Error al registrar detalles' });
            }
            logAuditoria(usuario, 'pedido_cobrado', `Cobro registrado para ${tipo_origen} ${mesa} por $${total} (${metodo_pago})`);
            res.json({ success: true, id: ventaId });
          });
        } else {
          logAuditoria(usuario, 'pedido_cobrado', `Cobro registrado para ${tipo_origen} ${mesa} por $${total} (${metodo_pago})`);
          res.json({ success: true, id: ventaId });
        }
      }
    );
  });
});

// GET - Obtener Ventas Históricas
app.get('/api/ventas', (req, res) => {
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

// Nota: No se implementa ningún endpoint DELETE ni UPDATE para 'ventas' por seguridad, tal como se especificó.

// ─── GASTOS ───

// POST - Registrar Gasto
app.post('/api/gastos', authorize(['admin', 'caja']), (req, res) => {
  const { descripcion, categoria, valor, fecha, sesion_id } = req.body;
  const fechaGasto = fecha || new Date().toISOString().split('T')[0];
  const usuarioResp = req.user ? req.user.nombre : 'Desconocido';

  db.run(
    `INSERT INTO gastos (descripcion, categoria, valor, fecha, sesion_id, usuario) VALUES (?, ?, ?, ?, ?, ?)`,
    [descripcion, categoria, valor, fechaGasto, sesion_id, usuarioResp],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      logAuditoria(usuarioResp, 'gasto_registrado', `Gasto registrado: ${descripcion} ($${valor}) en cat. ${categoria}`);
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
      db.get(`SELECT SUM(valor) as total FROM gastos WHERE date(datetime(fecha, 'localtime')) = date('now', 'localtime')`, [], (errG, rG) => {
        const gastosHoy = rG ? rG.total || 0 : 0;
        
        // 3. Ventas Hoy
        db.get(`SELECT SUM(total) as total FROM ventas WHERE date(datetime(fecha, 'localtime')) = date('now', 'localtime')`, [], (err3, rHoy) => {
          const ventasHoy = rHoy ? rHoy.total || 0 : 0;
          
          // 4. Ventas Semana (últimos 7 días)
          db.get(`SELECT SUM(total) as total FROM ventas WHERE date(datetime(fecha, 'localtime')) >= date('now', '-6 days', 'localtime')`, [], (err4, rSemana) => {
            const ventasSemana = rSemana ? rSemana.total || 0 : 0;
            
            // 5. Ventas Mes (mes actual)
            db.get(`SELECT SUM(total) as total FROM ventas WHERE strftime('%Y-%m', datetime(fecha, 'localtime')) = strftime('%Y-%m', 'now', 'localtime')`, [], (err5, rMes) => {
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
  const { rango } = req.query; // 'hoy', 'semana', 'mes', o 'YYYY-MM-DD'
  const hoy = new Date().toISOString().split('T')[0];
  let dateConditionVentas = `date(datetime(fecha, 'localtime')) = date('now', 'localtime')`;
  let dateConditionGastos = `date(datetime(fecha, 'localtime')) = date('now', 'localtime')`;
  let dateConditionCaja = `date(datetime(fecha_apertura, 'localtime')) = date('now', 'localtime')`;

  if (rango === 'semana') {
    dateConditionVentas = `date(datetime(fecha, 'localtime')) >= date('now', '-6 days', 'localtime')`;
    dateConditionGastos = `date(datetime(fecha, 'localtime')) >= date('now', '-6 days', 'localtime')`;
    dateConditionCaja = `date(datetime(fecha_apertura, 'localtime')) >= date('now', '-6 days', 'localtime')`;
  } else if (rango === 'mes') {
    dateConditionVentas = `strftime('%Y-%m', datetime(fecha, 'localtime')) = strftime('%Y-%m', 'now', 'localtime')`;
    dateConditionGastos = `strftime('%Y-%m', datetime(fecha, 'localtime')) = strftime('%Y-%m', 'now', 'localtime')`;
    dateConditionCaja = `strftime('%Y-%m', datetime(fecha_apertura, 'localtime')) = strftime('%Y-%m', 'now', 'localtime')`;
  } else if (rango && /^\d{4}-\d{2}-\d{2}$/.test(rango)) {
    dateConditionVentas = `date(datetime(fecha, 'localtime')) = '${rango}'`;
    dateConditionGastos = `date(datetime(fecha, 'localtime')) = '${rango}'`;
    dateConditionCaja = `date(datetime(fecha_apertura, 'localtime')) = '${rango}'`;
  }

  // 1. Ventas
  db.get(`SELECT SUM(total) as total FROM ventas WHERE ${dateConditionVentas}`, [], (err, rVentas) => {
    const ventas = rVentas ? rVentas.total || 0 : 0;
    
    // 2. Gastos
    db.get(`SELECT SUM(valor) as total FROM gastos WHERE ${dateConditionGastos}`, [], (err, rGastos) => {
      const gastos = rGastos ? rGastos.total || 0 : 0;
      
      // 3. Gastos por categoría
      db.all(`SELECT categoria, SUM(valor) as total FROM gastos WHERE ${dateConditionGastos} GROUP BY categoria`, [], (err, catList) => {
        const gastosPorCategoria = catList || [];
        
        // 4. Últimos gastos
        db.all(`SELECT * FROM gastos WHERE ${dateConditionGastos} ORDER BY id DESC LIMIT 50`, [], (err, ultimosGastos) => {
          
          // 5. Métodos de pago
          db.get(`SELECT SUM(total) as total FROM ventas WHERE (${dateConditionVentas}) AND metodo_pago = 'Efectivo'`, [], (err, rEfe) => {
            const efectivo = rEfe ? rEfe.total || 0 : 0;
            
            db.get(`SELECT SUM(total) as total FROM ventas WHERE (${dateConditionVentas}) AND metodo_pago = 'Transferencia'`, [], (err, rTrans) => {
              const transferencia = rTrans ? rTrans.total || 0 : 0;

              // 6. Flujo de Ventas (Agrupado por hora o día)
              let flowSelect = "strftime('%H:00', datetime(fecha, 'localtime')) as label";
              if (rango === 'semana' || rango === 'mes') {
                flowSelect = "date(datetime(fecha, 'localtime')) as label";
              }

              db.all(`SELECT ${flowSelect}, SUM(total) as total FROM ventas WHERE ${dateConditionVentas} GROUP BY label ORDER BY label ASC`, [], (err, flujoVentas) => {
                
                // 7. Sesiones de Caja
                db.all(`SELECT * FROM caja_sesiones WHERE ${dateConditionCaja} ORDER BY id DESC`, [], (err, cajaSesiones) => {

                  res.json({
                    rango: rango || 'hoy',
                    ventas,
                    gastos,
                    balance: ventas - gastos,
                    gastosPorCategoria,
                    ultimosGastos: ultimosGastos || [],
                    efectivo,
                    transferencia,
                    flujoVentas: flujoVentas || [],
                    cajaSesiones: cajaSesiones || []
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
// Middleware de Autorización RBAC
function authorize(rolesPermitidos = []) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Falta token de autenticación' });
    }
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded; // { id, nombre, roles }
      
      // Si no se exigen roles específicos, dejamos pasar
      if (rolesPermitidos.length === 0) return next();
      
      // Verificar si el usuario tiene al menos uno de los roles permitidos
      const tieneRol = req.user.roles && req.user.roles.some(rol => rolesPermitidos.includes(rol));
      if (!tieneRol) {
        return res.status(403).json({ error: 'No tienes permisos suficientes (Roles requeridos: ' + rolesPermitidos.join(', ') + ')' });
      }
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
  };
};

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

    // Fetch multiple roles
    db.all(`SELECT rol_id FROM usuario_roles WHERE usuario_id = ?`, [row.id], (errRoles, rolesRows) => {
      let roles = [];
      if (!errRoles && rolesRows && rolesRows.length > 0) {
        roles = rolesRows.map(r => r.rol_id);
      } else if (row.rol) {
        // Fallback to legacy single role if no mapping exists
        roles = [row.rol];
      }

      // Verificar si es administrador y está usando el PIN por defecto "1234"
      const isAdmin = roles.includes('admin');
      const forcePinChange = (isAdmin && hashedPin === hashPin('1234'));

      logAuditoria(row.nombre, 'login', `Inicio de sesión exitoso con roles: ${roles.join(', ')}`);

      // Generate JWT Token
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

// POST - Cerrar sesión
app.post('/api/logout', (req, res) => {
  const { usuario } = req.body;
  logAuditoria(usuario, 'logout', `Sesión cerrada`);
  res.json({ success: true });
});

// ─── GESTIÓN DE USUARIOS ───
// GET - Obtener usuarios (excluyendo PIN por seguridad)
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

// POST - Crear o actualizar usuario
app.post('/api/usuarios', authorize(['admin']), (req, res) => {
  const { id, nombre, pin, roles, activo, administrador_usuario } = req.body;
  const dbRoles = Array.isArray(roles) ? roles : [];
  // For backwards compatibility logic if necessary, though we just use roles
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
    // Actualización
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
    // Crear
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

// PUT - Activar/Desactivar estado de usuario
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

// DELETE - Eliminar usuario
app.delete('/api/usuarios/:id', authorize(['admin']), (req, res) => {
  const { id } = req.params;
  const { administrador_usuario } = req.body;

  db.get(`SELECT nombre FROM usuarios WHERE id = ?`, [id], (errGet, userRow) => {
    if (errGet || !userRow) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    db.run(`DELETE FROM usuarios WHERE id = ?`, [id], function(err) {
      if (err) return res.status(400).json({ error: err.message });
      // Thanks to ON DELETE CASCADE, usuario_roles are also deleted if pragma foreign_keys=ON is active, 
      // but if not, let's explicitly delete them to be safe
      db.run(`DELETE FROM usuario_roles WHERE usuario_id = ?`, [id]);
      
      logAuditoria(administrador_usuario || req.user?.nombre || 'Admin', 'usuario_eliminado', `Usuario eliminado permanentemente: ${userRow.nombre}`);
      res.json({ success: true });
    });
  });
});


// ─── EDICIÓN DE PEDIDO ───
// PUT - Actualizar pedido completo (edición de mesero)
app.put('/api/pedidos/:uuid', (req, res) => {
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
        
        io.emit('pedido_estado_cambiado', { uuid, items, nuevoEstado: estadoActual });
        
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

// Endpoint para comprobar actualizaciones de la app y del servidor (Dual)
app.get('/api/check-update', async (req, res) => {
  const platform = req.query.platform || 'mobile'; // 'mobile' o 'desktop'
  
  try {
    console.log(`?? Buscando última release en GitHub para plataforma: ${platform}...`);
    const response = await axios.get(
      'https://api.github.com/repos/oscar2121/Embejucao/releases/latest',
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Embejucao-App'
        },
        timeout: 10000 // 10s timeout
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
    // Si GitHub devuelve 404 significa que no hay releases an.
    if (error.response && error.response.status === 404) {
      return res.json({ updateAvailable: false, message: 'Sin releases disponibles' });
    }
    console.error('?O Error al buscar actualizaciones en GitHub:', error.message);
    res.json({ updateAvailable: false, message: 'Error de red o lmite de GitHub' });
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
