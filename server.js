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

// ─── FUNCIONES DE EMISIÓN ROBUSTAS ───────────────────────────────────────────

function parsearItems(raw) {
  try {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function broadcastComandasActivas() {
  // Enrutamos el broadcast legacy a la nueva sincronización maestra tolerante a fallos
  emitirSincronizacionCompleta();
}

async function emitirSincronizacionCompleta(targetSocket) {
  const emisor = targetSocket || io;
  try {
    const pedidosRaw = await dbAll("SELECT * FROM pedidos ORDER BY id DESC", []) || [];
    const pedidos = pedidosRaw.map(p => {
      let itemsParseados = [];
      try {
        itemsParseados = typeof p.items === 'string' ? JSON.parse(p.items) : (p.items || []);
      } catch (e) {
        console.error(`Error parseando items del pedido #${p.id}:`, e.message);
        itemsParseados = [];
      }
      return { ...p, items: itemsParseados };
    });

    const categorias = await dbAll("SELECT * FROM categorias", []).catch(() => []) || [];
    const productos = await dbAll("SELECT * FROM productos ORDER BY id ASC", []) || [];
    const adicionales = await dbAll("SELECT * FROM adicionales ORDER BY id ASC", []) || [];
    const mesas = await dbAll("SELECT * FROM mesas ORDER BY num ASC", []) || [];
    const turnoActivo = await obtenerBalanceTurnoActivo();

    const paquete = {
      pedidos,
      categorias,
      productos,
      adicionales,
      mesas,
      sesionCaja: turnoActivo,
      cajaAbierta: Boolean(turnoActivo)
    };

    // Emisión del paquete maestro consolidado
    emisor.emit('sync_datos', paquete);
    emisor.emit('pedidos:lista', pedidos);
    emisor.emit('cuentas:activas', pedidos.filter(p => !['cobrado', 'cancelado', 'archivado', 'completado'].includes(p.estado)));
    emisor.emit('caja:estado', { abierta: Boolean(turnoActivo), turno: turnoActivo });
    emisor.emit('pedidos_actualizados');
    emisor.emit('actualizar_pedidos');

    console.log(`📡 Sincronización emitida con éxito a ${targetSocket ? targetSocket.id : 'todos'}. Pedidos: ${pedidos.length}`);
  } catch (error) {
    console.error('Error crítico en emitirSincronizacionCompleta:', error);
  }
}

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

      // Conservar estado 'en_cocina' o 'activo' (NO cambiar a completado/cerrado/cobrado)
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

// ─── BASE DE DATOS ─────────────────────────────────────────
const dbPath = path.resolve(__dirname, 'embejucao.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("Error conectando a SQLite:", err);
  else {
    console.log("📦 SQLite conectado firmemente en:", dbPath);

    // Restaurar pedidos a crédito en server.js
    db.serialize(() => {
      // 1. Restaurar pedidos marcados como crédito / fiado para que vuelvan a la lista de Créditos
      db.run(`
        UPDATE pedidos 
        SET estado = 'fiado' 
        WHERE (deudor IS NOT NULL AND TRIM(deudor) != '')
           OR notas LIKE '%credito%' 
           OR notas LIKE '%fiado%'
      `, function(err) {
        if (err) {
          console.error("Error al restaurar créditos:", err);
        } else {
          console.log(`Se restauraron ${this.changes} pedidos a crédito.`);
        }
      });

      // 2. Mantener las mesas en 'libre'
      db.run("UPDATE mesas SET estado = 'libre'", (err) => {
        if (!err) console.log("Mesas verificadas como libre.");
        if (typeof io !== 'undefined' && io) {
          io.emit('pedidos_actualizados');
          io.emit('mesas_actualizadas');
        }
        if (typeof emitirSincronizacionCompleta === 'function') {
          emitirSincronizacionCompleta();
        }
      });
    });
  }
});

// --- UTILIDADES DB ASINCRONAS GLOBALES ---
const util = require('util');
const dbAll = util.promisify(db.all.bind(db));
const dbGet = util.promisify(db.get.bind(db));

async function obtenerBalanceTurnoActivo() {
  try {
    const sesion = await dbGet(`
      SELECT * FROM caja_sesiones 
      WHERE fecha_cierre IS NULL OR fecha_cierre = ''
      ORDER BY id DESC 
      LIMIT 1
    `);
    console.log("🔍 RESULTADO SQL CAJA SESION ACTIVA:", sesion);
    
    if (!sesion) return null;

    const baseInicial = Number(sesion.base_inicial ?? sesion.monto_inicial ?? sesion.base ?? 0);

    // Sumar solo ventas efectivamente cobradas en este turno (excluyendo fiados)
    const ventasCobro = await dbGet(`
      SELECT COALESCE(SUM(total), 0) AS totalVentas
      FROM ventas 
      WHERE (metodo_pago IS NULL OR LOWER(metodo_pago) != 'fiado')
        AND datetime(fecha) >= datetime(?)
    `, [sesion.fecha_apertura]);

    // Sumar abonos de fiados recibidos durante este turno (si existe tabla abonos_fiados)
    let totalAbonosFiados = 0;
    try {
      const abonosRes = await dbGet(`
        SELECT COALESCE(SUM(monto), 0) AS totalAbonos
        FROM abonos_fiados 
        WHERE datetime(fecha) >= datetime(?)
      `, [sesion.fecha_apertura]);
      totalAbonosFiados = Number(abonosRes?.totalAbonos || 0);
    } catch (e) {
      totalAbonosFiados = 0;
    }

    // Sumar gastos/egresos del turno (solo efectivo resta de la caja física)
    let totalGastos = 0;
    let totalGastosEfectivo = 0;
    try {
      const gastosRes = await dbGet(`
        SELECT 
          COALESCE(SUM(monto), 0) AS totalGastos,
          COALESCE(SUM(CASE WHEN (LOWER(metodo_pago) = 'efectivo' OR metodo_pago IS NULL) THEN monto ELSE 0 END), 0) AS gastosEfectivo
        FROM gastos 
        WHERE datetime(fecha) >= datetime(?)
      `, [sesion.fecha_apertura]);
      totalGastos = Number(gastosRes?.totalGastos || 0);
      totalGastosEfectivo = Number(gastosRes?.gastosEfectivo || 0);
    } catch (e) {
      totalGastos = 0;
      totalGastosEfectivo = 0;
    }

    const totalVentasReales = Number(ventasCobro?.totalVentas || 0) + totalAbonosFiados;
    const totalEsperadoCaja = baseInicial + totalVentasReales - totalGastosEfectivo;

    return {
      ...sesion,
      id: sesion.id,
      fecha_apertura: sesion.fecha_apertura || sesion.created_at,
      base_inicial: baseInicial,
      monto_inicial: baseInicial,
      ventas_turno: totalVentasReales,
      gastos_turno: totalGastos,
      total_en_caja: totalEsperadoCaja
    };
  } catch (err) {
    console.error("Error calculando balance de turno activo:", err);
    return null;
  }
}

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
  const asegurarEsquemaPedidos = async () => {
    const columnas = ['uuid TEXT', 'mesa TEXT', 'tipo TEXT', 'items TEXT', 'total REAL', 'notas TEXT', 'estado TEXT', 'pagado INTEGER', 'fecha TEXT'];
    for (const col of columnas) {
      try {
        await new Promise((resolve, reject) => {
          db.run(`ALTER TABLE pedidos ADD COLUMN ${col}`, (err) => err ? reject(err) : resolve());
        });
      } catch (e) {
        // Ya existe la columna, continuar sin error
      }
    }
  };
  asegurarEsquemaPedidos();

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
      pagado INTEGER DEFAULT 0,
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
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      color TEXT
    )
  `);

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

  // 11. Abonos a Fiados / Créditos
  db.run(`
    CREATE TABLE IF NOT EXISTS abonos_fiados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deudor TEXT NOT NULL,
      monto REAL NOT NULL,
      metodo_pago TEXT DEFAULT 'Efectivo',
      pedido_id INTEGER,
      sesion_id INTEGER,
      fecha TEXT DEFAULT (datetime('now', 'localtime')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migraciones seguras (agregar columnas si no existen)
  db.run(`ALTER TABLE ventas ADD COLUMN deudor TEXT`, () => {});
  db.run(`ALTER TABLE ventas ADD COLUMN fecha_fiado TEXT`, () => {});
  db.run(`ALTER TABLE pedidos ADD COLUMN deudor TEXT`, () => {});
  db.run(`ALTER TABLE pedidos ADD COLUMN fecha_fiado TEXT`, () => {});
  db.run(`ALTER TABLE pedidos ADD COLUMN mesero_id TEXT`, () => {});
  db.run(`ALTER TABLE pedidos ADD COLUMN abono_parcial REAL DEFAULT 0`, () => {});

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
// Obtener los insumos que componen un producto específico
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

// Guardar o actualizar la receta de un producto
app.post('/api/productos/:id/insumos', (req, res) => {
  const productoId = req.params.id;
  const { ingredientes } = req.body; // Array de { insumo_id, cantidad }

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

// PUT - Actualizar producto completo (edición administrativa)
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
app.get('/api/caja/sesion-activa', async (req, res) => {
  const sesionActiva = await obtenerBalanceTurnoActivo();
  res.json({ sesion: sesionActiva });
});

// POST - Abrir Caja
app.post('/api/caja/abrir', (req, res) => {
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
          io.emit('caja:estado', {
            abierta: true,
            sesion: nuevaSesion,
            turno: nuevaSesion
          });
          io.emit('caja_actualizada', row);
          
          if (typeof emitirSincronizacionCompleta === 'function') {
            emitirSincronizacionCompleta();
          }
          
          res.json({ success: true, sesion: nuevaSesion || row });
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

const recibirPedidoHandler = async (req, res) => {
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
    if (typeof io !== 'undefined') {
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

app.post('/api/pedidos', recibirPedidoHandler);
app.post('/pedidos', recibirPedidoHandler);

// Endpoint 1: /api/pedidos
app.get('/api/pedidos', (req, res) => {
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

// Endpoint 2: /api/pedidos/pendientes
app.get('/api/pedidos/pendientes', (req, res) => {
  db.all("SELECT * FROM pedidos WHERE LOWER(estado) NOT IN ('cobrado', 'cancelado', 'archivado') AND (pagado = 0 OR pagado IS NULL) ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const respuesta = rows.map(r => ({ ...r, items: typeof r.items === 'string' ? JSON.parse(r.items || '[]') : (r.items || []) }));
    res.json(respuesta);
  });
});

// Endpoint Caja Pendientes: /api/caja/pendientes
app.get('/api/caja/pendientes', (req, res) => {
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

// GET - Obtener pedidos del día (activos)
app.get('/api/pedidos/date/:fecha', (req, res) => {
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

// POST - Actualizar estado general de un pedido y sus items en batch (Cocina)
app.post('/api/pedidos/estado', (req, res) => {
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

        io.emit('pedido_estado_cambiado', { uuid: row.uuid, id: row.id, items, nuevoEstado });
        io.emit('pedidos_actualizados');
        io.emit('actualizar_pedidos');
        broadcastComandasActivas();

        if (nuevoEstado === 'cuenta' || nuevoEstado === 'listo') {
          io.emit('pedido_listo_para_entregar', { uuid: row.uuid });
        }

        res.json({ success: true, items, estado: nuevoEstado });
      }
    );
  });
});

// PUT - Actualizar estado de item individual (calcula estado del pedido colectivamente)
app.put('/api/pedidos/:uuid/item/:itemIdx', (req, res) => {
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
        io.emit('pedido_estado_cambiado', { uuid: row.uuid, id: row.id, items, nuevoEstado: nuevoEstadoPedido });
        io.emit('cocina_item_cambiado', { pedidoId: row.uuid, id: row.id, itemIndex: idx, nuevoEstado });
        io.emit('pedidos_actualizados');
        io.emit('actualizar_pedidos');
        broadcastComandasActivas();

        if (nuevoEstado === 'listo') {
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

// DELETE - Completar/Cobrar pedido (cuando mesa se factura y se completa)
app.delete('/api/pedidos/:uuid', (req, res) => {
  const uuid = req.params.uuid;
  db.get(`SELECT id, mesa FROM pedidos WHERE uuid = ? OR id = ?`, [uuid, uuid], (err, row) => {
    if (err || !row) return res.status(400).json({ error: 'Pedido no encontrado' });
    
    // 1. Cerrar el pedido obligatoriamente con estado 'cobrado'
    db.run(
      `UPDATE pedidos SET estado = 'cobrado', pagado = 1 WHERE uuid = ? OR id = ?`,
      [uuid, uuid],
      (errUpdate) => {
        if (errUpdate) return res.status(400).json({ error: errUpdate.message });
        io.emit('pedido_completado_servidor', { uuid });
        io.emit('pedidos_actualizados');
        
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
                  if (!errMesas) io.emit('mesas_actualizadas', filasMesas);
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
app.get(['/api/pedidos/fiado', '/pedidos/fiado'], (req, res) => {
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
app.post('/api/fiados/abono', (req, res) => {
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
        // Notificar via WebSocket si existe io
        if (typeof io !== 'undefined') {
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
                              io.emit('inventario:actualizado');
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
              if (!errM) io.emit('mesas_actualizadas', rowsM);
            });
          });
          db.run(
            `UPDATE pedidos SET estado = 'cobrado', pagado = 1 WHERE (mesa = ? OR mesa = ? OR mesa_id = ?) AND estado NOT IN ('cobrado', 'cancelado', 'archivado', 'fiado', 'credito')`,
            [mesaNum, `Mesa ${mesaNum}`, mesaNum],
            () => {
              io.emit('pedidos_actualizados');
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
        io.emit('caja:estado', {
          abierta: Boolean(balanceActualizado),
          sesion: balanceActualizado,
          turno: balanceActualizado
        });
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
          io.emit('caja:estado', {
            abierta: Boolean(balanceActualizado),
            sesion: balanceActualizado,
            turno: balanceActualizado
          });
        })
        .catch(err => {
          res.status(400).json({ error: err.message });
        });
    }
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

  const resolveSesionId = new Promise((resolve) => {
    if (sesion_id && sesion_id !== 1) {
      resolve(sesion_id);
    } else {
      db.get(`SELECT id FROM caja_sesiones WHERE estado = 'abierta' ORDER BY id DESC LIMIT 1`, [], (err, row) => {
        resolve(row ? row.id : null);
      });
    }
  });

  // Sanitizar valor del gasto antes de insertar:
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

        // Sincronización en tiempo real
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
  const { rango, fecha } = req.query; // 'hoy', 'semana', 'mes', o 'YYYY-MM-DD'
  // Convierte timestamp UTC o texto ISO a fecha local YYYY-MM-DD
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

  // Consulta unificada de ventas y desglose de métodos de pago
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

    // Log de depuración para verificar en consola
    console.log(`[DASHBOARD DEBUG] Rango: ${rango || 'hoy'} | Ventas: ${ventas} | Efe: ${efectivo} | Trans: ${transferencia}`);
    
    // 2. Gastos
    db.get(`SELECT COALESCE(SUM(valor), 0) as total FROM gastos WHERE ${dateConditionGastos}`, [], (err, rGastos) => {
      const gastos = Number(rGastos?.total || 0);
      
      // 3. Gastos por categoría
      db.all(`SELECT categoria, SUM(valor) as total FROM gastos WHERE ${dateConditionGastos} GROUP BY categoria`, [], (err, catList) => {
        const gastosPorCategoria = catList || [];
        
        // 4. Últimos gastos
        db.all(`SELECT * FROM gastos WHERE ${dateConditionGastos} ORDER BY id DESC LIMIT 50`, [], (err, ultimosGastos) => {

                  // 6. Flujo de Ventas y Gastos
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

                      // 7. Sesiones de Caja
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

// GET - Insumos
app.get('/api/inventario/insumos', (req, res) => {
  db.all(`SELECT * FROM insumos ORDER BY nombre ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ insumos: rows });
  });
});

// POST - Crear Insumo
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

// POST - Registrar Movimiento (Entrada o Ajuste)
app.post('/api/inventario/insumos/:id/movimiento', (req, res) => {
  const insumoId = req.params.id;
  const { tipo, cantidad, motivo, fecha, usuario } = req.body;
  const fechaMov = fecha || new Date().toISOString().split('T')[0];

  // Ejecutar en transacción
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    db.get(`SELECT nombre, cantidad_actual, precio_compra, unidad FROM insumos WHERE id = ?`, [insumoId], (errInsumo, insumo) => {
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
        io.emit('pedidos_actualizados');
        io.emit('actualizar_pedidos');
        broadcastComandasActivas();
        
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
