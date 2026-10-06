const fs = require('fs');
let t = fs.readFileSync('App.js', 'utf8');

t = t.replace(
  "pedidos.filter(p => p.estado === 'activo').map(p => {",
  "pedidos.filter(p => p.estado === 'activo').map((p, idx) => {"
);
t = t.replace(
  /key=\{p\.uuid\}/g,
  "key={`${p.uuid}-${idx}`}"
);

t = t.replace(
  "pedidosCocina.map(p => (",
  "pedidosCocina.map((p, idx) => ("
);

t = t.replace(
  "pedidos.map(p => {",
  "pedidos.map((p, idx) => {"
);

t = t.replace(
  "fiados.map(f => {",
  "fiados.map((f, idx) => {"
);
t = t.replace(
  /key=\{f\.uuid\}/g,
  "key={`${f.uuid}-${idx}`}"
);

t = t.replace(
  "ventaDetallesItems.map((det) => (",
  "ventaDetallesItems.map((det, dIdx) => ("
);
t = t.replace(
  /key=\{det\.id\}/g,
  "key={det.id_item || det.id || dIdx}"
);

fs.writeFileSync('App.js', t);
console.log('Keys fixed.');
