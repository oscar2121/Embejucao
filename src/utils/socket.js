const { dbAll } = require('../database/db');
const { obtenerBalanceTurnoActivo } = require('./helpers');

let io = null;

function setIO(ioInstance) {
  io = ioInstance;
}

function getIO() {
  return io;
}

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
  emitirSincronizacionCompleta();
}

async function emitirSincronizacionCompleta(targetSocket) {
  const currentIO = getIO();
  const emisor = targetSocket || currentIO;
  if (!emisor) return;

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

module.exports = {
  setIO,
  getIO,
  parsearItems,
  broadcastComandasActivas,
  emitirSincronizacionCompleta
};
