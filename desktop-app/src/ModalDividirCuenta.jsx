import React, { useState, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function ModalDividirCuenta({
  visible,
  onClose,
  pedido,              // Objeto completo del pedido activo ({ uuid, mesa, items, total, abono_parcial, ... })
  sesionId,            // ID de la sesión de caja activa
  serverUrl,           // URL del backend (ej. http://localhost:3001)
  onPagoCompletado     // Callback al procesar exitosamente un cobro parcial o total
}) {
  // Pestaña activa: 'por_items' (Modalidad A) o 'por_monto' (Modalidad B)
  const [modoDivision, setModoDivision] = useState('por_items');

  // Estado Modalidad A: mapa de cantidades seleccionadas para cobrar { [uniqueKey]: cantidadACobrar }
  const [seleccionados, setSeleccionados] = useState({});

  // Estado Modalidad B: partes iguales o monto libre
  const [partes, setPartes] = useState(2);
  const [montoManual, setMontoManual] = useState('');

  // Método de pago y estado de carga
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [propina, setPropina] = useState(0);
  const [procesando, setProcesando] = useState(false);

  // 1. Extraer ítems pendientes deserializando el JSON
  const itemsPendientes = useMemo(() => {
    if (!pedido?.items) return [];
    let lista = [];
    try {
      lista = typeof pedido.items === 'string' ? JSON.parse(pedido.items || '[]') : (pedido.items || []);
    } catch (e) {
      lista = [];
    }

    return lista.map((it, idx) => {
      const idKey = it.id || it.producto_id || `item-${idx}`;
      const cantidadTotal = Number(it.cantidad || 1);
      const cantidadYaPagada = Number(it.cantidad_pagada || 0);
      const restante = Math.max(0, cantidadTotal - cantidadYaPagada);

      return {
        ...it,
        uniqueKey: `${idKey}-${idx}`,
        itemIndex: idx,
        cantidadRestante: restante
      };
    }).filter(it => it.cantidadRestante > 0);
  }, [pedido]);

  // Saldo total pendiente en la mesa
  const totalMesa = useMemo(() => {
    return Number(pedido?.total || pedido?.total_estimado || 0);
  }, [pedido]);

  const abonoPrevio = useMemo(() => {
    return Number(pedido?.abono_parcial || 0);
  }, [pedido]);

  const saldoPendienteMesa = useMemo(() => {
    return Math.max(0, totalMesa - abonoPrevio);
  }, [totalMesa, abonoPrevio]);

  // Manejo de cantidades hacia la subcuenta (Modalidad A)
  const modificarCantidad = (key, delta, max) => {
    setSeleccionados(prev => {
      const actual = prev[key] || 0;
      const nuevo = Math.min(Math.max(0, actual + delta), max);
      if (nuevo === 0) {
        const copia = { ...prev };
        delete copia[key];
        return copia;
      }
      return { ...prev, [key]: nuevo };
    });
  };

  const seleccionarTodosLosPendientes = () => {
    const todos = {};
    itemsPendientes.forEach(it => {
      todos[it.uniqueKey] = it.cantidadRestante;
    });
    setSeleccionados(todos);
  };

  const limpiarSeleccion = () => {
    setSeleccionados({});
  };

  // 2. Cálculo del total en Modalidad A
  const { totalSubcuentaItems, itemsPayload } = useMemo(() => {
    let suma = 0;
    const items = [];

    itemsPendientes.forEach(it => {
      const cantElegida = seleccionados[it.uniqueKey] || 0;
      if (cantElegida > 0) {
        const prec = Number(it.precio || it.precio_unitario || 0);
        const sub = cantElegida * prec;
        suma += sub;
        items.push({
          id: it.id || it.producto_id,
          producto_id: it.producto_id || it.id,
          item_index: it.itemIndex,
          nombre: it.nombre,
          cantidad: cantElegida,
          precio: prec,
          subtotal: sub
        });
      }
    });

    return { totalSubcuentaItems: suma, itemsPayload: items };
  }, [itemsPendientes, seleccionados]);

  // 3. Cálculo del total en Modalidad B (Por partes / monto)
  const totalSubcuentaMonto = useMemo(() => {
    if (montoManual && Number(montoManual) > 0) {
      return Math.min(saldoPendienteMesa, Number(montoManual));
    }
    if (partes > 0 && saldoPendienteMesa > 0) {
      return Math.round(saldoPendienteMesa / partes);
    }
    return 0;
  }, [saldoPendienteMesa, partes, montoManual]);

  // Total a cobrar según el modo activo
  const totalACobrarFinal = modoDivision === 'por_items' ? totalSubcuentaItems : totalSubcuentaMonto;

  // 4. Procesar el cobro atómico
  const procesarCobroParcial = async () => {
    if (totalACobrarFinal <= 0) {
      toast.error('⚠️ Selecciona productos o ingresa un monto mayor a cero para cobrar.');
      return;
    }

    try {
      setProcesando(true);
      const targetUrl = (serverUrl && String(serverUrl).trim()) ? String(serverUrl).trim() : 'http://localhost:3001';

      const payload = {
        pedido_uuid: pedido.uuid,
        pedido_id: pedido.id,
        mesa: pedido.mesa,
        tipo_division: modoDivision,
        metodo_pago: metodoPago,
        sesion_id: sesionId,
        propina: Number(propina || 0)
      };

      if (modoDivision === 'por_items') {
        payload.items_a_pagar = itemsPayload;
      } else {
        payload.monto_abono = totalSubcuentaMonto;
      }

      const res = await axios.post(`${targetUrl}/api/ventas/pago-parcial`, payload, {
        timeout: 10000,
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (res.data && res.data.success) {
        toast.success(res.data.mensaje || 'Pago parcial registrado');
        setSeleccionados({});
        setMontoManual('');

        if (onPagoCompletado) {
          onPagoCompletado(res.data);
        }

        // Si la mesa quedó 100% saldada, cerrar el modal
        if (res.data.comanda_saldada) {
          toast.success('🎉 ¡Mesa saldada por completo y liberada!');
          onClose();
        }
      }
    } catch (error) {
      console.error('Error al procesar cobro parcial:', error);
      const serverMsg = error.response?.data?.error || error.message || 'Error al procesar el pago parcial';
      toast.error(`Error: ${serverMsg}`);
    } finally {
      setProcesando(false);
      if (typeof window !== 'undefined' && window.focus) {
        window.focus();
      }
    }
  };

  if (!visible || !pedido) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999,
      backdropFilter: 'blur(3px)'
    }}>
      <div style={{
        background: '#ffffff', width: '920px', maxWidth: '96vw', maxHeight: '92vh',
        borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.4)', border: '1px solid #e2e8f0'
      }}>
        
        {/* Cabecera */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#f8fafc'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px' }}>✂️</span>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
                Dividir Cuenta — Mesa {pedido.mesa || '1'}
              </h3>
              <span style={{
                backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 10px',
                borderRadius: '12px', fontSize: '12px', fontWeight: 'bold'
              }}>
                Pedido #{pedido.id || pedido.uuid?.substring(0, 6)}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              Total comanda: <strong>${totalMesa.toLocaleString('es-CO')}</strong>
              {abonoPrevio > 0 && (
                <> • Pagado: <span style={{ color: '#2563eb' }}>${abonoPrevio.toLocaleString('es-CO')}</span></>
              )}
              {' '}• Saldo restante: <strong style={{ color: '#16a34a' }}>${saldoPendienteMesa.toLocaleString('es-CO')}</strong>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={procesando}
            style={{
              background: '#f1f5f9', border: 'none', width: '36px', height: '36px',
              borderRadius: '50%', fontSize: '18px', cursor: 'pointer', color: '#64748b',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Selector de Modalidad (Por Ítems vs Por Monto) */}
        <div style={{
          display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f1f5f9',
          padding: '6px 24px', gap: '12px'
        }}>
          <button
            type="button"
            onClick={() => setModoDivision('por_items')}
            style={{
              padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              fontWeight: 'bold', fontSize: '14px', transition: 'all 0.2s',
              backgroundColor: modoDivision === 'por_items' ? '#ffffff' : 'transparent',
              color: modoDivision === 'por_items' ? '#0f172a' : '#64748b',
              boxShadow: modoDivision === 'por_items' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            🍽️ Modalidad A: Por Platos / Ítems
          </button>

          <button
            type="button"
            onClick={() => setModoDivision('por_monto')}
            style={{
              padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              fontWeight: 'bold', fontSize: '14px', transition: 'all 0.2s',
              backgroundColor: modoDivision === 'por_monto' ? '#ffffff' : 'transparent',
              color: modoDivision === 'por_monto' ? '#0f172a' : '#64748b',
              boxShadow: modoDivision === 'por_monto' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            👥 Modalidad B: En Partes Iguales / Por Monto
          </button>
        </div>

        {/* Contenido Principal */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', flex: 1, overflowY: 'auto' }}>
          
          {/* PANEL IZQUIERDO: CONFIGURADOR DE LO QUE PAGA ESTA PERSONA */}
          <div style={{ padding: '20px', borderRight: '1px solid #e2e8f0', background: '#f8fafc', overflowY: 'auto' }}>
            
            {modoDivision === 'por_items' ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>
                    Platos pendientes en mesa ({itemsPendientes.length})
                  </span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={seleccionarTodosLosPendientes}
                      style={{ fontSize: '12px', background: 'none', border: 'none', color: '#16a34a', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      Pagar todo
                    </button>
                    {Object.keys(seleccionados).length > 0 && (
                      <button
                        type="button"
                        onClick={limpiarSeleccion}
                        style={{ fontSize: '12px', background: 'none', border: 'none', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>

                {itemsPendientes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b' }}>
                    <span style={{ fontSize: '32px' }}>✅</span>
                    <p style={{ marginTop: '8px', fontWeight: 'bold' }}>Todos los ítems de esta mesa han sido cobrados.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {itemsPendientes.map(it => {
                      const enSubcuenta = seleccionados[it.uniqueKey] || 0;
                      const isSelected = enSubcuenta > 0;
                      return (
                        <div key={it.uniqueKey} style={{
                          background: isSelected ? '#f0fdf4' : '#ffffff',
                          border: isSelected ? '1.5px solid #86efac' : '1px solid #cbd5e1',
                          borderRadius: '12px', padding: '12px 16px',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          transition: 'all 0.15s'
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#1e293b' }}>
                              {it.nombre}
                            </div>
                            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                              ${Number(it.precio || 0).toLocaleString('es-CO')} c/u • Quedan por pagar: <strong>{it.cantidadRestante}</strong>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => modificarCantidad(it.uniqueKey, -1, it.cantidadRestante)}
                              disabled={enSubcuenta <= 0 || procesando}
                              style={{
                                width: '32px', height: '32px', borderRadius: '8px',
                                border: '1px solid #cbd5e1', background: '#ffffff',
                                cursor: enSubcuenta <= 0 ? 'not-allowed' : 'pointer',
                                fontSize: '16px', fontWeight: 'bold', color: '#334155'
                              }}
                            >
                              -
                            </button>
                            <span style={{ fontWeight: '900', fontSize: '16px', minWidth: '26px', textAlign: 'center', color: isSelected ? '#16a34a' : '#334155' }}>
                              {enSubcuenta}
                            </span>
                            <button
                              type="button"
                              onClick={() => modificarCantidad(it.uniqueKey, 1, it.cantidadRestante)}
                              disabled={enSubcuenta >= it.cantidadRestante || procesando}
                              style={{
                                width: '32px', height: '32px', borderRadius: '8px',
                                border: '1px solid #cbd5e1', background: '#e2e8f0',
                                cursor: enSubcuenta >= it.cantidadRestante ? 'not-allowed' : 'pointer',
                                fontSize: '16px', fontWeight: 'bold', color: '#0f172a'
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              /* Modalidad B: Calculadora de Partes Iguales o Abono Libre */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>
                    Dividir saldo en partes iguales
                  </span>
                  <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                    Elige entre cuántas personas se repartirá el saldo restante de <strong>${saldoPendienteMesa.toLocaleString('es-CO')}</strong>:
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  {[2, 3, 4, 5].map(n => {
                    const cuota = Math.round(saldoPendienteMesa / n);
                    const isSelected = partes === n && !montoManual;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setPartes(n);
                          setMontoManual('');
                        }}
                        style={{
                          padding: '14px 10px', borderRadius: '12px', border: isSelected ? '2px solid #16a34a' : '1px solid #cbd5e1',
                          backgroundColor: isSelected ? '#dcfce7' : '#ffffff',
                          cursor: 'pointer', textAlign: 'center'
                        }}
                      >
                        <div style={{ fontSize: '16px', fontWeight: '900', color: isSelected ? '#166534' : '#0f172a' }}>
                          1/{n} partes
                        </div>
                        <div style={{ fontSize: '12px', color: isSelected ? '#15803d' : '#64748b', marginTop: '4px', fontWeight: '600' }}>
                          ${cuota.toLocaleString('es-CO')} c/u
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Opción de monto libre personalizado */}
                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#334155', marginBottom: '6px' }}>
                    💵 O ingresa un abono personalizado:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#64748b' }}>$</span>
                    <input
                      type="number"
                      placeholder={`Máx: ${saldoPendienteMesa}`}
                      value={montoManual}
                      onChange={(e) => setMontoManual(e.target.value)}
                      style={{
                        flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1',
                        fontSize: '16px', fontWeight: 'bold'
                      }}
                    />
                    {montoManual && (
                      <button
                        type="button"
                        onClick={() => setMontoManual('')}
                        style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        Borrar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* PANEL DERECHO: LIQUIDACIÓN DE ESTA SUBCUENTA */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#ffffff' }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                Resumen de este cobro
              </span>

              {modoDivision === 'por_items' ? (
                itemsPayload.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '50px 16px', color: '#94a3b8', fontSize: '13px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🛒</div>
                    Haz clic en <strong>+</strong> al lado de cada producto para agregar lo que pagará esta persona.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                    {itemsPayload.map((it, pIdx) => (
                      <div key={pIdx} style={{
                        display: 'flex', justifyContent: 'space-between', fontSize: '14px',
                        padding: '6px 0', borderBottom: '1px dashed #f1f5f9'
                      }}>
                        <span style={{ color: '#1e293b' }}>
                          <strong>{it.cantidad}x</strong> {it.nombre}
                        </span>
                        <span style={{ fontWeight: 'bold', color: '#0f172a' }}>
                          ${it.subtotal.toLocaleString('es-CO')}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '13px', color: '#166534' }}>Modalidad por cuota / monto:</div>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: '#15803d', marginTop: '4px' }}>
                    ${totalSubcuentaMonto.toLocaleString('es-CO')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Resta tras este cobro: ${(Math.max(0, saldoPendienteMesa - totalSubcuentaMonto)).toLocaleString('es-CO')}
                  </div>
                </div>
              )}
            </div>

            {/* SECCIÓN INFERIOR: TOTAL Y MÉTODO DE PAGO */}
            <div style={{ borderTop: '2px dashed #cbd5e1', paddingTop: '16px', marginTop: '20px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px' }}>
                <span style={{ fontSize: '15px', color: '#475569', fontWeight: '600' }}>Subcuenta a Cobrar:</span>
                <span style={{ fontSize: '28px', fontWeight: '900', color: '#16a34a' }}>
                  ${totalACobrarFinal.toLocaleString('es-CO')}
                </span>
              </div>

              {/* Selector de Método de Pago */}
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>
                Método de Pago:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '16px' }}>
                {['Efectivo', 'Transferencia', 'Nequi', 'Daviplata', 'Tarjeta'].map(m => {
                  const isSel = metodoPago === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMetodoPago(m)}
                      style={{
                        padding: '10px 6px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                        border: isSel ? '2px solid #16a34a' : '1px solid #cbd5e1',
                        background: isSel ? '#dcfce7' : '#ffffff',
                        color: isSel ? '#166534' : '#334155',
                        transition: 'all 0.15s'
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>

              {/* Botón de Confirmación */}
              <button
                type="button"
                onClick={procesarCobroParcial}
                disabled={totalACobrarFinal <= 0 || procesando}
                style={{
                  width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                  background: totalACobrarFinal > 0 ? '#16a34a' : '#cbd5e1',
                  color: '#ffffff', fontWeight: '900', fontSize: '16px',
                  cursor: totalACobrarFinal > 0 && !procesando ? 'pointer' : 'not-allowed',
                  boxShadow: totalACobrarFinal > 0 ? '0 4px 12px rgba(22, 163, 74, 0.3)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                {procesando ? 'Procesando pago...' : `Cobrar $${totalACobrarFinal.toLocaleString('es-CO')} (${metodoPago})`}
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
