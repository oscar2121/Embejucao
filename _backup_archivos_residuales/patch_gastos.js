const fs = require('fs');
let txt = fs.readFileSync('server.js', 'utf8');

const targetStr = `app.post('/api/gastos', authorize(['admin', 'caja']), (req, res) => {
  const { descripcion, categoria, valor, fecha, sesion_id } = req.body;
  const fechaGasto = fecha || new Date().toISOString().split('T')[0];
  const usuarioResp = req.user ? req.user.nombre : 'Desconocido';

  db.run(
    \`INSERT INTO gastos (descripcion, categoria, valor, fecha, sesion_id, usuario) VALUES (?, ?, ?, ?, ?, ?)\`,
    [descripcion, categoria, valor, fechaGasto, sesion_id, usuarioResp],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      logAuditoria(usuarioResp, 'gasto_registrado', \`Gasto registrado: \${descripcion} ($\${valor}) en cat. \${categoria}\`);
      res.json({ success: true, id: this.lastID });
    }
  );
});`;

const replaceStr = `app.post('/api/gastos', authorize(['admin', 'caja']), (req, res) => {
  const { descripcion, categoria, valor, fecha, sesion_id } = req.body;
  const fechaGasto = fecha || new Date().toISOString().split('T')[0];
  const usuarioResp = req.user ? req.user.nombre : 'Desconocido';

  const resolveSesionId = new Promise((resolve) => {
    if (sesion_id && sesion_id !== 1) {
      resolve(sesion_id);
    } else {
      db.get(\`SELECT id FROM caja_sesiones WHERE estado = 'abierta' ORDER BY id DESC LIMIT 1\`, [], (err, row) => {
        resolve(row ? row.id : null);
      });
    }
  });

  resolveSesionId.then((final_sesion_id) => {
    db.run(
      \`INSERT INTO gastos (descripcion, categoria, valor, fecha, sesion_id, usuario) VALUES (?, ?, ?, ?, ?, ?)\`,
      [descripcion, categoria, valor, fechaGasto, final_sesion_id, usuarioResp],
      function (err) {
        if (err) return res.status(400).json({ error: err.message });
        logAuditoria(usuarioResp, 'gasto_registrado', \`Gasto registrado: \${descripcion} ($\${valor}) en cat. \${categoria}\`);
        res.json({ success: true, id: this.lastID });
      }
    );
  });
});`;

if (txt.includes(targetStr)) {
  txt = txt.replace(targetStr, replaceStr);
  fs.writeFileSync('server.js', txt);
  console.log('Success updating server.js');
} else {
  console.log('Error: target not found in server.js');
}
