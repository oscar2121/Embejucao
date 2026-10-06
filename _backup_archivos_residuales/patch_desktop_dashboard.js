const fs = require('fs');

let content = fs.readFileSync('desktop-app/src/AdminModule.jsx', 'utf8');

const regex = /<div style=\{\{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' \}\}>\s*<h2 style=\{\{ fontSize: '28px', color: 'var\(--brand\)', margin: 0 \}\}>Dashboard Financiero<\/h2>[\s\S]*?<\/div>\s*<\/div>/;

const replacement = `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '28px', color: 'var(--brand)', margin: 0 }}>Dashboard Financiero</h2>
            </div>

            {/* TARJETA DE CONTROL DE CAJA (TURNO ACTUAL O HISTÓRICO) */}
            <div style={{ backgroundColor: 'var(--surf)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border)', marginBottom: '24px', display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingRight: '20px', borderRight: '1px solid var(--border)' }}>
                <span style={{ fontSize: '14px', color: 'var(--text2)', fontWeight: 'bold' }}>Estado de Caja</span>
                {dashboardData?.sesion?.abierta ? (
                  <div style={{ color: '#16A34A', fontWeight: 'bold', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#16A34A' }}></div>
                    Abierta
                  </div>
                ) : (
                  <div style={{ color: '#DC2626', fontWeight: 'bold', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#DC2626' }}></div>
                    Cerrada
                  </div>
                )}
              </div>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Apertura</span>
                  <div style={{ fontWeight: '600', color: 'var(--text)' }}>
                    {dashboardData?.sesion?.apertura ? new Date(dashboardData.sesion.apertura).toLocaleString() : '--'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Cierre</span>
                  <div style={{ fontWeight: '600', color: 'var(--text)' }}>
                    {dashboardData?.sesion?.cierre ? new Date(dashboardData.sesion.cierre).toLocaleString() : 'En curso'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Base Inicial</span>
                  <div style={{ fontWeight: '600', color: 'var(--text)' }}>
                    {dashboardData?.sesion?.base ? \`$\${Number(dashboardData.sesion.base).toLocaleString()}\` : '$0'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Total Recaudado (Turno)</span>
                  <div style={{ fontWeight: 'bold', color: 'var(--brand)', fontSize: '16px' }}>
                    {dashboardData?.sesion?.recaudado ? \`$\${Number(dashboardData.sesion.recaudado).toLocaleString()}\` : '$0'}
                  </div>
                </div>
              </div>
            </div>

            {/* FILTROS DE FECHA Y RANGO */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 'bold', color: 'var(--text2)', marginRight: '8px' }}>Período:</span>
              {['hoy', 'ayer', 'semana', 'mes'].map(rango => (
                <button
                  key={rango}
                  onClick={() => setDashboardRango(rango)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: 'none',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    backgroundColor: dashboardRango === rango ? 'var(--orange)' : 'var(--surf2)',
                    color: dashboardRango === rango ? '#FFF' : 'var(--text2)',
                    textTransform: 'capitalize',
                    transition: 'all 0.2s'
                  }}
                >
                  {rango}
                </button>
              ))}
              
              <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: '16px', marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: '600' }}>Día Específico:</span>
                <input 
                  type="date" 
                  value={dashboardRango !== 'hoy' && dashboardRango !== 'ayer' && dashboardRango !== 'semana' && dashboardRango !== 'mes' ? dashboardRango : ''}
                  onChange={(e) => {
                    if(e.target.value) setDashboardRango(e.target.value);
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--surf)',
                    color: 'var(--text)',
                    fontFamily: 'inherit',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>`;

content = content.replace(regex, replacement);

fs.writeFileSync('desktop-app/src/AdminModule.jsx', content, 'utf8');
console.log('Patched AdminModule.jsx');
