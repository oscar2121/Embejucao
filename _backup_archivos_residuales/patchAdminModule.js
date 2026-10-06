const fs = require('fs');

const appFile = 'desktop-app/src/AdminModule.jsx';
let content = fs.readFileSync(appFile, 'utf8');

// 1. Fix Imports
content = content.replace(
  "import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';",
  "import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';"
);

// 2. Move "Pedidos Activos" to Sidebar
const oldSidebarBtn = `<button onClick={() => setAdminTab('dashboard')} style={navBtnStyle(adminTab === 'dashboard')}>📊 Dashboard de Hoy</button>`;
const newSidebarBtn = `<button onClick={() => setAdminTab('dashboard')} style={navBtnStyle(adminTab === 'dashboard')}>📊 Dashboard de Hoy</button>
          
          <div onClick={() => setModalPedidosActivosVisible(true)} style={{ marginTop: '8px', marginBottom: '8px', backgroundColor: 'var(--orange)', padding: '12px', borderRadius: '8px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }} className="hover-lift">
            <span style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>Pedidos Activos</span>
            <span style={{ fontSize: '20px', fontWeight: '900', backgroundColor: 'rgba(255,255,255,0.2)', padding: '2px 10px', borderRadius: '12px' }}>{pedidos.filter(p => p.estado === 'activo').length}</span>
          </div>`;
content = content.replace(oldSidebarBtn, newSidebarBtn);

// 3. Update Dashboard Rango Buttons + KPI Layout
const oldKpiSection = `<div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--surf)', padding: '4px', borderRadius: '8px' }}>
                {['hoy', 'semana', 'mes'].map(rango => (
                  <button 
                    key={rango}
                    onClick={() => setDashboardRango(rango)}
                    style={{ 
                      padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer',
                      backgroundColor: dashboardRango === rango ? 'var(--brand)' : 'transparent',
                      color: dashboardRango === rango ? 'white' : 'var(--text2)', transition: '0.2s'
                    }}
                  >
                    {rango.charAt(0).toUpperCase() + rango.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div style={{...kpiCardStyle, cursor: 'pointer', backgroundColor: 'var(--surf)'}} onClick={() => setModalPedidosActivosVisible(true)} className="hover-lift">
                <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: 'bold', textTransform: 'uppercase' }}>Pedidos Activos</span>
                <span style={{ fontSize: '32px', color: 'var(--orange)', fontWeight: '800' }}>{pedidos.filter(p => p.estado === 'activo').length}</span>
              </div>
              <div style={kpiCardStyle}>
                <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: 'bold', textTransform: 'uppercase' }}>Ingresos (Ventas)</span>
                <span style={{ fontSize: '32px', color: 'var(--green)', fontWeight: '800' }}>{formatCurrency(dashboardData.ventas)}</span>
              </div>
              <div style={kpiCardStyle}>
                <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: 'bold', textTransform: 'uppercase' }}>Egresos (Gastos)</span>
                <span style={{ fontSize: '32px', color: 'var(--red)', fontWeight: '800' }}>{formatCurrency(dashboardData.gastos)}</span>
              </div>
              <div style={kpiCardStyle}>
                <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: 'bold', textTransform: 'uppercase' }}>Utilidad Neta</span>
                <span style={{ fontSize: '32px', color: dashboardData.balance >= 0 ? 'var(--brand)' : 'var(--red)', fontWeight: '800' }}>{formatCurrency(dashboardData.balance)}</span>
              </div>
              <div style={{...kpiCardStyle, backgroundColor: 'var(--orange)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer'}} onClick={() => setModalGastoVisible(true)}>
                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>+ Registrar Gasto</span>
              </div>
            </div>`;

