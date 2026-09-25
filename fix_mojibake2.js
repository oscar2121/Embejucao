const fs = require('fs');
let text = fs.readFileSync('App.js', 'utf8');

const map = {
  'âš™ï¸  Panel de AdministraciÃ³n': '⚙️ Panel de Administración',
  'ðŸ’° Ventas Hoy': '💵 Ventas Hoy',
  'ðŸ’¦ Stock Bajo': '📦 Stock Bajo',
  'ðŸ” Pedidos Activos': '🍔 Pedidos Activos',
  'âŒ Pedidos Cancelados': '❌ Pedidos Cancelados',
  'ðŸ’° Gastos del DÃa': '💸 Gastos del Día',
  'ðŸ›ï¸  Balance Actual': ' Balance Actual',
  'ðŸ›ï¸ Balance Actual': ' Balance Actual',

  'ðŸ ” GestiÃ³n de MenÃº': '🍔 Gestión de Menú',
  'ðŸ‘¤ GestiÃ³n de Usuarios': '👥 Gestión de Usuarios',
  'SESIÃ“N DE CAJA': 'SESIÓN DE CAJA',
  'Cartera / CrÃ©ditos': 'Cartera / Créditos',
  'Ventas del DÃa': 'Ventas del Día',

  'GestiÃ³n de MenÃº': 'Gestión de Menú',
  'GestiÃ³n de Usuarios': 'Gestión de Usuarios',

  'ðŸ’¸ Mesero': '💸 Mesero',
  'ðŸ’° Caja': '💵 Caja',
  'ðŸ‘¨â€ðŸ³ Cocina': '👨‍🍳 Cocina',

  'AdministraciÃ³n': 'Administración',
  'GestiÃ³n': 'Gestión',
  'MenÃº': 'Menú',
  'CrÃ©dito': 'Crédito',
  'DÃa': 'Día',
  'versiÃ³n': 'versión',
  'ActualizaciÃ³n': 'Actualización',
  'AÃ±adir': 'Añadir',
  'AÃ±adido': 'Añadido',
  'secciÃ³n': 'sección',
  'Ã©xito': 'éxito',
  'âœ…': '✅',
  'âš ï¸ ': '⚠️',
  'âšï¸ ': '⚠️',
  'ðŸŽ‰': '🎉',
  'ðŸ’µ': '💵',
  'ðŸ“²': '📱',
  'ðŸ‘¤': '👤',
  'ðŸ”’': '🔒',
  'ðŸŸ¢': '🟢',
  'ðŸ“‹': '📋',
  'â€¢': '•',
  'CÃ³digo': 'Código',
  'CategorÃa': 'Categoría',
  'ConfirmaciÃ³n': 'Confirmación',
  'EstÃ¡s': 'Estás',
  'configuraciÃ³n': 'configuración',
  'AutomÃ¡tica': 'Automática',
  'bÃ¡sica': 'básica',
  'acciÃ³n': 'acción',
  'Ãš': 'Ú'
};

for (const k in map) {
  text = text.split(k).join(map[k]);
}

fs.writeFileSync('App.js', text, 'utf8');
console.log("Done");
