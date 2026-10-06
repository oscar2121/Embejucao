const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'App.js');
let content = fs.readFileSync(appJsPath, 'utf8');

content = content.replace(
  `    const nuevoGasto = {
      descripcion: gastoDesc.trim(),
      categoria: gastoCat,
      valor: valorNum,
      sesion_id: sesionActiva ? sesionActiva.id : null
    };`,
  `    const nuevoGasto = {
      descripcion: gastoDesc.trim(),
      categoria: gastoCat,
      valor: valorNum,
      metodo_pago: typeof gastoMetodoPago !== 'undefined' ? gastoMetodoPago : 'efectivo',
      sesion_id: sesionActiva ? sesionActiva.id : null
    };`
);

// also let's check another place just in case:
content = content.replace(
  `      const res = await axios.post(\`\${baseCol}/gastos\`, {
        descripcion: formGasto.descripcion,
        categoria: formGasto.categoria,
        valor: parseFloat(cleanNum(formGasto.valor)),
        sesion_id: 1, // o dinámico
        usuario: loggedUser ? loggedUser.nombre : 'Mobile'
      }`,
  `      const res = await axios.post(\`\${baseCol}/gastos\`, {
        descripcion: formGasto.descripcion,
        categoria: formGasto.categoria,
        valor: parseFloat(cleanNum(formGasto.valor)),
        metodo_pago: formGasto.metodo_pago || 'efectivo',
        sesion_id: 1, // o dinámico
        usuario: loggedUser ? loggedUser.nombre : 'Mobile'
      }`
);

fs.writeFileSync(appJsPath, content, 'utf8');
console.log('Done.');
