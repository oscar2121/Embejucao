const { db, dbGet } = require('../database/db');
const crypto = require('crypto');

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

// Cálculo de balance de caja activo
async function obtenerBalanceTurnoActivo() {
  try {
    const sesion = await dbGet(`
      SELECT * FROM caja_sesiones 
      WHERE fecha_cierre IS NULL OR fecha_cierre = ''
      ORDER BY id DESC 
      LIMIT 1
    `);
    
    if (!sesion) return null;

    const baseInicial = Number(sesion.base_inicial ?? sesion.monto_inicial ?? sesion.base ?? 0);

    // Sumar solo ventas efectivamente cobradas en este turno (excluyendo fiados)
    const ventasCobro = await dbGet(`
      SELECT COALESCE(SUM(total), 0) AS totalVentas
      FROM ventas 
      WHERE (metodo_pago IS NULL OR LOWER(metodo_pago) != 'fiado')
        AND datetime(fecha) >= datetime(?)
    `, [sesion.fecha_apertura]);

    // Sumar abonos de fiados recibidos durante este turno
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
          COALESCE(SUM(CASE WHEN (LOWER(metodo_pago) = 'efectivo' OR metodo_pago IS NULL) AND (fuente_financiamiento IS NULL OR TRIM(fuente_financiamiento) = '' OR LOWER(fuente_financiamiento) = 'caja_negocio') THEN monto ELSE 0 END), 0) AS gastosEfectivo
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

const normalizarTexto = (txt = '') => {
  return String(txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const esBebidaCocina = (item) => {
  if (!item) return false;
  const nombre = normalizarTexto(item.nombre || item.nombre_producto || '');
  const catTexto = normalizarTexto(item.categoria || item.categoria_nombre || item.cat || '');
  const catNum = Number(item.cat);

  const esJugoNatural = (nombre.includes('jugo') && !nombre.includes('hit')) ||
                        nombre.includes('limonada') ||
                        nombre.includes('batido') ||
                        nombre.includes('smoothie') ||
                        catNum === 6 || catNum === 7;

  const esBebidaCaliente = !nombre.includes('perro') && (
    nombre.includes('caliente') ||
    catTexto.includes('caliente') ||
    nombre.includes('cafe') ||
    nombre.includes('tinto') ||
    nombre.includes('chocolate') ||
    nombre.includes('aromatica') ||
    nombre.includes('capuchino') ||
    catNum === 9
  );

  return Boolean(esJugoNatural || esBebidaCaliente);
};

const esItemDeCocina = (item) => {
  if (!item) return false;
  const nombre = normalizarTexto(item.nombre || item.nombre_producto || '');
  const catTexto = normalizarTexto(item.categoria || item.categoria_nombre || item.cat || '');
  const catNum = Number(item.cat);

  if (esBebidaCocina(item)) return true;

  const terminosExcluidos = [
    'cerveza', 'corona', 'club colombia', 'poker', 'aguila', 'costena', 'heineken', 'stella', 'pola',
    'gaseosa', 'coca', 'postobon', 'colombiana', 'manzana', 'cuatro', 'quatro', 'sprite', 'pepsi',
    'hit', 'mr tea', 'soda', 'h2oh', 'red bull', 'energizante',
    'mojito', 'margarita', 'coctel', 'licor', 'aguardiente', 'ron', 'whisky', 'tequila', 'vodka', 'trago',
    'cervezas', 'licores', 'cocteles', 'bebidas frias'
  ];

  if (terminosExcluidos.some(t => nombre.includes(t) || catTexto.includes(t))) return false;
  if (nombre.includes('agua') || nombre.includes('botella') || nombre.includes('lata')) return false;
  if (catNum === 8) return false;
  if (catTexto === 'bebidas' || catTexto === 'bebida' || catTexto === 'bar' || catTexto === 'licores') return false;

  return true;
};

const esPedidoSalidoCocina = (p) => {
  if (!p) return false;
  const estadoLower = String(p.estado || '').toLowerCase().trim();
  if (['completado', 'despachado', 'cuenta', 'cobrado', 'entregado', 'listo'].includes(estadoLower)) {
    return true;
  }
  const items = Array.isArray(p.items) ? p.items : (typeof p.items === 'string' ? JSON.parse(p.items || '[]') : []);
  if (!Array.isArray(items) || items.length === 0) return false;

  const itemsCocina = items.filter(esItemDeCocina);
  if (itemsCocina.length > 0 && itemsCocina.every(i => ['listo', 'despachado', 'entregado'].includes(String(i?.estado || '').toLowerCase()))) {
    return true;
  }
  if (items.some(i => i && String(i.estado || '').toLowerCase() === 'listo')) {
    return true;
  }
  return false;
};

module.exports = {
  hashPin,
  logAuditoria,
  obtenerBalanceTurnoActivo,
  esItemDeCocina,
  esBebidaCocina,
  esPedidoSalidoCocina
};
