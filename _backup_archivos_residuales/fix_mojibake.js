const fs = require('fs');

let content = fs.readFileSync('App.js', 'utf8');

const replacements = [
  // Emojis and specific strings from user
  ['âš™ï¸  Panel de AdministraciÃ³n', '?? Panel de Administración'],
  ['ğŸ’° Ventas Hoy', '?? Ventas Hoy'],
  ['ğŸ’¦ Stock Bajo', '?? Stock Bajo'],
  ['ğŸ” Pedidos Activos', '?? Pedidos Activos'],
  ['âŒ Pedidos Cancelados', '? Pedidos Cancelados'],
  ['ğŸ’° Gastos del DÃa', '?? Gastos del Día'],
  ['ğŸ›ï¸ Balance Actual', '?? Balance Actual'],

  ['GestiÃ³n de MenÃº', 'Gestión de Menú'],
  ['GestiÃ³n de Usuarios', 'Gestión de Usuarios'],
  ['SESIÃ“N DE CAJA', 'SESIÓN DE CAJA'],
  ['Cartera / CrÃ©ditos', 'Cartera / Créditos'],
  ['Ventas del DÃa', 'Ventas del Día'],

  ['ğŸ’¸ Mesero', '?? Mesero'],
  ['ğŸ’° Caja', '?? Caja'],
  ['ğŸ‘¨â€ğŸ³ Cocina', '????? Cocina'],

  // Other common corruptions caught by regex or string
  ['AdministraciÃ³n', 'Administración'],
  ['GestiÃ³n', 'Gestión'],
  ['MenÃº', 'Menú'],
  ['CrÃ©dito', 'Crédito'],
  ['DÃa', 'Día'],
  ['versiÃ³n', 'versión'],
  ['ActualizaciÃ³n', 'Actualización'],
  ['AÃ±adir', 'Añadir'],
  ['AÃ±adido', 'Añadido'],
  ['secciÃ³n', 'sección'],
  ['Ã©xito', 'éxito'],
  ['âœ…', '?'],
  ['âš ï¸ ', '??'],
  ['âšï¸ ', '??'],
  ['ğŸ‰', '??'],
  ['ğŸ’µ', '??'],
  ['ğŸ“²', '??'],
  ['ğŸ‘¤', '??'],
  ['ğŸ”’', '??'],
  ['ğŸŸ¢', '??'],
  ['ğŸ“‹', '??'],
  ['â€¢', '•'],
  ['CÃ³digo', 'Código'],
  ['CategorÃa', 'Categoría'],
  ['ConfirmaciÃ³n', 'Confirmación'],
  ['EstÃ¡s', 'Estás'],
  ['configuraciÃ³n', 'configuración'],
  ['AutomÃ¡tica', 'Automática'],
  ['bÃ¡sica', 'básica']
];

let newContent = content;
for (const [bad, good] of replacements) {
  // Use split/join to replace all occurrences globally
  newContent = newContent.split(bad).join(good);
}

fs.writeFileSync('App.js', newContent, 'utf8');
console.log('Mojibake fixed. UTF-8 applied.');
