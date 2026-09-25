const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'desktop-app/src/AdminModule.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add BarChart to imports
if (!content.includes('BarChart')) {
  content = content.replace('AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from \'recharts\';', 'AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from \'recharts\';');
}

// 2. Replace KPIs
const oldKPIs = `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
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

const newKPIs = `
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {(() => {
                const ventasTotales = dashboardData.ventas || 0;
                const gastosTotales = dashboardData.gastos || 0;
                const gananciaLiquida = ventasTotales - gastosTotales;
                const deficit = gastosTotales > ventasTotales;
                const margen = ventasTotales > 0 ? ((gananciaLiquida / ventasTotales) * 100).toFixed(1) : 0;
                const ticketPromedio = dashboardData.ventasCount > 0 ? (ventasTotales / dashboardData.ventasCount) : 0;

                return (
                  <>
                    <div style={{...kpiCardStyle, backgroundColor: deficit ? '#FEE2E2' : 'var(--surf)'}}>
                      <span style={{ fontSize: '13px', color: deficit ? '#DC2626' : 'var(--text2)', fontWeight: 'bold', textTransform: 'uppercase' }}>Margen de Utilidad</span>
                      <span style={{ fontSize: '32px', color: deficit ? '#DC2626' : 'var(--brand)', fontWeight: '800' }}>{deficit ? 'DÉFICIT' : margen + '%'}</span>
                    </div>
                    <div style={kpiCardStyle}>
                      <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: 'bold', textTransform: 'uppercase' }}>Ganancia Líquida</span>
                      <span style={{ fontSize: '32px', color: gananciaLiquida >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: '800' }}>{formatCurrency(gananciaLiquida)}</span>
                    </div>
                    <div style={kpiCardStyle}>
                      <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: 'bold', textTransform: 'uppercase' }}>Ticket Promedio</span>
                      <span style={{ fontSize: '32px', color: 'var(--text)', fontWeight: '800' }}>{formatCurrency(ticketPromedio)}</span>
                    </div>
                    <div style={{...kpiCardStyle, backgroundColor: 'var(--orange)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer'}} onClick={() => setModalGastoVisible(true)}>
                      <span style={{ fontSize: '18px', fontWeight: 'bold' }}>+ Registrar Gasto</span>
                    </div>
                  </>
                );
              })()}
            </div>
`;

content = content.replace(oldKPIs, newKPIs);

// 3. Replace Charts
const oldChartsRegex = /<div style=\{\{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' \}\}>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/;

const newCharts = `<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Gráfica de Pastel (Ganancia vs Gastos) */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '16px', color: 'var(--brand)', marginBottom: '16px', fontWeight: 'bold' }}>Distribución de Ingresos</h3>
                <div style={{ height: '250px', width: '100%', flex: 1, position: 'relative' }}>
                  {(() => {
                    const v = dashboardData.ventas || 0;
                    const g = dashboardData.gastos || 0;
                    const deficit = g > v;
                    
                    let pieData = [];
                    if (v === 0 && g === 0) {
                      return <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>No hay datos</div>;
                    }
                    
                    if (deficit) {
                      pieData = [{ name: 'Déficit / Sin Ganancia', value: 100, color: '#DC2626' }];
                    } else {
                      pieData = [
                        { name: 'Gastos Operativos', value: (g / v) * 100, color: '#DC2626', realValue: g },
                        { name: 'Ganancia Real', value: ((v - g) / v) * 100, color: '#16A34A', realValue: (v - g) }
                      ];
                    }

                    return (
                      <>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none"
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={\`cell-\${index}\`} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip formatter={(value, name, props) => {
                               if(deficit) return ['Déficit', name];
                               return [\`\${value.toFixed(1)}% (\${formatCurrency(props.payload.realValue)})\`, name];
                            }} />
                          </PieChart>
                        </ResponsiveContainer>
                        {deficit && (
                           <div style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'}}>
                             <span style={{fontSize: '24px'}}>⚠️</span>
                             <span style={{color: '#DC2626', fontWeight: 'bold', fontSize: '12px', marginTop: '4px'}}>Déficit Operativo</span>
                             <span style={{color: '#DC2626', fontWeight: 'bold', fontSize: '11px'}}>{formatCurrency(v - g)}</span>
                           </div>
                        )}
                        {!deficit && (
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#16A34A', borderRadius: '6px' }}/> <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Ganancia Real</span></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#DC2626', borderRadius: '6px' }}/> <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Gastos Operativos</span></div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Gráfica de Barras Comparativas */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '16px', color: 'var(--brand)', marginBottom: '16px', fontWeight: 'bold' }}>Comparativa Ingresos vs Egresos</h3>
                <div style={{ height: '250px', width: '100%' }}>
                  {(() => {
                    const fVentas = dashboardData.flujoVentas || [];
                    const fGastos = dashboardData.flujoGastos || [];
                    
                    // Merge data by label
                    const labels = [...new Set([...fVentas.map(v => v.label), ...fGastos.map(g => g.label)])].sort();
                    const chartData = labels.map(label => {
                      const v = fVentas.find(x => x.label === label);
                      const g = fGastos.find(x => x.label === label);
                      return {
                        label,
                        ingresos: v ? v.total : 0,
                        gastos: g ? g.total : 0
                      };
                    });

                    if (chartData.length === 0) {
                      return <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>No hay datos</div>;
                    }

                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text2)' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text2)' }} tickFormatter={(val) => '$' + (val/1000) + 'k'} />
                          <RechartsTooltip formatter={(value) => formatCurrency(value)} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                          <Legend verticalAlign="top" height={36} iconType="circle" />
                          <Bar dataKey="ingresos" name="Ingresos" fill="#16A34A" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="gastos" name="Gastos" fill="#DC2626" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* GESTIÓN DE USUARIOS */}
`;

// Replace everything from <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
// down to just before {/* GESTIÓN DE USUARIOS */}

const chartsRegex = /<div style=\{\{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' \}\}>([\s\S]*?){\/\* GESTIÓN DE USUARIOS \*\/}/;
content = content.replace(chartsRegex, newCharts);

fs.writeFileSync(filePath, content, 'utf8');
console.log('AdminModule.jsx charts restored');
