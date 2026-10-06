const fs = require('fs');
['CajaModule.jsx','AdminModule.jsx'].forEach(f => {
  let c = fs.readFileSync('src/'+f,'utf8');
  // fix missing closing quote
  c = c.replace(/toast\.success\(`(.*)`\)/g, "toast.success(`$1`)");
  c = c.replace(/toast\.success\('(.*)'\)/g, "toast.success('$1')");
  c = c.replace(/toast\.success\("(.*)"\)/g, 'toast.success("$1")');
  
  // Actually, the previous regex removed the closing quote entirely.
  // The line became: toast.success(`Pago procesado exitosamente (${metodo}));
  // Or: toast.success('Usuario eliminado correctamente.);
  c = c.replace(/toast\.success\(`(.*?\))(?!\s*`)/g, "toast.success(`$1`)");
  c = c.replace(/toast\.success\(`(.*?)\)(?!\s*`)/g, "toast.success(`$1`)");
  
  // Let's just fix the specific broken lines
  c = c.replace(/toast\.success\(`Pago procesado exitosamente \(\$\{metodo\}\)\);/, "toast.success(`Pago procesado exitosamente (${metodo})`);");
  c = c.replace(/toast\.success\('Usuario eliminado correctamente\.\);/, "toast.success('Usuario eliminado correctamente.');");
  c = c.replace(/toast\.success\("Producto actualizado exitosamente\);/, "toast.success('Producto actualizado exitosamente');");
  c = c.replace(/toast\.success\("Producto creado exitosamente\);/, "toast.success('Producto creado exitosamente');");
  
  fs.writeFileSync('src/'+f, c);
});
