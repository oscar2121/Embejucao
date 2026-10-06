const fs = require('fs');
let text = fs.readFileSync('App.js', 'utf8');

// 1. Move handlePaymentMethodChange
text = text.replace(
  /  const handlePaymentMethodChange = \(metodo\) => \{\r?\n    Keyboard\.dismiss\(\);\r?\n    setMetodoPago\(metodo\);\r?\n    if \(metodo !== 'mixto'\) setEfectivoMixto\(''\);\r?\n    if \(metodo !== 'fiado'\) setNombreDeudor\(''\);\r?\n  \};\r?\n\r?\n/,
  ''
);

text = text.replace(
  /(const \[showHistorialVentas, setShowHistorialVentas\] = useState\(false\);)/,
  `$1\n\n  const handlePaymentMethodChange = (metodo) => {\n    Keyboard.dismiss();\n    setMetodoPago(metodo);\n    if (metodo !== 'mixto') setEfectivoMixto('');\n    if (metodo !== 'fiado') setNombreDeudor('');\n  };`
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
// We need to safely wrap setPedidos, setVentas, and setMesas to use array functional updates
text = text.replace(
  /setVentas\(\[\.\.\.ventas, /g,
  `setVentas(prev => [...(Array.isArray(prev) ? prev : []), `
);
text = text.replace(
  /setPedidos\(pedidos\.filter\(p => p\.id !== pedidoSel\.id\)\);/,
  `setPedidos(prev => (Array.isArray(prev) ? prev : []).filter(p => p.id !== pedidoSel.id));`
);
text = text.replace(
  /setMesas\(mesas\.map\(m => m\.id === pedidoSel\.mesa_id \? \{ \.\.\.m, estado: 'libre' \} : m\)\);/,
  `setMesas(prev => (Array.isArray(prev) ? prev : []).map(m => m.id === pedidoSel.mesa_id ? { ...m, estado: 'libre' } : m));`
);

fs.writeFileSync('App.js', text, 'utf8');
console.log("Crash fixes applied.");
