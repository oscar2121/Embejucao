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

module.exports = {
  hashPin,
  logAuditoria,
  obtenerBalanceTurnoActivo
};
