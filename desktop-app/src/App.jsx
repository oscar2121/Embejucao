import { useState } from 'react';
import { useAppStore } from './useSocket';
import { CajaModule } from './CajaModule';
import { PedidosModule } from './PedidosModule';
import { CocinaModule } from './CocinaModule';
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
    adicionales
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
              serverUrl={serverUrl} 
              adicionales={adicionales}
              pedidoEditando={pedidoEditando}
              setPedidoEditando={setPedidoEditando}
            />
          )}
          
          {activeTab === 'cocina' && (
            <div style={{ padding: '24px', width: '100%', overflow: 'auto' }}>
              <CocinaModule pedidos={pedidos} serverUrl={serverUrl} />
            </div>
          )}
          
          {activeTab === 'admin' && (
            <div style={{ padding: '24px', width: '100%', overflow: 'auto' }}>
              <AdminModule pedidos={pedidos} productos={productos} serverUrl={serverUrl} mesas={mesas} />
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
    </div>
  );
}

export default App;

