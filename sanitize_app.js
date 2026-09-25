const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'App.js');
let content = fs.readFileSync(filePath, 'utf8');

// Icon and text replacements
const replacements = [
  ['âš / AdministraciÃ³n', '⚙️ Panel de Administración'],
  ['ðŸ’° / Ventas Hoy', '💵 Ventas Hoy'],
  ['ðŸ’¦ / Stock Bajo', '📦 Stock Bajo'],
  ['ðŸ” / Pedidos Activos', '🍔 Pedidos Activos'],
  ['âŒ / Pedidos Cancelados', '❌ Pedidos Cancelados'],
  ['ðŸ’° / Gastos del DÃa', '💸 Gastos del Día'],
  ['ðŸ›ï¸ / Balance Actual', 'Balance Actual'],
  ['GestiÃ³n de MenÃº', 'Gestión de Menú'],
  ['Finanzas / Gastos', 'Finanzas / Gastos'],
  ['GestiÃ³n de Usuarios', 'Gestión de Usuarios'],
  ['SESIÃ“N DE CAJA ACTIVA', 'SESIÓN DE CAJA ACTIVA'],
  ['Cartera / CrÃ©ditos', 'Cartera / Créditos'],
  ['Ventas del DÃa', 'Ventas del Día'],
  ['â Œ Cancelar', '❌ Cancelar'],
  ['âœ…', '✅'],
  ['âš ï¸ ', '⚠️'],
  ['ðŸ’° Cobrar', '💵 Cobrar'],
  ['ðŸ’°', '💵'],
  ['ðŸ‘¤', '👤'],
  ['ðŸ” ', '🍔'],
  ['ðŸ’¦', '📦'],
  ['âŒ ', '❌'],
  ['ðŸ›ï¸ ', '🏦'],
  ['âš ', '⚙️'],
  ['ðŸ‘¤ Nuevo Usuario', '👤 Nuevo Usuario'],
  ['ðŸ‘¤ Editar Usuario', '👤 Editar Usuario'],
  ['ðŸ‘¤ Usuarios del Sistema', '👤 Usuarios del Sistema'],
  ['ðŸ‘¨â€ ðŸ ½ Cocina', '👨‍🍳 Cocina'],
  ['Cocina', 'Cocina'],
  ['Mesero', 'Mesero'],
  ['Caja', 'Caja'],
  ['Administrador', 'Admin'],
  ['AdministraciÃ³n', 'Administración'],
  ['Ã³', 'ó'],
  ['Ã©', 'é'],
  ['Ã', 'í'], // be careful with single A tilde
  ['Ã¡', 'á'],
  ['Ãº', 'ú'],
  ['Ã±', 'ñ'],
  ['Â¿', '¿'],
];

// We should be careful replacing single letters like Ã. Let's do a strict sequence replace first.
const strictReplacements = {
  'âš / AdministraciÃ³n': '⚙️ Panel de Administración',
  'ðŸ’° / Ventas Hoy': '💵 Ventas Hoy',
  'ðŸ’¦ / Stock Bajo': '📦 Stock Bajo',
  'ðŸ” / Pedidos Activos': '🍔 Pedidos Activos',
  'âŒ / Pedidos Cancelados': '❌ Pedidos Cancelados',
  'ðŸ’° / Gastos del DÃa': '💸 Gastos del Día',
  'ðŸ›ï¸ / Balance Actual': ' Balance Actual',
  'GestiÃ³n de MenÃº': 'Gestión de Menú',
  'GestiÃ³n de Usuarios': 'Gestión de Usuarios',
  'SESIÃ“N DE CAJA ACTIVA': 'SESIÓN DE CAJA ACTIVA',
  'Cartera / CrÃ©ditos': 'Cartera / Créditos',
  'Ventas del DÃa': 'Ventas del Día',
  'â Œ Cancelar': '❌ Cancelar',
  'ðŸ’° Cobrar': '💵 Cobrar',
  'ðŸ‘¨â€ ðŸ ½ Cocina': '👨‍🍳 Cocina',
  'ðŸ’° Caja': '💵 Caja',
  'ðŸ‘¤ Admin': '👤 Admin',
  'ðŸ’°': '💵',
  'ðŸ‘¤': '👤',
  'ðŸ” ': '🍔',
  'ðŸ’¦': '📦',
  'âŒ ': '❌',
  'ðŸ›ï¸ ': '🏦',
  'âš ': '⚙️',
  'âš ï¸ ': '⚠️',
  'âœ…': '✅',
  'Ã³': 'ó',
  'Ã©': 'é',
  'Ã¡': 'á',
  'Ãº': 'ú',
  'Ã±': 'ñ',
  'Â¿': '¿',
  'Ã­': 'í',
  'Ã': 'í', // specific to 'í' as per earlier mojibake
};

let previousContent = content;

// Replace long strings first
for (const [bad, good] of Object.entries(strictReplacements)) {
  content = content.split(bad).join(good);
}

// Special case for 'í' if Ã alone is used
content = content.replace(/Ã/g, 'í');

// Fix the chulito if it got corrupted or replace literally
content = content.split('âœ“').join('✓');
content = content.split('✓ ').join('✓ '); // ensure spacing if needed

// We use 'binary' to prevent node from messing up the utf8 characters when writing?
// Actually, fs.writeFileSync with 'utf8' writes pure UTF-8 without BOM, which is exactly what React Native needs.
fs.writeFileSync(filePath, content, 'utf8');

console.log('App.js ha sido sanitizado estrictamente y guardado en UTF-8 puro.');
