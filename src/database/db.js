const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const util = require('util');
const crypto = require('crypto');

// Hashing helper para inicialización de usuarios
const hashPin = (pin, salt = 'embejucao-shared-key-2026') => {
  return crypto.createHmac('sha256', salt).update(pin).digest('hex');
};

const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../embejucao.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error conectando a SQLite:", err);
  } else {
    console.log("📦 SQLite conectado firmemente en:", dbPath);

    // Restaurar pedidos a crédito en la base de datos
    db.serialize(() => {
      // 1. Restaurar pedidos marcados como crédito / fiado para que vuelvan a la lista de Créditos
      db.run(`
        UPDATE pedidos 
        SET estado = 'fiado' 
        WHERE (deudor IS NOT NULL AND TRIM(deudor) != '')
           OR notas LIKE '%credito%' 
           OR notas LIKE '%fiado%'
      `, function(errCred) {
        if (errCred) {
          console.error("Error al restaurar créditos:", errCred);
        } else {
          console.log(`Se restauraron ${this.changes} pedidos a crédito.`);
        }
      });

      // 2. Mantener las mesas en 'libre'
      db.run("UPDATE mesas SET estado = 'libre'", (errMesa) => {
        if (!errMesa) console.log("Mesas verificadas como libre.");
        
        // Limpieza automática de pedidos fantasma de pruebas anteriores
        db.run(`
          UPDATE pedidos 
          SET estado = 'cancelado', notas = COALESCE(notas, '') || ' [Cancelado por sistema (Ghost Order)]'
          WHERE id = 77 OR (estado IN ('activo', 'pendiente', 'en_cocina', 'cocinando') AND datetime(fecha) <= datetime('now', '-2 hours'))
        `, function(errLimpieza) {
          if (!errLimpieza && this.changes > 0) {
            console.log(`Se limpiaron ${this.changes} pedidos fantasma atascados en cocina.`);
          }
          
          try {
            const { getIO, emitirSincronizacionCompleta } = require('../utils/socket');
            const io = getIO();
            if (io) {
              io.emit('pedidos_actualizados');
              io.emit('mesas_actualizadas');
              emitirSincronizacionCompleta();
            }
          } catch (e) {}
        });
      });
    });
  }
});

