import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function DashboardFinanciero({ serverUrl, socket, adminToken }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardRango, setDashboardRango] = useState('hoy');
  const [dashboardFechaPersonalizada, setDashboardFechaPersonalizada] = useState('');
  const [modalGastoOpen, setModalGastoOpen] = useState(false);
  const [gastoForm, setGastoForm] = useState({ descripcion: '', categoria: 'Insumos', valor: '' });

  const cargarDashboard = async () => {
    try {
      const targetUrl = serverUrl || 'http://localhost:3001';
      const fechaParam = dashboardFechaPersonalizada || dashboardRango;
      
      const token = adminToken || localStorage.getItem('token') || localStorage.getItem('adminToken');
      const headers = {
        'ngrok-skip-browser-warning': 'true'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await axios.get(`${targetUrl}/api/dashboard/financiero`, {
        params: { rango: fechaParam },
        headers
      });

      if (res.data) {
        setDashboardData(res.data);
      }
    } catch (e) {
      console.error('Error fetching dashboard financiero:', e.message);
    }
  };

  useEffect(() => {
    cargarDashboard();
  }, [dashboardRango, dashboardFechaPersonalizada, serverUrl, adminToken]);

  // Sincronización en tiempo real por sockets
  useEffect(() => {
    if (!socket) return;
    const onCajaActualizada = () => {
      cargarDashboard();
    };
    socket.on('caja:estado', onCajaActualizada);
    socket.on('caja_actualizada', onCajaActualizada);
    socket.on('dashboard:actualizado', onCajaActualizada);

    return () => {
      socket.off('caja:estado', onCajaActualizada);
      socket.off('caja_actualizada', onCajaActualizada);
      socket.off('dashboard:actualizado', onCajaActualizada);
    };
  }, [socket]);

  const sesion = dashboardData?.sesion || null;
  const estaAbierta = Boolean(dashboardData?.cajaAbierta || sesion);
  const baseInicial = Number(sesion?.base_inicial || 0);

  const totalVentas = Number(dashboardData?.ventas || 0);
  const totalGastos = Number(dashboardData?.gastos || 0);
  const ventasEfectivo = Number(
    dashboardData?.efectivo ?? dashboardData?.total_efectivo ?? 0
  );
  const ventasTransferencia = Number(
    dashboardData?.transferencia ?? dashboardData?.total_transferencia ?? 0
  );
  const gananciaLiquida = totalVentas - totalGastos;
  const margen = totalVentas > 0 ? `${Math.round((gananciaLiquida / totalVentas) * 100)}%` : 'DÉFICIT';

  const maxMonto = Math.max(totalVentas, totalGastos, 1);
  const pctVentas = Math.min(100, Math.round((totalVentas / maxMonto) * 100));
  const pctGastos = Math.min(100, Math.round((totalGastos / maxMonto) * 100));

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ margin: 0, color: 'var(--brand, #144c3c)', fontSize: '26px' }}>Dashboard Financiero</h2>
          <button
            onClick={cargarDashboard}
            style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer' }}
            title="Actualizar datos"
          >
            🔄
          </button>
          <button
            onClick={() => setModalGastoOpen(true)}
            style={{
              backgroundColor: '#e07a5f',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '7px 14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ➕ Registrar Gasto
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '8px', padding: '2px' }}>
            {['hoy', 'semana', 'mes'].map((r) => (
              <button
                key={r}
                onClick={() => { setDashboardFechaPersonalizada(''); setDashboardRango(r); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  backgroundColor: (!dashboardFechaPersonalizada && dashboardRango === r) ? '#144c3c' : 'transparent',
                  color: (!dashboardFechaPersonalizada && dashboardRango === r) ? '#fff' : '#4a5568',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  textTransform: 'capitalize'
                }}
              >
                {r}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={dashboardFechaPersonalizada}
            onChange={(e) => {
              setDashboardFechaPersonalizada(e.target.value);
              if (e.target.value) setDashboardRango(e.target.value);
            }}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Arqueo de Caja */}
      <div style={{ backgroundColor: 'var(--card-bg, #fff)', padding: '18px', borderRadius: '14px', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        <div>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>ESTADO DE CAJA</span>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: estaAbierta ? '#16A34A' : '#DC2626' }}>
            {estaAbierta ? 'ABIERTA' : 'SIN SESIÓN ACTIVA'}
          </div>
        </div>
        <div>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>BASE INICIAL</span>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>${baseInicial.toLocaleString()}</div>
        </div>
        <div>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>VENTAS EFECTIVO</span>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#16A34A' }}>
            ${ventasEfectivo.toLocaleString('es-CO')}
          </div>
        </div>
        <div>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>VENTAS TRANSFERENCIA</span>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563EB' }}>
            ${ventasTransferencia.toLocaleString('es-CO')}
          </div>
        </div>
        <div>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>GASTOS REGISTRADOS</span>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#DC2626' }}>-${totalGastos.toLocaleString()}</div>
        </div>
      </div>

      {/* Métricas Principales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ backgroundColor: gananciaLiquida < 0 ? '#FEE2E2' : '#DCFCE7', padding: '20px', borderRadius: '16px' }}>
          <div style={{ color: gananciaLiquida < 0 ? '#DC2626' : '#16A34A', fontSize: '12px', fontWeight: 'bold' }}>MARGEN DE UTILIDAD</div>
          <div style={{ fontSize: '26px', fontWeight: 'bold', color: gananciaLiquida < 0 ? '#DC2626' : '#16A34A' }}>{margen}</div>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)' }}>
          <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 'bold' }}>GANANCIA LÍQUIDA</div>
          <div style={{ fontSize: '26px', fontWeight: 'bold', color: gananciaLiquida >= 0 ? '#16A34A' : '#DC2626' }}>
            ${gananciaLiquida.toLocaleString()}
          </div>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)' }}>
          <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 'bold' }}>TOTAL VENTAS</div>
          <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#1e293b' }}>${totalVentas.toLocaleString()}</div>
        </div>
      </div>

      {/* Gráficas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Gráfica 1: Distribución de Ingresos */}
        <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#144c3c', width: '100%', textAlign: 'left' }}>Distribución de Ingresos</h3>
          
          <div style={{ position: 'relative', width: '160px', height: '160px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: totalGastos > 0 && totalVentas === 0 
                ? '#DC2626' 
                : totalVentas > 0 
                  ? `conic-gradient(#16A34A 0% ${Math.round((ventasEfectivo / (totalVentas || 1)) * 100)}%, #2563EB ${Math.round((ventasEfectivo / (totalVentas || 1)) * 100)}% 100%)`
                  : '#e2e8f0',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <div style={{ width: '100px', height: '100px', backgroundColor: '#fff', borderRadius: '50%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                {gananciaLiquida < 0 ? (
                  <>
                    <span style={{ fontSize: '18px' }}>⚠️</span>
                    <span style={{ fontSize: '10px', color: '#DC2626', fontWeight: 'bold', textAlign: 'center', marginTop: '4px' }}>Déficit</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '18px' }}>💰</span>
                    <span style={{ fontSize: '10px', color: '#16A34A', fontWeight: 'bold', textAlign: 'center', marginTop: '4px' }}>Superávit</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '20px', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', backgroundColor: '#16A34A', borderRadius: '50%', display: 'inline-block' }}></span>
              <span>Efectivo (${ventasEfectivo.toLocaleString()})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', backgroundColor: '#2563EB', borderRadius: '50%', display: 'inline-block' }}></span>
              <span>Transferencia (${ventasTransferencia.toLocaleString()})</span>
            </div>
          </div>
        </div>

        {/* Gráfica 2: Comparativa Ingresos vs Egresos */}
        <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#144c3c' }}>Comparativa Ingresos vs Egresos</h3>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: '#DC2626', borderRadius: '50%' }}></span> Gastos
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: '#16A34A', borderRadius: '50%' }}></span> Ingresos
              </span>
            </div>
          </div>

          <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '40px', paddingBottom: '10px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#64748b' }}>${totalGastos.toLocaleString()}</span>
              <div style={{ width: '48px', height: `${Math.max(pctGastos, 8)}px`, backgroundColor: '#DC2626', borderRadius: '6px 6px 0 0', transition: 'height 0.3s' }}></div>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Gastos</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#64748b' }}>${totalVentas.toLocaleString()}</span>
              <div style={{ width: '48px', height: `${Math.max(pctVentas, 8)}px`, backgroundColor: '#16A34A', borderRadius: '6px 6px 0 0', transition: 'height 0.3s' }}></div>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Ingresos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Registro de Gasto */}
      {modalGastoOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '16px', width: '380px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--brand, #144c3c)' }}>Registrar Gasto</h3>

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const targetUrl = serverUrl || 'http://localhost:3001';
                const token = adminToken || localStorage.getItem('token') || localStorage.getItem('adminToken');
                const valorSanitizado = parseInt(String(gastoForm.valor).replace(/\D/g, ''), 10) || 0;

                if (valorSanitizado <= 0) {
                  alert('Ingresa un valor válido');
                  return;
                }

                await axios.post(`${targetUrl}/api/gastos`, {
                  descripcion: gastoForm.descripcion,
                  categoria: gastoForm.categoria,
                  valor: valorSanitizado,
                  sesion_id: sesion?.id || null
                }, {
                  headers: {
                    'ngrok-skip-browser-warning': 'true',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                  }
                });

                setModalGastoOpen(false);
                setGastoForm({ descripcion: '', categoria: 'Insumos', valor: '' });
                cargarDashboard();
              } catch (err) {
                console.error('Error registrando gasto:', err);
                alert('Error al registrar el gasto');
              }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Descripción</label>
                <input
                  required
                  value={gastoForm.descripcion}
                  onChange={(e) => setGastoForm({ ...gastoForm, descripcion: e.target.value })}
                  placeholder="Ej. Compra de verduras / Pago servicios"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Categoría</label>
                <select
                  value={gastoForm.categoria}
                  onChange={(e) => setGastoForm({ ...gastoForm, categoria: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="Insumos">Insumos</option>
                  <option value="Servicios">Servicios</option>
                  <option value="Nómina">Nómina</option>
                  <option value="Mantenimiento">Mantenimiento</option>
                  <option value="Varios">Varios</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Valor ($)</label>
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  value={gastoForm.valor}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    const formatted = raw ? Number(raw).toLocaleString('es-CO') : '';
                    setGastoForm({ ...gastoForm, valor: formatted });
                  }}
                  placeholder="Ej. 50.000"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" onClick={() => setModalGastoOpen(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#e07a5f', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                  Guardar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}