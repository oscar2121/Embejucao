const fs = require('fs');

const file = 'desktop-app/src/AdminModule.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStart = `            {/* KPIs */}
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
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Desglose de Gastos */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '16px', color: 'var(--brand)', marginBottom: '16px', fontWeight: 'bold' }}>Distribución de Gastos</h3>
                <div style={{ height: '250px', width: '100%', flex: 1 }}>
                  {dashboardData.gastosPorCategoria && dashboardData.gastosPorCategoria.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={dashboardData.gastosPorCategoria.map((c, i) => ({ name: c.categoria, value: c.total, color: ['#E8520A', '#2D6A3F', '#F4A261', '#2A9D8F', '#E9C46A'][i%5] }))}
                          cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none"
                        >
                          {dashboardData.gastosPorCategoria.map((entry, index) => (
                            <Cell key={\`cell-\${index}\`} fill={['#E8520A', '#2D6A3F', '#F4A261', '#2A9D8F', '#E9C46A'][index%5]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>No hay gastos en este periodo</div>
                  )}
                </div>
              </div>

              {/* Flujo de ventas (Mantenemos el de hoy por compatibilidad o se puede usar el historial) */}
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

const replacement = `            {/* KPIs Gerenciales */}
            {(() => {
                const v = dashboardData.ventas || 0;
                const g = dashboardData.gastos || 0;
                const b = dashboardData.balance || 0;
                const tCount = dashboardData.ventasCount || 0;
                const margen = v > 0 ? (b / v) * 100 : 0;
                const ticketPromedio = tCount > 0 ? (v / tCount) : 0;
                const deficit = g > v;

                // PieChart Data
                let pieData = [];
                if (v === 0 && g === 0) {
                  pieData = [];
                } else if (deficit) {
                  pieData = [{ name: \`Déficit (\${Math.abs(margen).toFixed(1)}%)\`, value: 100, fill: 'var(--red)' }];
                } else {
                  pieData = [
                    { name: "Ganancia Neta", value: b, fill: 'var(--green)' },
                    { name: "Gastos", value: g, fill: 'var(--red)' }
                  ];
                }

                // BarChart Data
                const flowData = [];
                if ((dashboardData.flujoVentas && dashboardData.flujoVentas.length > 0) || (dashboardData.flujoGastos && dashboardData.flujoGastos.length > 0)) {
                  const labelSet = new Set();
                  (dashboardData.flujoVentas || []).forEach(f => labelSet.add(f.label));
                  (dashboardData.flujoGastos || []).forEach(f => labelSet.add(f.label));
                  
                  Array.from(labelSet).sort().forEach(lbl => {
                    let shortLabel = lbl.includes(':') ? lbl.split(':')[0] + 'h' : lbl.split('-').pop();
                    const iv = (dashboardData.flujoVentas || []).find(x => x.label === lbl);
                    const ig = (dashboardData.flujoGastos || []).find(x => x.label === lbl);
                    flowData.push({ label: shortLabel, ingresos: iv ? iv.total : 0, gastos: ig ? ig.total : 0 });
                  });
                }

                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                      <div style={kpiCardStyle}>
                        <span style={{ fontSize: '12px', color: 'var(--text2)', fontWeight: 'bold', textTransform: 'uppercase' }}>MARGEN DE UTILIDAD</span>
                        <span style={{ fontSize: '32px', color: deficit ? 'var(--red)' : 'var(--green)', fontWeight: '800' }}>{margen.toFixed(1)}%</span>
                        <span style={{ fontSize: '11px', color: 'var(--text3)' }}>% de ganancia neta</span>
                      </div>
                      <div style={kpiCardStyle}>
                        <span style={{ fontSize: '12px', color: 'var(--text2)', fontWeight: 'bold', textTransform: 'uppercase' }}>GANANCIA LÍQUIDA</span>
                        <span style={{ fontSize: '32px', color: deficit ? 'var(--red)' : 'var(--brand)', fontWeight: '800' }}>{formatCurrency(b)}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text3)' }}>Balance real</span>
                      </div>
                      <div style={kpiCardStyle}>
                        <span style={{ fontSize: '12px', color: 'var(--text2)', fontWeight: 'bold', textTransform: 'uppercase' }}>TICKET PROMEDIO</span>
                        <span style={{ fontSize: '32px', color: 'var(--text)', fontWeight: '800' }}>{formatCurrency(Math.round(ticketPromedio))}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text3)' }}>Por cobro</span>
                      </div>
                      <div style={{...kpiCardStyle, backgroundColor: 'var(--orange)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer'}} onClick={() => setModalGastoVisible(true)} className="hover-lift">
                        <span style={{ fontSize: '16px', fontWeight: 'bold' }}>+ Registrar Gasto</span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                      {/* Gráfico de Pastel - Distribución */}
                      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                        <h3 style={{ fontSize: '16px', color: 'var(--brand)', margin: 0, fontWeight: 'bold' }}>Distribución Ingresos vs Gastos</h3>
                        <div style={{ height: '250px', width: '100%', flex: 1, marginTop: '16px' }}>
                          {deficit && (
                            <div style={{ position: 'absolute', top: '55%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10, backgroundColor: 'rgba(255,255,255,0.9)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--red)' }}>
                              <strong style={{ color: 'var(--red)', fontSize: '14px' }}>⚠️ Déficit Operativo (-{formatCurrency(Math.abs(b))})</strong>
                            </div>
                          )}
                          {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none">
                                  {pieData.map((entry, index) => (
                                    <Cell key={\`cell-\${index}\`} fill={entry.fill} />
                                  ))}
                                </Pie>
                                <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                              </PieChart>
                            </ResponsiveContainer>
                          ) : (
                            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>No hay datos</div>
                          )}
                        </div>
                      </div>

                      {/* Gráfico de Barras - Comparativa */}
                      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                        <h3 style={{ fontSize: '16px', color: 'var(--brand)', margin: 0, fontWeight: 'bold' }}>Comparativa: Ingresos vs Egresos</h3>
                        <div style={{ height: '250px', width: '100%', marginTop: '16px' }}>
                          {flowData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={flowData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                                <YAxis tickFormatter={(val) => \`$\${val/1000}k\`} tick={{ fontSize: 12, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                                <RechartsTooltip formatter={(value) => formatCurrency(value)} labelStyle={{ color: 'var(--text)', fontWeight: 'bold' }} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                <Bar dataKey="ingresos" name="Ingresos" fill="var(--green)" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="gastos" name="Egresos" fill="var(--red)" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>No hay datos temporales</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );
            })()}`;

if (content.includes(targetStart)) {
  content = content.replace(targetStart, replacement);
  fs.writeFileSync(file, content);
  console.log('AdminModule.jsx successfully updated.');
} else {
  console.log('Target not found in AdminModule.jsx');
}
