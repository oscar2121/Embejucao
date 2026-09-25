import { useState, useEffect } from 'react';
import { useAppStore } from './useSocket';
import { CajaModule } from './CajaModule';
import { PedidosModule } from './PedidosModule';
import { CocinaModuleV2 } from './CocinaModule';
import { AdminModule } from './AdminModule';
import './index.css';
import axios from 'axios';

// Interceptor global para añadir JWT a todas las peticiones
axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('userToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);
function App() {
  const DESKTOP_VERSION = '1.0.0';
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

  const isNewerVersion = (latest, current) => {
    const clean = (v) => String(v || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const [lMaj, lMin, lPat] = clean(latest);
    const [cMaj, cMin, cPat] = clean(current);
    if (lMaj !== cMaj) return lMaj > cMaj;
    if (lMin !== cMin) return lMin > cMin;
    return lPat > cPat;
  };

  const checkDesktopUpdates = async (manual = false) => {
    try {
      // Usar la misma base URL que los demas o localhost
      const host = serverUrl || 'http://localhost:3001';
      const res = await axios.get(`${host}/api/check-update?platform=desktop`);
      if (res.data && res.data.updateAvailable) {
        if (isNewerVersion(res.data.latestVersion, DESKTOP_VERSION)) {
          setUpdateInfo(res.data);
          setUpdateModalVisible(true);
        } else if (manual) {
          alert('El sistema ya está en la última versión (' + DESKTOP_VERSION + ')');
        }
      } else if (manual) {
        alert(res.data.message || 'Sin versiones disponibles');
      }
    } catch (e) {
      console.log('Error checking desktop updates:', e);
      if (manual) alert('Error al comprobar actualizaciones.');
    }
  };

  useEffect(() => {
    // Comprobar actualización automáticamente al arrancar
    checkDesktopUpdates();
  }, []);

  const [activeTab, setActiveTab] = useState('pedidos');
  const [pedidoEditando, setPedidoEditando] = useState(null);
  
  const { 
    isOnline, 
    serverUrl, 
    setServerUrl, 
    productos, 
    mesas, 
    pedidos,
    sesionActiva,
    setSesionActiva,
    adicionales,
    socket
  } = useAppStore();

  const navItems = [
    { id: 'pedidos', icon: '✈', title: 'Tomar Pedido' },
    { id: 'caja', icon: '📄', title: 'Caja / Factura' },
    { id: 'cocina', icon: '✓', title: 'Cocina / Checklist' },
    { id: 'admin', icon: '⚙', title: 'Configuración / Admin' },
  ];

  return (
    <div className="app-container">
      {/* TOP HEADER */}
      <header className="top-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '32px' }}>🍔</div>
          <div>MenuMaster POS</div>
        </div>
        <div style={{ flex: 1 }}></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
            <span>{isOnline ? 'Conectado' : 'Desconectado'}</span>
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* SIDEBAR COLUMNA IZQUIERDA */}
        <aside className="sidebar">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-icon-btn ${activeTab === item.id ? 'active' : ''}`}
              title={item.title}
              onClick={() => setActiveTab(item.id)}
            >
              {item.icon}
            </button>
          ))}
          <div style={{ flex: 1 }}></div>
          <div style={{ padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', marginBottom: '4px' }}>v{DESKTOP_VERSION}</span>
            <button 
              onClick={() => checkDesktopUpdates(true)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '18px' }}
              title="Buscar actualización"
            >
              🔄
            </button>
          </div>
        </aside>

        {/* COLUMNA CENTRAL Y DERECHA (MAIN CONTENT) */}
        <main className="main-content">
          {activeTab === 'caja' && (
            <div style={{ padding: '24px', width: '100%', overflow: 'auto' }}>
              <CajaModule 
                pedidos={pedidos} 
                mesas={mesas} 
                productos={productos} 
                serverUrl={serverUrl} 
                sesionActiva={sesionActiva} 
                setSesionActiva={setSesionActiva} 
                onEditPedido={(pedido) => {
                  setPedidoEditando(pedido);
                  setActiveTab('pedidos');
                }}
              />
            </div>
          )}
          
          {activeTab === 'pedidos' && (
            <PedidosModule 
              productos={productos} 
              mesas={mesas} 
              pedidos={pedidos}
              serverUrl={serverUrl} 
              adicionales={adicionales}
              pedidoEditando={pedidoEditando}
              setPedidoEditando={setPedidoEditando}
            />
          )}
          
          {activeTab === 'cocina' && (
            <div style={{ padding: '24px', width: '100%', overflow: 'auto' }}>
              <CocinaModuleV2 pedidos={pedidos} serverUrl={serverUrl} />
            </div>
          )}
          
          {activeTab === 'admin' && (
            <div style={{ padding: '24px', width: '100%', overflow: 'auto' }}>
              <AdminModule pedidos={pedidos} productos={productos} serverUrl={serverUrl} mesas={mesas} socket={socket} />
            </div>
          )}

          {!['pedidos', 'caja', 'cocina', 'admin'].includes(activeTab) && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', color: 'var(--text-light)' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚧</div>
              <h2 style={{ color: 'var(--text)' }}>Módulo en Construcción</h2>
              <p>Este módulo estará disponible próximamente.</p>
            </div>
          )}
        </main>
      </div>

      {/* UPDATE MODAL */}
      {updateModalVisible && updateInfo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ width: '400px', backgroundColor: 'var(--surface)', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ backgroundColor: 'var(--brand)', padding: '16px', textAlign: 'center', color: 'white' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>Actualización Disponible</h2>
              <p style={{ margin: 0, opacity: 0.8 }}>¡Hay una nueva versión para Desktop!</p>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div><small style={{ color: 'var(--text2)' }}>Versión actual</small><br/><strong>{DESKTOP_VERSION}</strong></div>
                <div style={{ textAlign: 'right' }}><small style={{ color: 'var(--text2)' }}>Nueva versión</small><br/><strong style={{ color: 'var(--green)' }}>{updateInfo.latestVersion}</strong></div>
              </div>
              <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '20px', maxHeight: '100px', overflowY: 'auto' }}>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: 'var(--text2)' }}>Novedades:</p>
                {updateInfo.releaseNotes && updateInfo.releaseNotes.map((n, i) => (
                  <p key={i} style={{ margin: '4px 0 0', fontSize: '13px' }}>• {n}</p>
                ))}
              </div>
              <button 
                onClick={() => {
                  if (updateInfo.downloadUrl) {
                    if (window.electronAPI && window.electronAPI.openExternal) {
                      window.electronAPI.openExternal(updateInfo.downloadUrl);
                    } else {
                      window.open(updateInfo.downloadUrl, '_blank');
                    }
                  }
                  setUpdateModalVisible(false); // Ocultar despus de clic
                }}
                style={{ width: '100%', padding: '12px', backgroundColor: 'var(--green)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Descargar e Instalar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

