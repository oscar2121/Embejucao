import { useState, useEffect } from 'react';
import axios from 'axios';

export function CocinaModule({ pedidos, serverUrl }) {
  // Solo mostramos pedidos activos que aún no han sido cobrados o cancelados
  const pedidosCocina = pedidos.filter(p => p.estado === 'activo' || p.estado === 'pendiente');

  // Función auxiliar para calcular tiempo transcurrido (similar a App.js)
  const obtenerMinutosTranscurridos = (fechaIso) => {
    if (!fechaIso) return 0;
    try {
      const ahora = new Date();
      const pedidoTime = new Date(fechaIso);
      const diffMs = ahora - pedidoTime;
      return Math.floor(diffMs / 60000);
    } catch(e) {
      return 0;
    }
  };

  const [tiempoTranscurrido, setTiempoTranscurrido] = useState({});

  // Actualizar los minutos transcurridos cada minuto
  useEffect(() => {
    const updateTimes = () => {
      const times = {};
      pedidosCocina.forEach(p => {
        times[p.uuid] = obtenerMinutosTranscurridos(p.fecha);
      });
      setTiempoTranscurrido(times);
    };
    
    updateTimes();
    const interval = setInterval(updateTimes, 60000);
    return () => clearInterval(interval);
  }, [pedidosCocina]);

  const toggleItemEstado = async (pedido, targetItem) => {
    // Clonamos el pedido y los items
    const pedidoActualizado = { ...pedido, items: [...pedido.items] };
    const originalIndex = pedidoActualizado.items.findIndex(i => i.id === targetItem.id);
    if (originalIndex === -1) return;
    const item = pedidoActualizado.items[originalIndex];
    
    // Cambiar estado del item
    item.estado = item.estado === 'preparando' ? 'listo' : 'preparando';
    
    // Verificar si todos los items DE COCINA están listos para marcar el pedido completo
    const itemsCocina = pedidoActualizado.items.filter(i => !(Number(i.cat) >= 8));
    const todosListos = itemsCocina.length > 0 && itemsCocina.every(i => i.estado === 'listo');
    pedidoActualizado.estado = todosListos ? 'cuenta' : 'activo';

    try {
      // Intentamos enviarlo por endpoint general (puede requerir ajuste según server.js exacto)
      await axios.post(`${serverUrl}/api/pedidos/estado`, { 
        uuid: pedidoActualizado.uuid, 
        items: pedidoActualizado.items,
        nuevoEstado: pedidoActualizado.estado 
      }, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      // Si el server rechaza o falla la ruta, lo ideal sería emitir por WebSocket.
    } catch (error) {
      console.warn('Fallback o error al actualizar estado, verificando server:', error);
    }
  };

  const cambiarEstadoPedidoCompleto = async (pedido, accion) => {
    const pedidoActualizado = { ...pedido, items: [...pedido.items] };
    
    if (accion === 'iniciar') {
      pedidoActualizado.estado = 'activo';
      pedidoActualizado.items.forEach(i => {
        if (!(Number(i.cat) >= 8)) i.estado = 'preparando';
      });
    } else if (accion === 'listo') {
      pedidoActualizado.estado = 'cuenta';
      pedidoActualizado.items.forEach(i => {
        if (!(Number(i.cat) >= 8)) i.estado = 'listo';
      });
    }

    try {
      await axios.post(`${serverUrl}/api/pedidos/estado`, { 
        uuid: pedidoActualizado.uuid, 
        items: pedidoActualizado.items,
        nuevoEstado: pedidoActualizado.estado 
      }, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
    } catch (error) {
      console.warn('Error al actualizar pedido completo:', error);
    }
  };

  const getColorTiempo = (minutos) => {
    if (minutos >= 20) return 'var(--red)';
    if (minutos >= 10) return 'var(--orange)';
    return 'var(--green)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '28px', color: 'var(--brand)' }}>Cocina en Vivo</h2>
        <div style={{ display: 'flex', gap: '16px', fontWeight: 'bold' }}>
          <span style={{ color: 'var(--text2)' }}>Comandas activas: {pedidosCocina.length}</span>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
        gap: '24px', 
        overflowY: 'auto', 
        paddingBottom: '24px',
        paddingRight: '8px'
      }}>
        {pedidosCocina.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', flexDirection: 'column', color: 'var(--text2)' }}>
            <p>La cocina está tranquila. No hay pedidos activos.</p>
          </div>
        ) : (
          pedidosCocina.map(pedido => {
            const mins = tiempoTranscurrido[pedido.uuid] || 0;
            const colorMins = getColorTiempo(mins);
            const rawItems = pedido.items || [];
            const items = [...rawItems].filter(it => !(Number(it.cat) >= 8)).sort((a, b) => {
              const getTipo = (cat) => {
                if (cat >= 1 && cat <= 5) return 1; // Comidas
                if (cat === 6 || cat === 7) return 2; // Jugos y Limonadas
                return 3; // Otros
              };
              return getTipo(a.cat) - getTipo(b.cat);
            });
            // Si el pedido no tiene ítems de cocina, no calculamos progreso
            const progreso = items.length > 0 ? (items.filter(i => i.estado === 'listo').length / items.length) * 100 : 0;
            
            if (items.length === 0) return null; // No mostrar pedidos que solo tengan bebidas de bar

            return (
              <div key={pedido.uuid} className="card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                {/* Cabecera de la Tarjeta */}
                <div style={{ backgroundColor: 'var(--brand)', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                  <div>
                    <h3 style={{ fontSize: '24px', margin: 0 }}>
                      Mesa {pedido.mesa}
                    </h3>
                    <span style={{ fontSize: '14px', opacity: 0.9, fontWeight: 'bold' }}>Pedido #{pedido.id}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: colorMins }}>
                      {mins} min
                    </span>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div style={{ height: '6px', backgroundColor: 'var(--surf2)', width: '100%' }}>
                  <div style={{ height: '100%', backgroundColor: 'var(--green)', width: `${progreso}%`, transition: 'width 0.3s ease' }}></div>
                </div>

                {/* Items del pedido */}
                <div style={{ padding: '16px', flex: 1, overflowY: 'auto', maxHeight: '300px' }}>
                  {items.map((item, idx) => (
                    <div 
                      key={idx}
                      onClick={() => toggleItemEstado(pedido, item)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px',
                        marginBottom: '8px',
                        backgroundColor: item.estado === 'listo' ? 'var(--surf2)' : 'white',
                        border: '1px solid',
                        borderColor: item.estado === 'listo' ? 'var(--green)' : 'var(--border)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        opacity: item.estado === 'listo' ? 0.6 : 1
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--orange)', minWidth: '24px', alignSelf: 'flex-start' }}>{item.cantidad}x</span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '16px', fontWeight: item.estado === 'listo' ? 'normal' : 'bold', textDecoration: item.estado === 'listo' ? 'line-through' : 'none' }}>
                            {item.nombre}
                          </span>
                          {item.nota ? (
                            <span style={{ fontSize: '14px', color: 'var(--text2)', fontStyle: 'italic', marginTop: '2px' }}>
                              📝 {item.nota}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid', borderColor: item.estado === 'listo' ? 'var(--green)' : 'var(--border)', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: item.estado === 'listo' ? 'var(--green)' : 'transparent' }}>
                        {item.estado === 'listo' && <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>✓</span>}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Footer Tarjeta */}
                <div style={{ padding: '16px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', backgroundColor: 'var(--surface)' }}>
                  {pedido.estado !== 'activo' && (
                    <button 
                      onClick={() => cambiarEstadoPedidoCompleto(pedido, 'iniciar')}
                      style={{ flex: 1, padding: '10px', backgroundColor: 'var(--orange)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      Iniciar
                    </button>
                  )}
                  <button 
                    onClick={() => cambiarEstadoPedidoCompleto(pedido, 'listo')}
                    style={{ flex: 1, padding: '10px', backgroundColor: 'var(--green)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Todo Listo
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
