/**
 * Determina si un producto o ítem de comanda debe enviarse/mostrarse en Cocina.
 * Regla: En cocina SÓLO entran comidas preparadas, jugos naturales y bebidas calientes.
 * Se excluyen cervezas, gaseosas, aguas embotelladas, licores, cócteles y jugos procesados/embotellados.
 */

export const normalizarTexto = (txt = '') => {
  return String(txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

export const esBebidaCocina = (item) => {
  if (!item) return false;
  const nombre = normalizarTexto(item.nombre || item.nombre_producto || '');
  const catTexto = normalizarTexto(item.categoria || item.categoria_nombre || item.cat || '');
  const catNum = Number(item.cat);

  // 1. Jugos Naturales, Limonadas preparadas y batidos
  const esJugoNatural = (nombre.includes('jugo') && !nombre.includes('hit')) ||
                        nombre.includes('limonada') ||
                        nombre.includes('batido') ||
                        nombre.includes('smoothie') ||
                        catNum === 6 || catNum === 7;

  // 2. Bebidas Calientes (excluyendo "perro caliente" que es comida)
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

export const esItemDeCocina = (item) => {
  if (!item) return false;
  const nombre = normalizarTexto(item.nombre || item.nombre_producto || '');
  const catTexto = normalizarTexto(item.categoria || item.categoria_nombre || item.cat || '');
  const catNum = Number(item.cat);

  // 1. Bebidas expresamente permitidas en cocina (calientes y jugos naturales)
  if (esBebidaCocina(item)) {
    return true;
  }

  // 2. Bebidas y licores excluidos de cocina (cervezas, gaseosas, botellas, licores)
  const terminosExcluidos = [
    'cerveza', 'corona', 'club colombia', 'poker', 'aguila', 'costena', 'heineken', 'stella', 'pola',
    'gaseosa', 'coca', 'postobon', 'colombiana', 'manzana', 'cuatro', 'quatro', 'sprite', 'pepsi',
    'hit', 'mr tea', 'soda', 'h2oh', 'red bull', 'energizante',
    'mojito', 'margarita', 'coctel', 'licor', 'aguardiente', 'ron', 'whisky', 'tequila', 'vodka', 'trago',
    'cervezas', 'licores', 'cocteles', 'bebidas frias'
  ];

  if (terminosExcluidos.some(t => nombre.includes(t) || catTexto.includes(t))) {
    return false;
  }
  if (nombre.includes('agua') || nombre.includes('botella') || nombre.includes('lata')) {
    return false;
  }
  if (catNum === 8) {
    return false; // Categoría licores / cervezas
  }
  if (catTexto === 'bebidas' || catTexto === 'bebida' || catTexto === 'bar' || catTexto === 'licores') {
    return false;
  }

  // 3. Comidas y platos preparados siempre entran a cocina
  return true;
};

export const esPedidoSalidoCocina = (p) => {
  if (!p) return false;
  const estadoLower = String(p.estado || '').toLowerCase().trim();
  if (['completado', 'despachado', 'cuenta', 'cobrado', 'entregado', 'listo'].includes(estadoLower)) {
    return true;
  }
  const items = Array.isArray(p.items) ? p.items : (typeof p.items === 'string' ? JSON.parse(p.items || '[]') : []);
  if (!Array.isArray(items) || items.length === 0) return false;

  // Si tiene ítems de cocina y todos están listos/despachados
  const itemsCocina = items.filter(esItemDeCocina);
  if (itemsCocina.length > 0 && itemsCocina.every(i => ['listo', 'despachado', 'entregado'].includes(String(i?.estado || '').toLowerCase()))) {
    return true;
  }
  // Si algún ítem individual ya fue despachado/marcado listo en cocina
  if (items.some(i => i && String(i.estado || '').toLowerCase() === 'listo')) {
    return true;
  }
  return false;
};

export const formatearHoraSegura = (val) => {
  if (!val) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed.includes('-') && !trimmed.includes('/') && !trimmed.includes('T') && /^\d{1,2}:\d{2}/.test(trimmed)) {
      return trimmed;
    }
  }
  let dateStr = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}(:\d{2})?/.test(dateStr)) {
    dateStr = dateStr.replace(' ', 'T') + 'Z';
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(dateStr)) {
    dateStr = dateStr + 'Z';
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Bogota'
  });
};

export const formatearFechaSegura = (val) => {
  if (!val) return '';
  let dateStr = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}(:\d{2})?/.test(dateStr)) {
    dateStr = dateStr.replace(' ', 'T') + 'Z';
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(dateStr)) {
    dateStr = dateStr + 'Z';
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Bogota'
  });
};
