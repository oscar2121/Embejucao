const fs = require('fs');

let content = fs.readFileSync('src/AdminModule.jsx', 'utf8');

// 1. Rename 'productos' -> 'catalogo'
content = content.replace(/adminTab === 'productos'/g, "adminTab === 'catalogo'");
content = content.replace(/setAdminTab\('productos'\)/g, "setAdminTab('catalogo')");

// 2. Rename 'historial' -> 'facturas'
content = content.replace(/adminTab === 'historial'/g, "adminTab === 'facturas'");
content = content.replace(/setAdminTab\('historial'\)/g, "setAdminTab('facturas')");

// 3. Inject empty state fallbacks in `usuarios` and `auditoria`
// users:
content = content.replace(/usuarios\.map\(/g, "(usuarios || []).map(");
content = content.replace(/usuarios\.length === 0/g, "(usuarios || []).length === 0");
// audit:
content = content.replace(/auditoriaLogs\.slice/g, "(auditoriaLogs || []).slice");
content = content.replace(/auditoriaLogs\.length === 0/g, "(auditoriaLogs || []).length === 0");
content = content.replace(/auditoriaLogs\.filter/g, "(auditoriaLogs || []).filter");
// dashboard:
content = content.replace(/dashboardData\.gastosPorCategoria\.map/g, "(dashboardData?.gastosPorCategoria || []).map");
content = content.replace(/dashboardData\.ultimosGastos\.map/g, "(dashboardData?.ultimosGastos || []).map");

// 4. Inject missing views right above `adminTab === 'impresora'`
const missingViews = `
        {adminTab === 'adicionales' && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: '28px', color: 'var(--brand)', marginBottom: '24px' }}>Gestión de Adicionales</h2>
            
            <div 
              onClick={() => { setAdicionalEditando(null); setFormAdicional({ nombre: '', precio: '' }); setModalAdicionalVisible(true); }}
              style={{ padding: '20px', border: '2px dashed var(--orange)', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--orange)', fontWeight: 'bold', cursor: 'pointer', backgroundColor: 'rgba(232, 82, 10, 0.05)', transition: 'all 0.2s', marginBottom: '24px' }}
            >
              + Agregar Nuevo Adicional
            </div>

            {(adicionalesAdmin || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '16px', color: 'var(--text2)' }}>No hay adicionales configurados en el sistema.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {(adicionalesAdmin || []).map(adic => (
                  <div key={adic.id} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: 'var(--text)', fontSize: '16px' }}>{adic.nombre}</div>
                      <div style={{ color: 'var(--brand)', fontWeight: 'bold', fontSize: '14px', marginTop: '4px' }}>\${Number(adic.precio || 0).toLocaleString()}</div>
                    </div>
                    <button onClick={() => { setAdicionalEditando(adic); setFormAdicional({ nombre: adic.nombre, precio: adic.precio }); setModalAdicionalVisible(true); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px' }}>✏️</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {adminTab === 'facturas' && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: '28px', color: 'var(--brand)', marginBottom: '24px' }}>Historial de Facturas</h2>
            
            {(historialFacturas || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '16px', color: 'var(--text2)' }}>No se han registrado facturas todavía.</p>
              </div>
            ) : (
              <div style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: 'var(--surface)' }}>
                    <tr>
                      <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontWeight: '600' }}>ID / Mesa</th>
                      <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontWeight: '600' }}>Fecha</th>
                      <th style={{ padding: '16px', textAlign: 'right', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontWeight: '600' }}>Total</th>
                      <th style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontWeight: '600' }}>Método</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(historialFacturas || []).map(fac => (
                      <tr key={fac.id}>
                        <td style={{ padding: '16px', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>#{fac.id} (Mesa {fac.mesa})</td>
                        <td style={{ padding: '16px', borderBottom: '1px solid var(--border)', color: 'var(--text2)' }}>{new Date(fac.fecha).toLocaleString()}</td>
                        <td style={{ padding: '16px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--brand)', fontWeight: 'bold' }}>\${Number(fac.total || 0).toLocaleString()}</td>
                        <td style={{ padding: '16px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                          <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: fac.metodo_pago === 'efectivo' ? '#d1fae5' : '#dbeafe', color: fac.metodo_pago === 'efectivo' ? '#065f46' : '#1e40af', fontSize: '12px', fontWeight: 'bold' }}>{fac.metodo_pago}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {adminTab === 'mesas' && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: '28px', color: 'var(--brand)', marginBottom: '24px' }}>Gestión de Mesas</h2>
            
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)', marginBottom: '24px', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: '18px', color: 'var(--text)', marginBottom: '16px', marginTop: 0 }}>Configurar Cantidad de Mesas</h3>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: 'var(--text2)', marginBottom: '8px' }}>Número Total de Mesas (1 al 100)</label>
                  <input 
                    type="number" 
                    value={numMesasInput} 
                    onChange={e => setNumMesasInput(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '16px', outline: 'none' }} 
                  />
                </div>
                <button 
                  onClick={async () => {
                    try {
                      await window.axios.post(\`\${serverUrl}/api/mesas/configurar\`, { cantidad: parseInt(numMesasInput) });
                      // Socket should update automatically
                    } catch(e) {}
                  }}
                  style={{ padding: '12px 24px', backgroundColor: 'var(--brand)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', height: '46px' }}
                >
                  Guardar Mesas
                </button>
              </div>
            </div>

            {(mesas || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '16px', color: 'var(--text2)' }}>No hay mesas configuradas.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '16px' }}>
                {(mesas || []).map(m => (
                  <div key={m.num} style={{ backgroundColor: m.estado === 'libre' ? 'white' : (m.estado === 'ocupada' ? '#FEF2F2' : '#FFFBEB'), border: \`2px solid \${m.estado === 'libre' ? 'var(--border)' : (m.estado === 'ocupada' ? '#EF4444' : '#F59E0B')}\`, borderRadius: '16px', padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🪑</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text)' }}>Mesa {m.num}</div>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '8px', color: m.estado === 'libre' ? 'var(--text2)' : (m.estado === 'ocupada' ? '#DC2626' : '#D97706'), textTransform: 'uppercase' }}>
                      {m.estado}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
`;

content = content.replace(/\{adminTab === 'impresora' && \(/, missingViews + "\n        {adminTab === 'impresora' && (");

fs.writeFileSync('src/AdminModule.jsx', content, 'utf8');
console.log("Patched tabs correctly");
