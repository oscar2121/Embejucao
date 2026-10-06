const fs = require('fs');

let serverCode = fs.readFileSync('server.js', 'utf8');

const cajaHistoryEndpoints = `
// ─── HISTORIAL DE CAJAS / TURNOS PASADOS ───

app.get('/api/caja/historial-sesiones', (req, res) => {
  const { fecha } = req.query; // YYYY-MM-DD
  
  let query = \`
    SELECT 
      c.*,
      (SELECT SUM(total) FROM ventas WHERE sesion_id = c.id) as total_ventas,
      (SELECT SUM(valor) FROM gastos WHERE sesion_id = c.id) as total_gastos,
      (SELECT SUM(total) FROM ventas WHERE sesion_id = c.id AND metodo_pago = 'Efectivo') as total_efectivo,
      (SELECT SUM(total) FROM ventas WHERE sesion_id = c.id AND metodo_pago = 'Transferencia') as total_transferencia
    FROM caja_sesiones c
    WHERE 1=1
  \`;
  const params = [];
  
  if (fecha) {
    query += \` AND date(datetime(fecha_apertura, 'localtime')) = date(?)\`;
    params.push(fecha);
  }
  
  query += \` ORDER BY id DESC LIMIT 100\`;
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    // Transformar nulos en ceros
    const sesiones = rows.map(r => ({
      ...r,
      total_ventas: r.total_ventas || 0,
      total_gastos: r.total_gastos || 0,
      total_efectivo: r.total_efectivo || 0,
      total_transferencia: r.total_transferencia || 0,
      balance_neto: (r.total_ventas || 0) - (r.total_gastos || 0)
    }));
    res.json({ sesiones });
  });
});

app.get('/api/caja/sesion/:id/detalle', (req, res) => {
  const sesion_id = req.params.id;
  
  db.get(\`
    SELECT 
      c.*,
      (SELECT SUM(total) FROM ventas WHERE sesion_id = c.id) as total_ventas,
      (SELECT SUM(valor) FROM gastos WHERE sesion_id = c.id) as total_gastos,
      (SELECT SUM(total) FROM ventas WHERE sesion_id = c.id AND metodo_pago = 'Efectivo') as total_efectivo,
      (SELECT SUM(total) FROM ventas WHERE sesion_id = c.id AND metodo_pago = 'Transferencia') as total_transferencia
    FROM caja_sesiones c 
    WHERE id = ?\`, [sesion_id], (err, sesion) => {
    
    if (err || !sesion) return res.status(404).json({ error: 'Sesión no encontrada' });
    
    // Obtener gastos de la sesión
    db.all(\`SELECT * FROM gastos WHERE sesion_id = ? ORDER BY id DESC\`, [sesion_id], (err2, gastos) => {
      
      // Obtener ventas (opcional, para desglose de pedidos)
      db.all(\`SELECT * FROM ventas WHERE sesion_id = ? ORDER BY id DESC\`, [sesion_id], (err3, ventas) => {
        
        res.json({
          sesion: {
            ...sesion,
            total_ventas: sesion.total_ventas || 0,
            total_gastos: sesion.total_gastos || 0,
            total_efectivo: sesion.total_efectivo || 0,
            total_transferencia: sesion.total_transferencia || 0,
            balance_neto: (sesion.total_ventas || 0) - (sesion.total_gastos || 0)
          },
          gastos: gastos || [],
          ventas: ventas || []
        });
      });
    });
  });
});
`;

if (serverCode.includes('// GET - Dashboard Financiero Interactivo')) {
  serverCode = serverCode.replace('// GET - Dashboard Financiero Interactivo', cajaHistoryEndpoints + '\n// GET - Dashboard Financiero Interactivo');
  fs.writeFileSync('server.js', serverCode);
  console.log('Endpoints added successfully!');
} else {
  console.log('Marker not found!');
}
