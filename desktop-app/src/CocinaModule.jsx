import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export function CocinaModuleV2({ pedidos, serverUrl }) {
  console.log("RENDERIZANDO COCINA NUEVA V2");

  const [localPedidos, setLocalPedidos] = useState(pedidos || []);
  const isUpdating = useRef(false);

  useEffect(() => {
    if (!isUpdating.current) {
      setLocalPedidos(pedidos || []);
    }
  }, [pedidos]);

  // Función auxiliar para calcular tiempo transcurrido (similar a App.js)
  const obtenerMinutosTranscurridos = (fechaIso) => {
    if (!fechaIso) return 0;
    try {
      const ahora = new Date();
      const pedidoTime = new Date(fechaIso);
      const diffMs = ahora - pedidoTime;
      return Math.floor(diffMs / 60000);
    } catch (e) {
      return 0;
    }
  };

  // Filtrar únicamente pedidos activos (no cobrados, cancelados, archivados ni completados) y ocultar muy antiguos
  const pedidosCocina = localPedidos.filter(p =>
    !['cobrado', 'cancelado', 'archivado', 'completado'].includes(String(p.estado || '').toLowerCase()) &&
    obtenerMinutosTranscurridos(p.fecha) <= 1000
  );

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
    isUpdating.current = true;
    // Clonamos el pedido y los items
    const pedidoActualizado = { ...pedido, items: [...pedido.items] };
    const originalIndex = pedidoActualizado.items.findIndex(i => i.id === targetItem.id);
    if (originalIndex === -1) {
      isUpdating.current = false;
      return;
    }
    const item = pedidoActualizado.items[originalIndex];

    // Cambiar estado del item
    item.estado = item.estado === 'preparando' ? 'listo' : 'preparando';

    // Conservar estado activo del pedido (en_cocina o listo si todos estan listos)
    const itemsCocina = pedidoActualizado.items.filter(i => !(Number(i.cat) >= 8));
    const todosListos = itemsCocina.length > 0 && itemsCocina.every(i => i.estado === 'listo');
    pedidoActualizado.estado = todosListos ? 'listo' : 'en_cocina';

    // Optimistic Update
    setLocalPedidos(prev => prev.map(p => (p.uuid === pedido.uuid || p.id === pedido.id) ? pedidoActualizado : p));

    try {
      await axios.post(`${serverUrl}/api/pedidos/estado`, {
        uuid: pedidoActualizado.uuid || pedidoActualizado.id,
        items: pedidoActualizado.items,
        nuevoEstado: pedidoActualizado.estado
      }, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
    } catch (error) {
      console.warn('Fallback o error al actualizar estado, verificando server:', error);
      setLocalPedidos(pedidos || []);
    } finally {
      setTimeout(() => { isUpdating.current = false; }, 800);
    }
  };

  const handleMarcarTodosListos = async (pedido) => {
    isUpdating.current = true;
    const pedidoActualizado = { ...pedido, items: [...pedido.items] };

    pedidoActualizado.estado = 'listo';
    pedidoActualizado.items.forEach(i => {
      if (!(Number(i.cat) >= 8)) i.estado = 'listo';
    });

    // Optimistic Update
    setLocalPedidos(prev => prev.map(p => (p.uuid === pedido.uuid || p.id === pedido.id) ? pedidoActualizado : p));

    try {
      await axios.post(`${serverUrl}/api/pedidos/estado`, {
        uuid: pedidoActualizado.uuid || pedidoActualizado.id,
        items: pedidoActualizado.items,
        nuevoEstado: pedidoActualizado.estado
      }, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
    } catch (error) {
      console.warn('Error al marcar todo listo:', error);
      setLocalPedidos(pedidos || []);
    } finally {
      setTimeout(() => { isUpdating.current = false; }, 800);
    }
  };

  const handleDespacharComanda = async (pedido) => {
    isUpdating.current = true;
    const pedidoActualizado = { ...pedido, items: [...pedido.items] };

    // Despachar mesa explícitamente
    pedidoActualizado.estado = 'completado';

    // Optimistic Update: remover el pedido de la lista local inmediatamente
    setLocalPedidos(prev => prev.filter(p => p.uuid !== pedido.uuid && p.id !== pedido.id));

    try {
      await axios.post(`${serverUrl}/api/pedidos/estado`, {
        uuid: pedidoActualizado.uuid || pedidoActualizado.id,
        items: pedidoActualizado.items,
        nuevoEstado: pedidoActualizado.estado
      }, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
    } catch (error) {
      console.warn('Error al despachar comanda:', error);
      setLocalPedidos(pedidos || []);
    } finally {
      setTimeout(() => { isUpdating.current = false; }, 800);
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
        overflowY: 'auto',
        height: 'calc(100vh - 80px)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '16px',
        alignItems: 'start',
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
              <div key={pedido.uuid || pedido.id} className="card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '380px', maxHeight: '480px', backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                {/* Cabecera de la Tarjeta */}
                <div style={{ backgroundColor: '#1e293b', color: '#ffffff', padding: '12px 14px', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '24px', margin: 0 }}>
                      Mesa {pedido.mesa}
                    </h3>
                    <span style={{ fontSize: '14px', opacity: 0.9, fontWeight: 'bold' }}>Pedido #{pedido.id}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>
                      {pedido.estado === 'en_cocina' ? 'COCINANDO' : 'PENDIENTE'}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>
                      {mins} min
                    </span>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div style={{ height: '6px', backgroundColor: 'var(--surf2)', width: '100%' }}>
                  <div style={{ height: '100%', backgroundColor: 'var(--green)', width: `${progreso}%`, transition: 'width 0.3s ease' }}></div>
                </div>

                {/* Área de productos con scroll interno */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '12px',
                    maxHeight: '320px',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#cbd5e1 transparent'
                  }}
                >
                  {items.map((item, idx) => {
                    const obs = item.observaciones || item.nota || item.notas;
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px',
                          marginBottom: '8px',
                          height: 'auto',
                          borderRadius: '6px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderLeft: item.estado === 'listo' ? '4px solid #16a34a' : '4px solid #f59e0b',
                          opacity: item.estado === 'listo' ? 0.6 : 1,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {/* Información del Plato */}
                        <div style={{ flex: 1, paddingRight: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <span style={{
                              fontSize: '15px',
                              fontWeight: '700',
                              color: item.estado === 'listo' ? '#94a3b8' : '#0f172a',
                              textDecoration: item.estado === 'listo' ? 'line-through' : 'none'
                            }}>
                              {item.cantidad || 1}x {item.nombre}
                            </span>
                          </div>

                          {/* Adicionales */}
                          {Array.isArray(item.adicionales) && item.adicionales.length > 0 && (
                            <div style={{ marginTop: '2px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {item.adicionales.map((adic, aIdx) => {
                                const nombre = typeof adic === 'string' ? adic : adic?.nombre;
                                const cant = typeof adic === 'object' && Number(adic?.cantidad) > 1 ? `${adic.cantidad}x ` : '';
                                if (!nombre) return null;
                                return (
                                  <span
                                    key={aIdx}
                                    style={{
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      color: '#ea580c',
                                      letterSpacing: '0.2px'
                                    }}
                                  >
                                    + {cant}{nombre}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Observaciones */}
                          {Boolean(obs) && (
                            <div style={{
                              marginTop: '3px',
                              fontSize: '12px',
                              color: '#94a3b8',
                              fontStyle: 'italic'
                            }}>
                              📝 {obs}
                            </div>
                          )}
                        </div>

                        {/* Botón de estado */}
                        <div>
                          <button
                            onClick={() => toggleItemEstado(pedido, item)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              border: 'none',
                              backgroundColor: item.estado === 'listo' ? '#dcfce7' : '#f1f5f9',
                              color: item.estado === 'listo' ? '#15803d' : '#64748b'
                            }}
                          >
                            {item.estado === 'listo' ? '✓ Listo' : '⏳ Pendiente'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Tarjeta */}
                {(() => {
                  const todosListos = items.length > 0 && items.every(it => it.estado === 'listo');

                  return (
                    <div style={{ marginTop: 'auto', padding: '10px 12px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                      {!todosListos ? (
                        <button
                          onClick={() => handleMarcarTodosListos(pedido)}
                          style={{
                            width: '100%',
                            padding: '10px',
                            backgroundColor: '#e2e8f0',
                            color: '#334155',
                            borderRadius: '6px',
                            fontWeight: '700',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '13px'
                          }}
                        >
                          ✓ Marcar Todo Listo
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDespacharComanda(pedido)}
                          style={{
                            width: '100%',
                            padding: '10px',
                            backgroundColor: '#16a34a',
                            color: '#ffffff',
                            borderRadius: '6px',
                            fontWeight: '700',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '13px',
                            boxShadow: '0 2px 4px rgba(22, 163, 74, 0.3)'
                          }}
                        >
                          🚀 Despachar Comanda
                        </button>
                      )}
                    </div>
                  );
                })()}

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
