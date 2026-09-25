const fs = require('fs');

let code = fs.readFileSync('desktop-app/src/AdminModule.jsx', 'utf8');

// 1. INJECT STATES
const stateAnchor = "const [adminTab, setAdminTab] = useState('dashboard');";
const stateInjection = `const [adminTab, setAdminTab] = useState('dashboard');

  const [insumos, setInsumos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [modalInsumoVisible, setModalInsumoVisible] = useState(false);
  const [modalMovVisible, setModalMovVisible] = useState(false);
  const [insumoSel, setInsumoSel] = useState(null);
  const [tipoMov, setTipoMov] = useState('entrada');

  const [formInsumo, setFormInsumo] = useState({
    nombre: '',
    unidad: 'Unidad',
    cantidad_actual: '',
    stock_minimo: '',
    precio_compra: ''
  });

  const [formMov, setFormMov] = useState({
    cantidad: '',
    motivo: ''
  });
`;
code = code.replace(stateAnchor, stateInjection);

// 2. INJECT FUNCTIONS
const functionsAnchor = "const handleAdminLogin = async (e) => {";
const functionsInjection = `
  const cargarInventarioDesktop = async () => {
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
  };

  const handleGuardarInsumo = async (e) => {
    e.preventDefault();
    if (!formInsumo.nombre.trim()) return alert('El nombre es requerido');
    try {
      const res = await fetch(serverUrl + '/api/inventario/insumos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({
          nombre: formInsumo.nombre.trim(),
          unidad: formInsumo.unidad,
          cantidad_actual: parseFloat(formInsumo.cantidad_actual) || 0,
          stock_minimo: parseFloat(formInsumo.stock_minimo) || 0,
          precio_compra: parseFloat(formInsumo.precio_compra) || 0,
          usuario: 'Admin Desktop'
        })
      });
      const data = await res.json();
      if (data.success) {
        setModalInsumoVisible(false);
        setFormInsumo({ nombre: '', unidad: 'Unidad', cantidad_actual: '', stock_minimo: '', precio_compra: '' });
        cargarInventarioDesktop();
      } else {
        alert('Error: ' + (data.error || 'No se pudo crear el insumo'));
      }
    } catch (err) {
      alert('Error de conexión al guardar insumo');
    }
  };

  const handleGuardarMovimiento = async (e) => {
    e.preventDefault();
    if (!formMov.cantidad || Number(formMov.cantidad) <= 0) return alert('Ingrese una cantidad válida');
    try {
      const res = await fetch(serverUrl + \`/api/inventario/insumos/\${insumoSel.id}/movimiento\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({
          tipo: tipoMov,
          cantidad: parseFloat(formMov.cantidad),
          motivo: formMov.motivo.trim() || (tipoMov === 'entrada' ? 'Entrada manual' : 'Ajuste manual'),
          usuario: 'Admin Desktop'
        })
      });
      const data = await res.json();
      if (data.success) {
        setModalMovVisible(false);
        setInsumoSel(null);
        setFormMov({ cantidad: '', motivo: '' });
        cargarInventarioDesktop();
      } else {
        alert('Error: ' + (data.error || 'No se pudo registrar el movimiento'));
      }
    } catch (err) {
      alert('Error al registrar movimiento');
    }
  };

const handleAdminLogin = async (e) => {`;
code = code.replace(functionsAnchor, functionsInjection);

// 3. INJECT USE-EFFECT LOGIC
const useEffectAnchor = "if (adminTab === 'adicionales') {";
const useEffectInjection = `if (adminTab === 'adicionales') {
      loadAdicionales();
    }
    if (adminTab === 'insumos') {
      cargarInventarioDesktop();
    }`;
code = code.replace("if (adminTab === 'adicionales') {\n      loadAdicionales();\n    }", useEffectInjection);

// 4. INJECT MENU BUTTON
const menuAnchor = "<button onClick={() => setAdminTab('adicionales')} style={navBtnStyle(adminTab === 'adicionales')}>🍟 Adicionales</button>";
const menuInjection = `<button onClick={() => setAdminTab('adicionales')} style={navBtnStyle(adminTab === 'adicionales')}>🍟 Adicionales</button>
          <button onClick={() => setAdminTab('insumos')} style={navBtnStyle(adminTab === 'insumos')}>📦 Insumos y Kardex</button>`;
code = code.replace(menuAnchor, menuInjection);

