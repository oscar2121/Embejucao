const fs = require('fs');
let code = fs.readFileSync('desktop-app/src/AdminModule.jsx', 'utf8');

const stateInjection = `const [historialCajas, setHistorialCajas] = useState([]);
  const [historialCajasFecha, setHistorialCajasFecha] = useState('');
  const [cajaSeleccionada, setCajaSeleccionada] = useState(null);
  const [modalCajaDetalleVisible, setModalCajaDetalleVisible] = useState(false);

  const cargarHistorialCajas = async () => {
    try {
      let url = \`\${serverUrl}/api/caja/historial-sesiones\`;
      if (historialCajasFecha) url += \`?fecha=\${historialCajasFecha}\`;
      const res = await axios.get(url);
      setHistorialCajas(res.data.sesiones || []);
    } catch (e) {
      console.error('Error al cargar historial cajas', e);
    }
  };

  const abrirDetalleCaja = async (sesionId) => {
    try {
      const res = await axios.get(\`\${serverUrl}/api/caja/sesion/\${sesionId}/detalle\`);
      setCajaSeleccionada(res.data);
      setModalCajaDetalleVisible(true);
    } catch (e) {
      alert('Error al cargar detalle de caja');
    }
  };

  useEffect(() => {
    if (adminTab === 'historial-cajas') {
      cargarHistorialCajas();
    }
  }, [adminTab, historialCajasFecha]);
`;

code = code.replace("const [adminTab, setAdminTab] = useState('dashboard');", "const [adminTab, setAdminTab] = useState('dashboard');\n  " + stateInjection);


const navButtonInjection = `<button onClick={() => setAdminTab('dashboard')} style={navBtnStyle(adminTab === 'dashboard')}>📊 Dashboard Financiero</button>
          <button onClick={() => setAdminTab('historial-cajas')} style={navBtnStyle(adminTab === 'historial-cajas')}>📦 Historial de Cajas</button>`;

code = code.replace("<button onClick={() => setAdminTab('dashboard')} \nstyle={navBtnStyle(adminTab === 'dashboard')}>📊 Dashboard de Hoy</button>", navButtonInjection);
// In case the new line is formatted differently:
code = code.replace("<button onClick={() => setAdminTab('dashboard')} style={navBtnStyle(adminTab === 'dashboard')}>📊 Dashboard de Hoy</button>", navButtonInjection);


const uiInjection = `
        {adminTab === 'historial-cajas' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '28px', color: 'var(--brand)', margin: 0 }}>Historial de Cajas / Turnos</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="date" 
                  value={historialCajasFecha} 
                  onChange={(e) => setHistorialCajasFecha(e.target.value)} 
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontFamily: 'inherit' }}
                />
                <button onClick={() => setHistorialCajasFecha('')} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--surf)', cursor: 'pointer' }}>Limpiar</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {historialCajas.map((sesion) => (
                <div 
                  key={sesion.id} 
                  className="hover-lift"
                  onClick={() => abrirDetalleCaja(sesion.id)}
                  style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', border: '1px solid var(--border)', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '8px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--brand)', fontSize: '18px' }}>Turno #{sesion.id}</span>
                    <span style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', backgroundColor: sesion.estado === 'abierta' ? 'var(--green)' : 'var(--border)', color: sesion.estado === 'abierta' ? 'white' : 'var(--text2)', fontWeight: 'bold' }}>{sesion.estado.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text2)' }}>
                    Apertura: {new Date(sesion.fecha_apertura).toLocaleString()}
                    {sesion.fecha_cierre && <br/>}
                    {sesion.fecha_cierre && \`Cierre: \${new Date(sesion.fecha_cierre).toLocaleString()}\`}
                  </div>
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text3)', fontSize: '14px' }}>Ventas: {formatCurrency(sesion.total_ventas)}</span>
                    <span style={{ color: 'var(--text3)', fontSize: '14px' }}>Gastos: {formatCurrency(sesion.total_gastos)}</span>
                  </div>
                  <div style={{ fontWeight: '800', fontSize: '20px', color: sesion.balance_neto >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    Balance: {formatCurrency(sesion.balance_neto)}
                  </div>
                </div>
              ))}
              {historialCajas.length === 0 && (
                <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>No se encontraron sesiones de caja en esta fecha.</div>
              )}
            </div>
          </div>
        )}

        {modalCajaDetalleVisible && cajaSeleccionada && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div className="animate-fade-in" style={{ backgroundColor: '#fdfdfd', borderRadius: '16px', padding: '32px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, color: 'var(--brand)', fontSize: '24px' }}>Detalle Turno #{cajaSeleccionada.sesion.id}</h2>
                <button onClick={() => setModalCajaDetalleVisible(false)} style={{ background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text3)' }}>✕</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div style={{ backgroundColor: 'var(--surf)', padding: '16px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text2)', textTransform: 'uppercase', fontWeight: 'bold' }}>Ingresos</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--green)' }}>{formatCurrency(cajaSeleccionada.sesion.total_ventas)}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px' }}>Efectivo: {formatCurrency(cajaSeleccionada.sesion.total_efectivo)}<br/>Transf: {formatCurrency(cajaSeleccionada.sesion.total_transferencia)}</div>
                </div>
                <div style={{ backgroundColor: 'var(--surf)', padding: '16px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text2)', textTransform: 'uppercase', fontWeight: 'bold' }}>Egresos (Gastos)</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--red)' }}>{formatCurrency(cajaSeleccionada.sesion.total_gastos)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: cajaSeleccionada.sesion.balance_neto >= 0 ? '#f0fdf4' : '#fef2f2', border: \`1px solid \${cajaSeleccionada.sesion.balance_neto >= 0 ? '#bbf7d0' : '#fecaca'}\`, borderRadius: '12px', marginBottom: '24px' }}>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: cajaSeleccionada.sesion.balance_neto >= 0 ? '#166534' : '#991b1b' }}>BALANCE NETO REAL</span>
                <span style={{ fontSize: '28px', fontWeight: '900', color: cajaSeleccionada.sesion.balance_neto >= 0 ? '#166534' : '#991b1b' }}>{formatCurrency(cajaSeleccionada.sesion.balance_neto)}</span>
              </div>

              {cajaSeleccionada.gastos && cajaSeleccionada.gastos.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '16px', color: 'var(--brand)', marginBottom: '12px' }}>Gastos de la sesión</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <tbody>
                      {cajaSeleccionada.gastos.map(g => (
                        <tr key={g.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 0' }}>{g.descripcion}</td>
                          <td style={{ padding: '12px 0', textAlign: 'right', color: 'var(--red)', fontWeight: 'bold' }}>{formatCurrency(g.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
`;

code = code.replace("{adminTab === 'historial' && (", uiInjection + "\n        {adminTab === 'historial' && (");

fs.writeFileSync('desktop-app/src/AdminModule.jsx', code);
console.log('AdminModule.jsx successfully updated');