const newKpiSection = `<div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--surf)', padding: '4px', borderRadius: '8px', alignItems: 'center' }}>
                {['hoy', 'semana', 'mes'].map(rango => (
                  <button 
                    key={rango}
                    onClick={() => setDashboardRango(rango)}
                    style={{ 
                      padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer',
                      backgroundColor: dashboardRango === rango ? 'var(--brand)' : 'transparent',
                      color: dashboardRango === rango ? 'white' : 'var(--text2)', transition: '0.2s'
                    }}
                  >
                    {rango.charAt(0).toUpperCase() + rango.slice(1)}
                  </button>
                ))}
                <input 
                  type="date" 
                  value={['hoy', 'semana', 'mes'].includes(dashboardRango) ? '' : dashboardRango}
                  onChange={(e) => {
                    if (e.target.value) setDashboardRango(e.target.value);
                  }}
                  style={{
                    padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: 'bold', cursor: 'pointer',
                    backgroundColor: !['hoy', 'semana', 'mes'].includes(dashboardRango) ? 'var(--brand)' : 'white',
                    color: !['hoy', 'semana', 'mes'].includes(dashboardRango) ? 'white' : 'var(--text)', transition: '0.2s', outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <div style={kpiCardStyle}>
                <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: 'bold', textTransform: 'uppercase' }}>Ingresos (Ventas)</span>
                <span style={{ fontSize: '32px', color: 'var(--green)', fontWeight: '800' }}>{formatCurrency(Number(dashboardData.ventas) || 0)}</span>
              </div>
              <div style={kpiCardStyle}>
                <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: 'bold', textTransform: 'uppercase' }}>Egresos (Gastos)</span>
                <span style={{ fontSize: '32px', color: 'var(--red)', fontWeight: '800' }}>{formatCurrency(Number(dashboardData.gastos) || 0)}</span>
              </div>
              <div style={kpiCardStyle}>
                <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: 'bold', textTransform: 'uppercase' }}>Utilidad Neta</span>
                <span style={{ fontSize: '32px', color: (Number(dashboardData.balance) || 0) >= 0 ? 'var(--brand)' : 'var(--red)', fontWeight: '800' }}>{formatCurrency(Number(dashboardData.balance) || 0)}</span>
              </div>
              <div style={{...kpiCardStyle, backgroundColor: 'var(--orange)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer'}} onClick={() => setModalGastoVisible(true)} className="hover-lift">
                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>+ Registrar Gasto</span>
              </div>
            </div>`;
content = content.replace(oldKpiSection, newKpiSection);

// 4. Update AreaChart for sales flow, add BarChart for Income vs Expenses
const oldAreaChart = `{/* Flujo de ventas (Mantenemos el de hoy por compatibilidad o se puede usar el historial) */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '16px', color: 'var(--brand)', marginBottom: '16px', fontWeight: 'bold' }}>Flujo de Ventas (Hoy)</h3>
                <div style={{ height: '250px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={ventasPorHora} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--orange)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--orange)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="hora" tick={{ fontSize: 12, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(val) => \`$\${val/1000}k\`} tick={{ fontSize: 12, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                      <RechartsTooltip formatter={(value) => formatCurrency(value)} labelStyle={{ color: 'var(--brand)', fontWeight: 'bold' }} />
                      <Area type="monotone" dataKey="ventas" stroke="var(--orange)" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>`;

