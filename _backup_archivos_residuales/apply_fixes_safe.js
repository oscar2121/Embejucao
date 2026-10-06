const fs = require('fs');

let text = fs.readFileSync('App.js', 'utf8');

// 1. Move handlePaymentMethodChange
text = text.replace(
  /  const handlePaymentMethodChange = \(metodo\) => \{\r?\n    Keyboard\.dismiss\(\);\r?\n    setMetodoPago\(metodo\);\r?\n    if \(metodo !== 'mixto'\) setEfectivoMixto\(''\);\r?\n    if \(metodo !== 'fiado'\) setNombreDeudor\(''\);\r?\n  \};\r?\n\r?\n/,
  ''
);

text = text.replace(
  /const \[showHistorialVentas, setShowHistorialVentas\] = useState\(false\);/,
  `const [showHistorialVentas, setShowHistorialVentas] = useState(false);\n\n  const handlePaymentMethodChange = (metodo) => {\n    Keyboard.dismiss();\n    setMetodoPago(metodo);\n    if (metodo !== 'mixto') setEfectivoMixto('');\n    if (metodo !== 'fiado') setNombreDeudor('');\n  };`
);

// 2. Add clientesGlobales props
text = text.replace(
  /ventas=\{ventas\}\r?\n            setVentas=\{setVentas\}/,
  `ventas={ventas}\n            setVentas={setVentas}\n            clientesGlobales={clientesGlobales}\n            setClientesGlobales={setClientesGlobales}`
);

text = text.replace(
  /cajaCobroModalVisible, setCajaCobroModalVisible, cierreModalVisible, setCierreModalVisible,\r?\n  fiados, setFiados,/,
  `cajaCobroModalVisible, setCajaCobroModalVisible, cierreModalVisible, setCierreModalVisible,\n  fiados, setFiados, clientesGlobales, setClientesGlobales,`
);

// 3. showToast
text = text.replace(
  /const showToast = \(msg\) => \{\r?\n    if \(toastTimer\.current\) clearTimeout\(toastTimer\.current\);\r?\n    setToast\(msg\);/,
  `const showToast = (msg) => {\n    if (toastTimer.current) clearTimeout(toastTimer.current);\n    setToast(String(msg || ''));`
);

// 4. confirmarCobro state setters
text = text.replace(
  /setVentas\(\[\{ id: Date\.now\(\), mesa: pedidoSel\?\.mesa \|\| '', total, metodo: metodoPago === 'efectivo' \? 'Efectivo' : \(metodoPago === 'mixto' \? 'Mixto' : 'Transferencia'\), hora: new Date\(\)\.toLocaleTimeString\("es-CO", \{ hour: "2-digit", minute: "2-digit" \}\) \}, \.\.\.ventas\]\);/,
  `setVentas(prev => [{ id: Date.now(), mesa: pedidoSel?.mesa || '', total, metodo: metodoPago === 'efectivo' ? 'Efectivo' : (metodoPago === 'mixto' ? 'Mixto' : 'Transferencia'), hora: new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) }, ...(Array.isArray(prev) ? prev : [])]);`
);
text = text.replace(
  /setPedidos\(pedidos\.filter\(p => p\.uuid !== pedidoSel\?\.uuid\)\);/,
  `setPedidos(prev => (Array.isArray(prev) ? prev : []).filter(p => p.uuid !== pedidoSel?.uuid));`
);
text = text.replace(
  /setMesas\(mesas\.map\(m => m\.num === mesaNumero \? \{ \.\.\.m, estado: 'libre' \} : m\)\);/,
  `setMesas(prev => (Array.isArray(prev) ? prev : []).map(m => m.num === mesaNumero ? { ...m, estado: 'libre' } : m));`
);

// 5. Liquidacion Fiado state setters
text = text.replace(
  /setVentas\(\[\{ id: Date\.now\(\), mesa: `👤 \$\{deudorSel\.deudor\}`, total: totalAcumulado, metodo: metodoLiq === 'efectivo' \? 'Efectivo' : 'Transferencia', hora: new Date\(\)\.toLocaleTimeString\("es-CO", \{ hour: "2-digit", minute: "2-digit" \}\) \}, \.\.\.ventas\]\);/,
  `setVentas(prev => [{ id: Date.now(), mesa: \`👤 \${deudorSel.deudor}\`, total: totalAcumulado, metodo: metodoLiq === 'efectivo' ? 'Efectivo' : 'Transferencia', hora: new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) }, ...(Array.isArray(prev) ? prev : [])]);`
);

fs.writeFileSync('App.js', text, 'utf8');
console.log("Crash fixes safely applied.");
