const fs = require('fs');
let text = fs.readFileSync('desktop-app/src/AdminModule.jsx', 'utf8');

const target = `                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Total Recaudado (Turno)</span>
                  <div style={{ fontWeight: 'bold', color: 'var(--brand)', fontSize: '16px' }}>
                    {dashboardData?.sesion?.recaudado ? \`\$\{Number(dashboardData.sesion.recaudado).toLocaleString()\}\` : '$0'}
                  </div>
                </div>`;

const replacement = `                {/* Columna Total Turno / Recaudado */}
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Total Turno</span>
                  <div style={{ fontWeight: '700', color: '#16A34A', fontSize: '15px' }}>
                    $\{Number(
                      dashboardData?.sesion?.ventas_turno ?? 
                      dashboardData?.sesion?.total_en_caja ?? 
                      dashboardData?.sesion?.total_recaudado ?? 
                      0
                    ).toLocaleString()\}
                  </div>
                </div>`;

text = text.replace(target, replacement);

const targetListener = `  useEffect(() => {
    loadUsuarios();
    loadDashboard();
  }, [serverUrl]);`;

const replacementListener = `  useEffect(() => {
    loadUsuarios();
    loadDashboard();
    
    if (socket) {
      const handleCajaEstado = (data) => {
        if (data?.sesion) {
          setDashboardData(prev => ({
            ...prev,
            sesion: data.sesion,
            cajaAbierta: Boolean(data.abierta)
          }));
        }
      };
      
      socket.on('caja:estado', handleCajaEstado);
      return () => {
        socket.off('caja:estado', handleCajaEstado);
      };
    }
  }, [serverUrl, socket]);`;

text = text.replace(targetListener, replacementListener);

// Also update the AdminModule signature
const targetSig = `export function AdminModule({ pedidos, productos, serverUrl, mesas }) {`;
const replacementSig = `export function AdminModule({ pedidos, productos, serverUrl, mesas, socket }) {`;
text = text.replace(targetSig, replacementSig);

fs.writeFileSync('desktop-app/src/AdminModule.jsx', text, 'utf8');
console.log('Patched correctly');