// Promisified wrappers para consultas asíncronas
const dbAll = util.promisify(db.all.bind(db));
const dbGet = util.promisify(db.get.bind(db));
const dbRun = (query, params = []) => new Promise((resolve, reject) => {
  db.run(query, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

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

  // --- TABLAS DEL SISTEMA ---

  // 1. Categorías y Productos
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
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      categoria TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      monto REAL NOT NULL,
      metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
      usuario_id INTEGER,
      caja_sesion_id INTEGER
    )
  `, () => {
    db.run(`ALTER TABLE gastos ADD COLUMN valor REAL`, () => {});
    db.run(`ALTER TABLE gastos ADD COLUMN monto REAL`, () => {});
    db.run(`ALTER TABLE gastos ADD COLUMN metodo_pago TEXT DEFAULT 'efectivo'`, () => {});
    db.run(`ALTER TABLE gastos ADD COLUMN usuario TEXT`, () => {});
    db.run(`ALTER TABLE gastos ADD COLUMN usuario_id INTEGER`, () => {});
    db.run(`ALTER TABLE gastos ADD COLUMN sesion_id INTEGER`, () => {});
    db.run(`ALTER TABLE gastos ADD COLUMN caja_sesion_id INTEGER`, () => {});
    db.run(`ALTER TABLE gastos ADD COLUMN grupo_afectado TEXT DEFAULT 'comida'`, () => {});
    db.run(`ALTER TABLE gastos ADD COLUMN fuente_financiamiento TEXT DEFAULT 'caja_negocio'`, () => {});
    db.run(`ALTER TABLE gastos ADD COLUMN origen_dinero TEXT DEFAULT 'caja_negocio'`, () => {});
    db.run(`ALTER TABLE gastos ADD COLUMN uuid TEXT UNIQUE`, () => {});
    db.run(`UPDATE gastos SET fuente_financiamiento = 'caja_negocio' WHERE fuente_financiamiento IS NULL`, () => {});
    db.run(`UPDATE gastos SET origen_dinero = 'caja_negocio' WHERE origen_dinero IS NULL`, () => {});
    db.run(`UPDATE gastos SET monto = valor WHERE (monto IS NULL OR monto = 0) AND valor IS NOT NULL AND valor > 0`, () => {});
    db.run(`UPDATE gastos SET valor = monto WHERE (valor IS NULL OR valor = 0) AND monto IS NOT NULL AND monto > 0`, () => {});
    db.run(`UPDATE gastos SET caja_sesion_id = sesion_id WHERE caja_sesion_id IS NULL AND sesion_id IS NOT NULL`, () => {});
    db.run(`UPDATE gastos SET sesion_id = caja_sesion_id WHERE sesion_id IS NULL AND caja_sesion_id IS NOT NULL`, () => {});
    db.run(`UPDATE gastos SET metodo_pago = 'efectivo' WHERE metodo_pago IS NULL OR TRIM(metodo_pago) = ''`, () => {});
    db.run(`UPDATE gastos SET grupo_afectado = 'comida' WHERE grupo_afectado IS NULL OR TRIM(grupo_afectado) = ''`, () => {});
    db.run(`UPDATE gastos SET fecha = datetime('now', 'localtime') WHERE fecha IS NULL OR TRIM(fecha) = ''`, () => {});
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

  // 4.1 Relación Producto - Insumos (Recetas)
  db.run(`
    CREATE TABLE IF NOT EXISTS producto_insumos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      insumo_id INTEGER NOT NULL,
      cantidad REAL NOT NULL DEFAULT 1,
      FOREIGN KEY(producto_id) REFERENCES productos(id) ON DELETE CASCADE,
      FOREIGN KEY(insumo_id) REFERENCES insumos(id) ON DELETE CASCADE
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

  // 8. Usuarios y Roles
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE,
      pin TEXT,
      rol TEXT,
      activo INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      nombre TEXT,
      descripcion TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS usuario_roles (
      usuario_id INTEGER,
      rol_id TEXT,
      PRIMARY KEY (usuario_id, rol_id),
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY(rol_id) REFERENCES roles(id) ON DELETE CASCADE
    )
  `);

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
  db.run(`ALTER TABLE productos ADD COLUMN imagen TEXT`, () => {});
  db.run(`ALTER TABLE productos ADD COLUMN grupo_reporte TEXT DEFAULT 'comida'`, () => {});
  db.run(`ALTER TABLE pedidos ADD COLUMN caja_sesion_id INTEGER`, () => {});

  // Tabla detalles_pedidos para reportes de productividad
  db.run(`
    CREATE TABLE IF NOT EXISTS detalles_pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER,
      producto_id INTEGER,
      cantidad INTEGER DEFAULT 1,
      precio_unitario REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      nombre TEXT
    )
  `, () => {
    // Backfill inicial de detalles_pedidos si está vacía
    db.get(`SELECT COUNT(*) as count FROM detalles_pedidos`, (errC, rowC) => {
      if (!errC && rowC && rowC.count === 0) {
        db.all(`SELECT id, items FROM pedidos WHERE items IS NOT NULL AND TRIM(items) != ''`, [], (errP, pedidosList) => {
          if (!errP && pedidosList && pedidosList.length > 0) {
            db.all(`SELECT id, nombre FROM productos`, [], (errPr, prods) => {
              const prodMap = new Map();
              (prods || []).forEach(p => prodMap.set(p.nombre.toLowerCase().trim(), p.id));

              const stmt = db.prepare(`INSERT INTO detalles_pedidos (pedido_id, producto_id, cantidad, precio_unitario, subtotal, nombre) VALUES (?, ?, ?, ?, ?, ?)`);
              pedidosList.forEach(ped => {
                try {
                  let items = typeof ped.items === 'string' ? JSON.parse(ped.items) : ped.items;
                  if (!Array.isArray(items)) return;
                  const flatItems = [];
                  items.forEach(it => {
                    if (it && Array.isArray(it.items)) {
                      it.items.forEach(sub => flatItems.push(sub));
                    } else if (it) {
                      flatItems.push(it);
                    }
                  });

                  flatItems.forEach(it => {
                    let prodId = it.producto_id || it.id;
                    const itNom = (it.nombre || '').toLowerCase().trim();
                    if (!prodId || isNaN(prodId)) {
                      for (const [nom, pid] of prodMap.entries()) {
                        if (itNom.startsWith(nom) || nom.startsWith(itNom)) {
                          prodId = pid;
                          break;
                        }
                      }
                    }
                    if (prodId) {
                      const cant = Number(it.cantidad || 1);
                      const precio = Number(it.precio || it.precio_unitario || 0);
                      const subtotal = Number(it.subtotal || (cant * precio));
                      stmt.run(ped.id, prodId, cant, precio, subtotal, it.nombre || '');
                    }
                  });
                } catch (e) {}
              });
              stmt.finalize();
            });
          }
        });
      }
    });
  });

  // Clasificación automática de base en 5 macro-grupos de productividad
  db.run(`
    UPDATE productos SET grupo_reporte = 'cervezas' 
    WHERE LOWER(categoria) LIKE '%cerveza%' OR LOWER(nombre) LIKE '%cerveza%' OR LOWER(nombre) LIKE '%corona%' OR LOWER(nombre) LIKE '%club colombia%' OR LOWER(nombre) LIKE '%aguila%' OR LOWER(nombre) LIKE '%poker%'
  `, () => {
    db.run(`
      UPDATE productos SET grupo_reporte = 'gaseosas_embotellados' 
      WHERE LOWER(categoria) IN ('gaseosas', 'bebidas') OR LOWER(nombre) LIKE '%gaseosa%' OR LOWER(nombre) LIKE '%coca cola%' OR LOWER(nombre) LIKE '%postobon%' OR LOWER(nombre) LIKE '%agua%' OR LOWER(nombre) LIKE '%hit%' OR LOWER(nombre) LIKE '%red bull%'
    `, () => {
      db.run(`
        UPDATE productos SET grupo_reporte = 'jugos_naturales' 
        WHERE LOWER(categoria) LIKE '%jugo%' OR LOWER(nombre) LIKE '%jugo%' OR LOWER(nombre) LIKE '%limonada%'
      `, () => {
        db.run(`
          UPDATE productos SET grupo_reporte = 'bebidas_calientes' 
          WHERE LOWER(nombre) LIKE '%cafe%' OR LOWER(nombre) LIKE '%tinto%' OR LOWER(nombre) LIKE '%aromatica%' OR LOWER(nombre) LIKE '%chocolate%' OR LOWER(nombre) LIKE '%cappuccino%'
        `, () => {
          db.run(`
            UPDATE productos SET grupo_reporte = 'comida' 
            WHERE grupo_reporte IS NULL OR grupo_reporte NOT IN ('cervezas', 'gaseosas_embotellados', 'jugos_naturales', 'bebidas_calientes')
          `, () => {
            // Rutina de consistencia contable: Backfill de pedidos cobrados sin detalles_pedidos
            db.run(`
              INSERT INTO detalles_pedidos (pedido_id, producto_id, cantidad, precio_unitario, subtotal, nombre)
              SELECT p.id, NULL, 1, p.total, p.total, 'Consumo'
              FROM pedidos p
              WHERE p.estado = 'cobrado' 
                AND p.id NOT IN (SELECT DISTINCT pedido_id FROM detalles_pedidos WHERE pedido_id IS NOT NULL);
            `, () => {
              // Asegurar que pedidos cobrados con total null o 0 se recalculen
              db.run(`
                UPDATE pedidos
                SET total = (
                  SELECT COALESCE(SUM(dp.cantidad * dp.precio_unitario), 0)
                  FROM detalles_pedidos dp
                  WHERE dp.pedido_id = pedidos.id
                )
                WHERE estado = 'cobrado' AND (total IS NULL OR total = 0);
              `, () => {
                // Reclasificación de gastos generales históricos que no son materia prima directa
                // Reclasificación de gastos generales históricos que no son materia prima directa
                db.run(`
                  UPDATE gastos
                  SET grupo_afectado = 'gastos_generales'
                  WHERE (grupo_afectado IS NULL OR grupo_afectado = '' OR grupo_afectado = 'comida')
                    AND (
                      LOWER(categoria) IN ('servicios', 'nómina', 'nomina', 'varios', 'mantenimiento', 'administrativo')
                      OR LOWER(descripcion) LIKE '%luz%'
                      OR LOWER(descripcion) LIKE '%arriendo%'
                      OR LOWER(descripcion) LIKE '%colaborador%'
                      OR LOWER(descripcion) LIKE '%empleado%'
                      OR LOWER(descripcion) LIKE '%servicio%'
                      OR LOWER(descripcion) LIKE '%nomina%'
                    );
                `, () => {
                  // Limpieza masiva al arrancar la BD: Cancelar pedidos fantasmas sin productos
                  db.run(`
                    UPDATE pedidos 
                    SET estado = 'cancelado' 
                    WHERE LOWER(estado) NOT IN ('cobrado', 'cancelado', 'archivado', 'fiado', 'credito')
                      AND (
                        id NOT IN (SELECT DISTINCT pedido_id FROM detalles_pedidos WHERE pedido_id IS NOT NULL)
                        OR items IS NULL OR TRIM(items) = '' OR TRIM(items) = '[]'
                      );
                  `, () => {
                    // Reseteo masivo de mesas que no tengan pedidos reales activos
                    db.run(`
                      UPDATE mesas 
                      SET estado = 'libre' 
                      WHERE num NOT IN (
                        SELECT DISTINCT CAST(REPLACE(mesa, 'Mesa ', '') AS INTEGER) 
                        FROM pedidos 
                        WHERE LOWER(estado) NOT IN ('cobrado', 'cancelado', 'archivado') AND mesa IS NOT NULL
                      )
                      AND id NOT IN (
                        SELECT DISTINCT CAST(REPLACE(mesa, 'Mesa ', '') AS INTEGER) 
                        FROM pedidos 
                        WHERE LOWER(estado) NOT IN ('cobrado', 'cancelado', 'archivado') AND mesa IS NOT NULL
                      );
                    `, () => {
                      // Limpieza automática de gastos huérfanos de insumos eliminados
                      db.all(`SELECT id, descripcion FROM gastos WHERE LOWER(descripcion) LIKE 'compra%:' OR LOWER(descripcion) LIKE 'entrada%:'`, [], (errG, rowsG) => {
                        if (!errG && rowsG && rowsG.length > 0) {
                          db.all(`SELECT LOWER(nombre) as nom FROM insumos`, [], (errI, rowsI) => {
                            if (!errI) {
                              const insSet = new Set((rowsI || []).map(i => (i.nom || '').trim()));
                              rowsG.forEach(r => {
                                const parts = (r.descripcion || '').split(': ');
                                const insNom = (parts[1] || '').split(' (')[0].trim().toLowerCase();
                                if (insNom && !insSet.has(insNom)) {
                                  db.run(`DELETE FROM gastos WHERE id = ?`, [r.id]);
                                }
                              });
                            }
                          });
                        }
                      });
                      console.log('✅ Mesas, pedidos y gastos huérfanos verificados y limpiados al iniciar la BD.');
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

  console.log('✅ Estructuras de tablas inicializadas de forma segura');

  // Inicializar usuarios por defecto si está vacío
  db.get(`SELECT COUNT(*) as count FROM usuarios`, (err, row) => {
    if (err) {
      console.error('Error checking usuarios table:', err);
      return;
    }
    if (row && row.count === 0) {
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

  // Inicializar catálogo de productos si está vacío
  db.get(`SELECT COUNT(*) as count FROM productos`, (err, row) => {
    if (err) {
      console.error('Error checking productos table:', err);
      return;
    }
    if (row && row.count === 0) {
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

db.dbAll = dbAll;
db.dbGet = dbGet;
db.dbRun = dbRun;
db.hashPin = hashPin;

module.exports = db;
module.exports.db = db;
module.exports.dbAll = dbAll;
module.exports.dbGet = dbGet;
module.exports.dbRun = dbRun;
module.exports.hashPin = hashPin;
