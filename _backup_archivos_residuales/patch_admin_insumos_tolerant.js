const fs = require('fs');

let code = fs.readFileSync('desktop-app/src/AdminModule.jsx', 'utf8');

// 1. UPDATE cargarInventarioDesktop
const loadInventarioAnchor = `  const cargarInventarioDesktop = async () => {
    try {
      const [resIns, resMov] = await Promise.all([
        fetch(serverUrl + '/api/inventario/insumos', { headers: { 'ngrok-skip-browser-warning': 'true' } }).then(r => r.json()),
        fetch(serverUrl + '/api/inventario/movimientos', { headers: { 'ngrok-skip-browser-warning': 'true' } }).then(r => r.json())
      ]);
      if (resIns.insumos) setInsumos(resIns.insumos);
      if (resMov.movimientos) setMovimientos(resMov.movimientos);
    } catch (err) {
      console.error('Error cargando inventario en desktop:', err);
    }
  };`;

const loadInventarioNew = `  const cargarInventarioDesktop = async () => {
    try {
      // Usar la URL base configurada en Desktop o fallback a localhost:3000
      const baseUrl = window.location.port === '3000' ? '' : 'http://localhost:3000';
  
      const [resIns, resMov] = await Promise.all([
        fetch(\`\${baseUrl}/api/inventario/insumos\`).then(r => r.json()),
        fetch(\`\${baseUrl}/api/inventario/movimientos\`).then(r => r.json())
      ]);
  
      if (resIns?.insumos) {
        setInsumos(resIns.insumos);
      }
      if (resMov?.movimientos) {
        setMovimientos(resMov.movimientos);
      }
    } catch (err) {
      console.error('Error cargando inventario en Desktop:', err);
    }
  };`;

if (code.includes(loadInventarioAnchor)) {
    code = code.replace(loadInventarioAnchor, loadInventarioNew);
} else {
    // try fallback regex
    code = code.replace(/const cargarInventarioDesktop = async \(\) => \{[\s\S]*?console\.error\('Error cargando inventario en desktop:', err\);\s*\}\s*\};/, loadInventarioNew);
}

// 2. UPDATE TABLE MAPPING FOR INSUMOS
const tableAnchor = `                  {insumos.length === 0 ? (
                    <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)' }}>No hay insumos registrados</td></tr>
                  ) : (
                    insumos.map(ins => {
                      const bajoStock = ins.cantidad_actual <= ins.stock_minimo;
                      return (
                        <tr key={ins.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px', fontWeight: 'bold' }}>{ins.nombre}</td>
                          <td style={{ padding: '12px', color: bajoStock ? '#DC2626' : 'var(--text)' }}>
                            {ins.cantidad_actual} {ins.unidad}
                          </td>
                          <td style={{ padding: '12px' }}>{ins.stock_minimo} {ins.unidad}</td>
                          <td style={{ padding: '12px' }}>\${ins.precio_compra.toLocaleString()}</td>
                          <td style={{ padding: '12px' }}>
                            {bajoStock ? (
                              <span style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)', color: '#DC2626', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>Bajo Stock</span>
                            ) : (
                              <span style={{ backgroundColor: 'rgba(22, 163, 74, 0.1)', color: '#16A34A', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>OK</span>
                            )}
                          </td>
                          <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                            <button 
                              onClick={() => { setTipoMov('entrada'); setInsumoSel(ins); setModalMovVisible(true); }}
                              style={{ backgroundColor: 'var(--brand)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                              + INGRESO
                            </button>
                            <button 
                              onClick={() => { setTipoMov('ajuste'); setInsumoSel(ins); setModalMovVisible(true); }}
                              style={{ backgroundColor: 'var(--surf2)', color: 'var(--text)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                              AJUSTAR
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}`;

const tableNew = `                  {insumos && insumos.length > 0 ? (
                    insumos.map((ins) => {
                      const bajoStock = ins.cantidad_actual <= ins.stock_minimo;
                      return (
                        <tr key={ins.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px', fontWeight: 'bold' }}>{ins.nombre}</td>
                          <td style={{ padding: '12px', color: bajoStock ? '#DC2626' : 'var(--text)' }}>
                            {ins.cantidad_actual} {ins.unidad}
                          </td>
                          <td style={{ padding: '12px' }}>{ins.stock_minimo} {ins.unidad}</td>
                          <td style={{ padding: '12px' }}>\${Number(ins.precio_compra || 0).toLocaleString()}</td>
                          <td style={{ padding: '12px' }}>
                            {bajoStock ? (
                              <span style={{ color: '#DC2626', fontWeight: 'bold' }}>⚠️ Bajo Stock</span>
                            ) : (
                              <span style={{ color: '#16A34A', fontWeight: 'bold' }}>OK</span>
                            )}
                          </td>
                          <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                            <button 
                              onClick={() => { setTipoMov('entrada'); setInsumoSel(ins); setModalMovVisible(true); }}
                              style={{ backgroundColor: 'var(--brand)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                              + INGRESO
                            </button>
                            <button 
                              onClick={() => { setTipoMov('ajuste'); setInsumoSel(ins); setModalMovVisible(true); }}
                              style={{ backgroundColor: 'var(--surf2)', color: 'var(--text)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                              AJUSTAR
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                        No hay insumos registrados
                      </td>
                    </tr>
                  )}`;

if (code.includes(tableAnchor)) {
    code = code.replace(tableAnchor, tableNew);
} else {
    console.log("Could not find table mapping anchor");
}

fs.writeFileSync('desktop-app/src/AdminModule.jsx', code, 'utf8');
console.log("Patch successfully written to memory!");
