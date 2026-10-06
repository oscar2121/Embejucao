const fs = require('fs');
let txt = fs.readFileSync('App.js', 'utf8');

const target = 'const total = calcularTotal(pedidoSel) || 0;';
const replacement = `const total = calcularTotal(pedidoSel) || 0;

      if (metodoPago === 'mixto') {
        const efectivoMonto = parseFloat(cleanNum(efectivoMixto)) || 0;
        if (efectivoMonto > total) {
          Alert.alert("⚠️ Cobro Excedido", "El monto en efectivo ingresado supera el total de la cuenta. Por favor, calcule y entregue el cambio, e ingrese el efectivo real exacto que entra a la caja (máximo el total del pedido).");
          return;
        }
      }`;

txt = txt.replace(target, replacement);

fs.writeFileSync('App.js', txt);
console.log('Validation added to App.js');
