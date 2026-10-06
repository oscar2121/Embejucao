const fs = require('fs');

let serverCode = fs.readFileSync('server.js', 'utf8');

// 1. UPDATE /api/dashboard/financiero
const dashboardRegex = /app\.get\('\/api\/dashboard\/financiero', authorize\(\['admin'\]\), \(req, res\) => \{[\s\S]*?(?=\/\/ ─── INVENTARIO)/;

const newDashboardCode = `app.get('/api/dashboard/financiero', authorize(['admin']), (req, res) => {
  const { rango } = req.query; // 'hoy', 'semana', 'mes', o 'YYYY-MM-DD'
  const hoy = new Date().toISOString().split('T')[0];

  let sessionCondition = \`sesion_id IN (SELECT id FROM caja_sesiones WHERE estado = 'abierta')\`;
  let flowSelect = "strftime('%H:00', datetime(fecha, 'localtime')) as label";
  let dateConditionCaja = \`estado = 'abierta'\`;

  if (rango === 'semana') {
    sessionCondition = \`sesion_id IN (SELECT id FROM caja_sesiones WHERE date(datetime(fecha_apertura, 'localtime')) >= date('now', '-6 days', 'localtime'))\`;
    flowSelect = "date(datetime(fecha, 'localtime')) as label";
    dateConditionCaja = \`date(datetime(fecha_apertura, 'localtime')) >= date('now', '-6 days', 'localtime')\`;
  } else if (rango === 'mes') {
    sessionCondition = \`sesion_id IN (SELECT id FROM caja_sesiones WHERE strftime('%Y-%m', datetime(fecha_apertura, 'localtime')) = strftime('%Y-%m', 'now', 'localtime'))\`;
    flowSelect = "date(datetime(fecha, 'localtime')) as label";
    dateConditionCaja = \`strftime('%Y-%m', datetime(fecha_apertura, 'localtime')) = strftime('%Y-%m', 'now', 'localtime')\`;
  } else if (rango && /^\\d{4}-\\d{2}-\\d{2}$/.test(rango)) {
    sessionCondition = \`sesion_id IN (SELECT id FROM caja_sesiones WHERE date(datetime(fecha_apertura, 'localtime')) = '\${rango}')\`;
    dateConditionCaja = \`date(datetime(fecha_apertura, 'localtime')) = '\${rango}'\`;
  }

  // Si no hay sesiones en la condición, SQL lanzará 0 de todas formas.
  // 1. Ventas
  db.get(\`SELECT SUM(total) as total, COUNT(id) as count FROM ventas WHERE \${sessionCondition}\`, [], (err, rVentas) => {
    const ventas = rVentas ? rVentas.total || 0 : 0;
    const ventasCount = rVentas ? rVentas.count || 0 : 0;
    
    // 2. Gastos
    db.get(\`SELECT SUM(valor) as total FROM gastos WHERE \${sessionCondition}\`, [], (err, rGastos) => {
      const gastos = rGastos ? rGastos.total || 0 : 0;
      
      // 3. Gastos por categoría
      db.all(\`SELECT categoria, SUM(valor) as total FROM gastos WHERE \${sessionCondition} GROUP BY categoria\`, [], (err, catList) => {
        const gastosPorCategoria = catList || [];
        
        // 4. Últimos gastos
        db.all(\`SELECT * FROM gastos WHERE \${sessionCondition} ORDER BY id DESC LIMIT 50\`, [], (err, ultimosGastos) => {
          
          // 5. Métodos de pago
          db.get(\`SELECT SUM(total) as total FROM ventas WHERE (\${sessionCondition}) AND metodo_pago = 'Efectivo'\`, [], (err, rEfe) => {
            const efectivo = rEfe ? rEfe.total || 0 : 0;
            
            db.get(\`SELECT SUM(total) as total FROM ventas WHERE (\${sessionCondition}) AND metodo_pago = 'Transferencia'\`, [], (err, rTrans) => {
              const transferencia = rTrans ? rTrans.total || 0 : 0;

              // 6. Flujo de Ventas y Gastos
              db.all(\`SELECT \${flowSelect}, SUM(total) as total FROM ventas WHERE \${sessionCondition} GROUP BY label ORDER BY label ASC\`, [], (err, flujoVentas) => {
                
                db.all(\`SELECT \${flowSelect.replace('fecha', 'fecha')}, SUM(valor) as total FROM gastos WHERE \${sessionCondition} GROUP BY label ORDER BY label ASC\`, [], (err, flujoGastos) => {

                  // 7. Sesiones de Caja
                  db.all(\`SELECT * FROM caja_sesiones WHERE \${dateConditionCaja} ORDER BY id DESC\`, [], (err, cajaSesiones) => {

                    res.json({
                      rango: rango || 'hoy',
                      ventas,
                      gastos,
                      balance: ventas - gastos,
                      gastosPorCategoria,
                      ultimosGastos: ultimosGastos || [],
                      efectivo,
                      transferencia,
                      flujoVentas: flujoVentas || [],
                      flujoGastos: flujoGastos || [],
                      ventasCount,
                      cajaSesiones: cajaSesiones || []
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

`;

serverCode = serverCode.replace(dashboardRegex, newDashboardCode);

// 2. Add New Endpoints for Caja History
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

// Insert the new endpoints just before // ─── DASHBOARD Y REPORTE FINANCIERO ───
if (serverCode.includes('// ─── DASHBOARD Y REPORTE FINANCIERO ───')) {
  serverCode = serverCode.replace('// ─── DASHBOARD Y REPORTE FINANCIERO ───', cajaHistoryEndpoints + '\n// ─── DASHBOARD Y REPORTE FINANCIERO ───');
  fs.writeFileSync('server.js', serverCode);
  console.log('server.js updated successfully!');
} else {
  console.log('Error: Could not find // ─── DASHBOARD Y REPORTE FINANCIERO ─── marker');
}