const newCharts = `{/* Gráfico Comparativo Ingresos vs Egresos */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '16px', color: 'var(--brand)', marginBottom: '16px', fontWeight: 'bold' }}>Ingresos vs Egresos</h3>
                <div style={{ height: '250px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[{name: 'Balance', Ingresos: Number(dashboardData.ventas) || 0, Egresos: Number(dashboardData.gastos) || 0}]} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(val) => formatCurrency(val)} tick={{ fontSize: 12, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                      <RechartsTooltip formatter={(value) => formatCurrency(value)} labelStyle={{ color: 'var(--brand)', fontWeight: 'bold' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      <Bar dataKey="Ingresos" fill="var(--green)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Egresos" fill="var(--red)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Flujo de ventas dinámico */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: '16px', color: 'var(--brand)', marginBottom: '16px', fontWeight: 'bold' }}>Flujo de Ventas ({dashboardRango.charAt(0).toUpperCase() + dashboardRango.slice(1)})</h3>
              <div style={{ height: '300px', width: '100%' }}>
                {dashboardData.flujoVentas && dashboardData.flujoVentas.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboardData.flujoVentas} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorVentasReal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--green)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--green)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(val) => formatCurrency(val)} tick={{ fontSize: 12, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                      <RechartsTooltip formatter={(value) => formatCurrency(value)} labelStyle={{ color: 'var(--brand)', fontWeight: 'bold' }} />
                      <Area type="monotone" dataKey="total" stroke="var(--green)" strokeWidth={3} fillOpacity={1} fill="url(#colorVentasReal)" name="Ventas" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>No hay ventas en este periodo</div>
                )}
              </div>
            </div>`;
content = content.replace(oldAreaChart, newCharts + '\n            <div style={{ display: "none" }}>');
content = content.replace(/<\/div>\s*\{\/\* Últimos Egresos/, '            {/* Últimos Egresos'); // Fix the closing div

// 5. Append Cash Sessions History after Egresos
const egresosEnd = `                  {(!dashboardData.ultimosGastos || dashboardData.ultimosGastos.length === 0) && (
                    <tr>
                      <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)' }}>No hay gastos en este periodo</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>`;

const cashHistory = `            {/* Historial de Caja */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '16px', color: 'var(--brand)', margin: 0, fontWeight: 'bold' }}>🧾 Historial de Movimientos de Caja</h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: 'var(--surf2)' }}>
                  <tr>
                    <th style={thStyle}>Sesión</th>
                    <th style={thStyle}>Estado</th>
                    <th style={{...thStyle, textAlign: 'right'}}>Base Inicial</th>
                    <th style={{...thStyle, textAlign: 'right'}}>Total Ventas</th>
                    <th style={{...thStyle, textAlign: 'right'}}>Saldo Reportado</th>
                    <th style={{...thStyle, textAlign: 'right'}}>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboardData.cajaSesiones || []).map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover-lift-row">
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 'bold' }}>#{s.id}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text3)' }}>Apertura: {s.fecha_apertura}</div>
                        {s.fecha_cierre && <div style={{ fontSize: '11px', color: 'var(--text3)' }}>Cierre: {s.fecha_cierre}</div>}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: s.fecha_cierre ? 'var(--surf3)' : 'rgba(45,106,63,0.1)', color: s.fecha_cierre ? 'var(--text3)' : 'var(--green)', fontSize: '12px', fontWeight: 'bold' }}>
                          {s.fecha_cierre ? 'CERRADA' : 'ACTIVA'}
                        </span>
                      </td>
                      <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold'}}>{formatCurrency(Number(s.base_inicial) || 0)}</td>
                      <td style={{...tdStyle, textAlign: 'right', color: 'var(--green)', fontWeight: 'bold'}}>{s.fecha_cierre ? formatCurrency(Number(s.total_ventas_sistema) || 0) : '-'}</td>
                      <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold'}}>{s.fecha_cierre ? formatCurrency(Number(s.saldo_final_real) || 0) : '-'}</td>
                      <td style={{...tdStyle, textAlign: 'right', color: Number(s.diferencia) < 0 ? 'var(--red)' : 'var(--green)', fontWeight: 'bold'}}>
                        {s.fecha_cierre ? formatCurrency(Number(s.diferencia) || 0) : '-'}
                      </td>
                    </tr>
                  ))}
                  {(!dashboardData.cajaSesiones || dashboardData.cajaSesiones.length === 0) && (
                    <tr>
                      <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)' }}>No hay registros de caja para este periodo</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>`;

content = content.replace(egresosEnd, egresosEnd + '\n\n' + cashHistory);

fs.writeFileSync(appFile, content, 'utf8');
console.log('AdminModule.jsx patched successfully');