// 5. INJECT VIEW
const viewAnchor = "{adminTab === 'historial' && (";
const viewInjection = `{adminTab === 'insumos' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>📦 Control de Insumos y Stock</h2>
              <button 
                onClick={() => setModalInsumoVisible(true)}
                style={{ backgroundColor: 'var(--brand)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                + Nuevo Insumo
              </button>
            </div>

            <div style={{ backgroundColor: 'var(--surf)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '24px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text)' }}>Inventario Actual</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: 'var(--text)' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '12px' }}>Nombre</th>
                    <th style={{ padding: '12px' }}>Stock Actual</th>
                    <th style={{ padding: '12px' }}>Stock Mínimo</th>
                    <th style={{ padding: '12px' }}>Precio Compra</th>
                    <th style={{ padding: '12px' }}>Estado</th>
                    <th style={{ padding: '12px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {insumos.length === 0 ? (
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
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ backgroundColor: 'var(--surf)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text)' }}>Últimos Movimientos (Kardex)</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: 'var(--text)' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '12px' }}>Fecha</th>
                    <th style={{ padding: '12px' }}>Insumo</th>
                    <th style={{ padding: '12px' }}>Tipo</th>
                    <th style={{ padding: '12px' }}>Cantidad</th>
                    <th style={{ padding: '12px' }}>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)' }}>No hay movimientos recientes</td></tr>
                  ) : (
                    movimientos.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px' }}>{m.fecha}</td>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{m.insumo_nombre}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ 
                            backgroundColor: m.tipo === 'entrada' ? 'rgba(22, 163, 74, 0.1)' : 'rgba(234, 179, 8, 0.1)', 
                            color: m.tipo === 'entrada' ? '#16A34A' : '#EAB308', 
                            padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' 
                          }}>
                            {m.tipo}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>{m.cantidad} {m.unidad}</td>
                        <td style={{ padding: '12px', color: 'var(--text2)' }}>{m.motivo}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {adminTab === 'historial' && (`;
code = code.replace(viewAnchor, viewInjection);

// 6. INJECT MODALS
const modalsAnchor = "{userModalVisible && (";
const modalsInjection = `{modalInsumoVisible && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--surf)', padding: '24px', borderRadius: '12px', width: '400px', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>📦 Nuevo Insumo</h3>
            <form onSubmit={handleGuardarInsumo}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text2)' }}>Nombre del Insumo</label>
                <input required type="text" value={formInsumo.nombre} onChange={e => setFormInsumo({...formInsumo, nombre: e.target.value})} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text2)' }}>Unidad de Medida</label>
                <select value={formInsumo.unidad} onChange={e => setFormInsumo({...formInsumo, unidad: e.target.value})} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', boxSizing: 'border-box' }}>
                  <option value="Unidad">Unidad</option>
                  <option value="Kg">Kg</option>
                  <option value="Gramos">Gramos</option>
                  <option value="Litros">Litros</option>
                  <option value="Porción">Porción</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text2)' }}>Stock Inicial</label>
                  <input type="number" step="0.01" value={formInsumo.cantidad_actual} onChange={e => setFormInsumo({...formInsumo, cantidad_actual: e.target.value})} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text2)' }}>Stock Mínimo</label>
                  <input type="number" step="0.01" value={formInsumo.stock_minimo} onChange={e => setFormInsumo({...formInsumo, stock_minimo: e.target.value})} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text2)' }}>Precio de Compra</label>
                <input type="number" step="0.01" value={formInsumo.precio_compra} onChange={e => setFormInsumo({...formInsumo, precio_compra: e.target.value})} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalInsumoVisible(false)} style={{ padding: '10px 16px', backgroundColor: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                <button type="submit" style={{ padding: '10px 16px', backgroundColor: 'var(--brand)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Guardar Insumo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalMovVisible && insumoSel && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--surf)', padding: '24px', borderRadius: '12px', width: '400px', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>{tipoMov === 'entrada' ? 'Ingreso de' : 'Ajuste de'} {insumoSel.nombre}</h3>
            <form onSubmit={handleGuardarMovimiento}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text2)' }}>
                  {tipoMov === 'entrada' ? 'Cantidad a ingresar' : 'Nueva cantidad de stock física'} ({insumoSel.unidad})
                </label>
                <input required type="number" step="0.01" min="0.01" value={formMov.cantidad} onChange={e => setFormMov({...formMov, cantidad: e.target.value})} placeholder={tipoMov === 'entrada' ? 'Ej. 5' : \`Actual: \${insumoSel.cantidad_actual}\`} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text2)' }}>Motivo (Opcional)</label>
                <input type="text" value={formMov.motivo} onChange={e => setFormMov({...formMov, motivo: e.target.value})} placeholder={tipoMov === 'entrada' ? 'Ej. Compra de la semana' : 'Ej. Conteo físico'} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setModalMovVisible(false); setInsumoSel(null); }} style={{ padding: '10px 16px', backgroundColor: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                <button type="submit" style={{ padding: '10px 16px', backgroundColor: 'var(--brand)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {userModalVisible && (`;
code = code.replace(modalsAnchor, modalsInjection);

fs.writeFileSync('desktop-app/src/AdminModule.jsx', code, 'utf8');
console.log("Insumos module injected into Desktop!");
