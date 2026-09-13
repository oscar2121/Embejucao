const fs = require('fs');
const glob = require('fs').readdirSync;
const path = require('path');

// Fix desktop app files
const desktopDir = path.join('desktop-app', 'src');
const files = fs.readdirSync(desktopDir).filter(f => f.endsWith('.jsx'));

files.forEach(f => {
  const filePath = path.join(desktopDir, f);
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix onChange for desktop that didn't have parentheses around e
  const vars = [
    'efectivoCliente', 'efectivoMixto', 'cierreReal', 'newProdPrice', 
    'gastoValor', 'insumoCant', 'insumoMin', 'insumoCompra', 'movCant',
    'efectivoCount', 'tarjetaCount', 'transferenciaCount'
  ];
  
  vars.forEach(v => {
    // Matches e => setVar(e.target.value) or (e) => setVar(e.target.value)
    const setRegexDOM = new RegExp(`onChange=\\{\\(?e\\)? => set${v.charAt(0).toUpperCase() + v.slice(1)}\\(e\\.target\\.value\\)\\}`, 'g');
    content = content.replace(setRegexDOM, `onChange={(e) => set${v.charAt(0).toUpperCase() + v.slice(1)}(formatNumberInput(e.target.value))}`);
  });

  // Also replace type="number" with type="text" inputMode="numeric" where appropriate in these modules
  // but only for our specific inputs. To be safe, let's just replace all type="number" with type="text" inputMode="numeric"
  content = content.replace(/type="number"/g, 'type="text" inputMode="numeric"');

  // Add validation to confirmarCobro in CajaModule
  if (f === 'CajaModule.jsx') {
    if (!content.includes('El efectivo a recibir no puede ser mayor')) {
      content = content.replace(
        `onClick={() => confirmarCobro({ type: 'Mixto', efectivo: parseFloat(cleanNum(efectivoMixto)) || 0, transferencia: Math.max(0, calcularTotal(pedidoACobrar) - (parseFloat(cleanNum(efectivoMixto)) || 0)) })}`,
        `onClick={() => {
                  const efectivoNum = parseFloat(cleanNum(efectivoMixto)) || 0;
                  const total = calcularTotal(pedidoACobrar);
                  if (efectivoNum > total) {
                    alert("El efectivo a recibir no puede ser mayor al total en un cobro mixto.");
                    return;
                  }
                  confirmarCobro({ type: 'Mixto', efectivo: efectivoNum, transferencia: total - efectivoNum });
                }}`
      );
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
});

// Now fix App.js mixed payment logic
let appContent = fs.readFileSync('App.js', 'utf8');
if (!appContent.includes('El efectivo no puede ser mayor al total del pedido')) {
  // Let's find procesarPago and inject the check.
  // In App.js, we need to find where "mixto" is processed.
  // Actually, we can inject it right before `if (metodoPago === 'efectivo' && efectivoParsed < totalNum)`
  // Or just find the procesarPago function. Let's do it safely.
  
  appContent = appContent.replace(
    /const efectivoParsed = parseInt\(cleanNum\(efectivoCliente\)\) \|\| 0;/,
    `const efectivoParsed = parseInt(cleanNum(efectivoCliente)) || 0;
    const efectivoMixtoParsed = parseInt(cleanNum(efectivoMixto)) || 0;
    
    if (metodoPago === 'mixto' && efectivoMixtoParsed > totalNum) {
      Alert.alert('Error', 'El efectivo no puede ser mayor al total del pedido en cobro mixto.');
      return;
    }`
  );
}
fs.writeFileSync('App.js', appContent, 'utf8');

console.log('Fixes applied.');
