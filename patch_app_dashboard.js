const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'App.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix additional mojibake
content = content.replace(/ðŸ’¸ íšltimos Egresos/g, '💸 Últimos Egresos');
content = content.replace(/ðŸ’¸/g, '💸');
content = content.replace(/íšltimos/g, 'Últimos');
content = content.replace(/ðŸ ·ï¸ /g, '🏷️');
content = content.replace(/â€¢/g, '•');
content = content.replace(/ðŸ“…/g, '📅');
content = content.replace(/ðŸ“Š/g, '📊');

// 1. REWRITE KPIs and CHARTS in App.js Dashboard
const dashboardStart = "{/* Nuevos KPIs Estilo Fintech */}";
const dashboardEnd = "{/* Recent Expenses List */}";

const startIdx = content.indexOf(dashboardStart);
const endIdx = content.indexOf(dashboardEnd);

if (startIdx !== -1 && endIdx !== -1) {
  const newDashboard = `{/* Nuevos KPIs Estilo Fintech */}
                    {(() => {
                      const v = dashboardData.ventas || 0;
                      const g = dashboardData.gastos || 0;
                      const gananciaLiquida = v - g;
                      const deficit = g > v;
                      const margen = v > 0 ? ((gananciaLiquida / v) * 100).toFixed(1) : 0;
                      const ticketPromedio = dashboardData.ventasCount > 0 ? (v / dashboardData.ventasCount) : 0;

                      return (
                        <>
                          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                            <View style={[s.statCard, { flex: 1, minWidth: '45%', backgroundColor: deficit ? '#FEE2E2' : C.surface }]}>
                              <Text style={{ fontSize: 11, color: deficit ? '#DC2626' : C.text2, fontWeight: 'bold' }}>MARGEN UTILIDAD</Text>
                              <Text style={{ fontSize: 24, color: deficit ? '#DC2626' : C.brand, fontWeight: '800' }}>{deficit ? 'DÉFICIT' : margen + '%'}</Text>
                              <Text style={{ fontSize: 10, color: deficit ? '#DC2626' : C.text3 }}>% sobre los ingresos</Text>
                            </View>
                            <View style={[s.statCard, { flex: 1, minWidth: '45%' }]}>
                              <Text style={{ fontSize: 11, color: C.text2, fontWeight: 'bold' }}>GANANCIA LÍQUIDA</Text>
                              <Text style={{ fontSize: 24, color: gananciaLiquida >= 0 ? C.green : C.red, fontWeight: '800' }}>
                                \${gananciaLiquida.toLocaleString('es-CO')}
                              </Text>
                              <Text style={{ fontSize: 10, color: C.text3 }}>Ventas - Gastos</Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                            <View style={[s.statCard, { flex: 1 }]}>
                              <Text style={{ fontSize: 11, color: C.text2, fontWeight: 'bold' }}>TICKET PROMEDIO</Text>
                              <Text style={{ fontSize: 24, color: C.text, fontWeight: '800' }}>\${Math.round(ticketPromedio).toLocaleString('es-CO')}</Text>
                              <Text style={{ fontSize: 10, color: C.text3 }}>Gasto promedio por pedido</Text>
                            </View>
                          </View>

                          {/* Gráfico de Pastel - Distribución de Ingresos */}
                          <Text style={[s.sectionTitle, { fontSize: 14, marginTop: 24 }]}>📊 Distribución de Ingresos</Text>
                          <View style={[s.card, { padding: 16, backgroundColor: C.surface, alignItems: 'center' }]}>
                            {v === 0 && g === 0 ? (
                              <Text style={{ color: C.text3, paddingVertical: 40 }}>No hay datos para graficar</Text>
                            ) : (
                              <>
                                <PieChart
                                  data={
                                    deficit 
                                      ? [{ name: 'Déficit', population: 100, color: '#DC2626', legendFontColor: '#DC2626', legendFontSize: 12 }]
                                      : [
                                          { name: 'Gastos Op.', population: Math.round((g/v)*100), color: '#DC2626', legendFontColor: C.text2, legendFontSize: 12 },
                                          { name: 'Ganancia', population: Math.round(((v-g)/v)*100), color: '#16A34A', legendFontColor: C.text2, legendFontSize: 12 }
                                        ]
                                  }
                                  width={Dimensions.get("window").width - 50}
                                  height={140}
                                  chartConfig={{ color: (opacity = 1) => \`rgba(0, 0, 0, \${opacity})\` }}
                                  accessor={"population"}
                                  backgroundColor={"transparent"}
                                  paddingLeft={"0"}
                                  absolute
                                />
                                {deficit && (
                                  <View style={{ alignItems: 'center', marginTop: 10 }}>
                                    <Text style={{ fontSize: 16 }}>⚠️</Text>
                                    <Text style={{ color: '#DC2626', fontWeight: 'bold' }}>Déficit Operativo (\${Math.abs(gananciaLiquida).toLocaleString('es-CO')})</Text>
                                  </View>
                                )}
                              </>
                            )}
                          </View>

                          {/* Gráfico de Barras - Ingresos vs Gastos */}
                          <Text style={[s.sectionTitle, { fontSize: 14, marginTop: 24 }]}>📊 Ingresos vs Egresos</Text>
                          <View style={[s.card, { padding: 16, backgroundColor: C.surface, alignItems: 'center' }]}>
                            {(() => {
                               const fVentas = dashboardData.flujoVentas || [];
                               const fGastos = dashboardData.flujoGastos || [];
                               const labels = [...new Set([...fVentas.map(v => v.label), ...fGastos.map(g => g.label)])].sort();
                               
                               if(labels.length === 0) return <Text style={{ color: C.text3, paddingVertical: 40 }}>No hay datos</Text>;

                               const dataVentas = labels.map(l => {
                                 const item = fVentas.find(x => x.label === l);
                                 return item ? item.total : 0;
                               });
                               const dataGastos = labels.map(l => {
                                 const item = fGastos.find(x => x.label === l);
                                 return item ? item.total : 0;
                               });

                               return (
                                 <LineChart
                                   data={{
                                     labels: labels.map(l => l.substring(0, 5)), // show hour or short date
                                     datasets: [
                                       { data: dataVentas, color: (opacity = 1) => \`rgba(22, 163, 74, \${opacity})\`, strokeWidth: 3 },
                                       { data: dataGastos, color: (opacity = 1) => \`rgba(220, 38, 38, \${opacity})\`, strokeWidth: 3 }
                                     ],
                                     legend: ["Ingresos (Verde)", "Egresos (Rojo)"]
                                   }}
                                   width={Dimensions.get("window").width - 50}
                                   height={220}
                                   chartConfig={{
                                     backgroundColor: C.surface,
                                     backgroundGradientFrom: C.surface,
                                     backgroundGradientTo: C.surface,
                                     decimalPlaces: 0,
                                     color: (opacity = 1) => \`rgba(0, 0, 0, \${opacity})\`,
                                     labelColor: (opacity = 1) => C.text3,
                                     style: { borderRadius: 16 },
                                     propsForDots: { r: "4", strokeWidth: "2" }
                                   }}
                                   bezier
                                   style={{ marginVertical: 8, borderRadius: 16 }}
                                 />
                               );
                            })()}
                          </View>
                        </>
                      );
                    })()}
                  </View>
                );
              })()}
              `;
  
  content = content.slice(0, startIdx) + newDashboard + content.slice(endIdx);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('App.js dashboard patched successfully');
} else {
  console.log('Could not find dashboard section in App.js');
}
