const fs = require('fs');

const file = 'App.js';
let content = fs.readFileSync(file, 'utf8');

const targetStart = `              {(() => {
                const screenWidth = Dimensions.get("window").width - 28;
                const pieData = dashboardData.gastosPorCategoria && dashboardData.gastosPorCategoria.length > 0
                  ? dashboardData.gastosPorCategoria.map((c, i) => ({
                      name: c.categoria,
                      population: c.total,
                      color: ['#E8520A', '#2D6A3F', '#F4A261', '#2A9D8F', '#E9C46A'][i % 5],
                      legendFontColor: C.text2, legendFontSize: 12
                    }))
                  : [{ name: "Sin Gastos", population: 1, color: C.border, legendFontColor: C.text3, legendFontSize: 12 }];

                return (
                  <View style={{ gap: 16 }}>
                    {/* Nuevos KPIs Estilo Fintech */}
                    <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                      <View style={[s.statCard, { flex: 1, minWidth: '45%' }]}>
                        <Text style={{ fontSize: 11, color: C.text2, fontWeight: 'bold' }}>INGRESOS</Text>
                        <Text style={{ fontSize: 24, color: C.green, fontWeight: '800' }}>\${(dashboardData.ventas || 0).toLocaleString('es-CO')}</Text>
                        <Text style={{ fontSize: 10, color: C.text3 }}>Ventas totales</Text>
                      </View>
                      <View style={[s.statCard, { flex: 1, minWidth: '45%' }]}>
                        <Text style={{ fontSize: 11, color: C.text2, fontWeight: 'bold' }}>EGRESOS</Text>
                        <Text style={{ fontSize: 24, color: C.red, fontWeight: '800' }}>
                          \${(dashboardData.gastos || 0).toLocaleString('es-CO')}
                        </Text>
                        <Text style={{ fontSize: 10, color: C.text3 }}>Gastos registrados</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                      <View style={[s.statCard, { flex: 1 }]}>
                        <Text style={{ fontSize: 11, color: C.text2, fontWeight: 'bold' }}>UTILIDAD NETA</Text>
                        <Text style={{ fontSize: 24, color: dashboardData.balance >= 0 ? C.brand : C.red, fontWeight: '800' }}>\${(dashboardData.balance || 0).toLocaleString('es-CO')}</Text>
                        <Text style={{ fontSize: 10, color: C.text3 }}>Ingresos menos egresos</Text>
                      </View>
                    </View>

                    {/* Gráfico de Dona - Gastos por Categoría */}
                    <Text style={[s.sectionTitle, { fontSize: 14, marginTop: 4 }]}>📊 Distribución de Gastos</Text>
                    <View style={[s.card, { padding: 10, backgroundColor: C.surface, alignItems: 'center' }]}>
                      <PieChart
                        data={pieData}
                        width={screenWidth - 20}
                        height={160}
                        chartConfig={{ color: (opacity = 1) => \`rgba(0, 0, 0, \${opacity})\` }}
                        accessor={"population"}
                        backgroundColor={"transparent"}
                        paddingLeft={"15"}
                        center={[10, 0]}
                        absolute
                      />
                    </View>
                  </View>
                );
              })()}`;

const replacement = `              {(() => {
                const screenWidth = Dimensions.get("window").width - 28;
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
                  pieData = [{ name: "Sin Datos", population: 1, color: C.border, legendFontColor: C.text3, legendFontSize: 12 }];
                } else if (deficit) {
                  pieData = [{ name: \`Déficit (\${Math.abs(margen).toFixed(1)}%)\`, population: 100, color: C.red, legendFontColor: C.text, legendFontSize: 12 }];
                } else {
                  pieData = [
                    { name: "Ganancia Neta", population: b, color: C.green, legendFontColor: C.text, legendFontSize: 11 },
                    { name: "Gastos", population: g, color: C.red, legendFontColor: C.text, legendFontSize: 11 }
                  ];
                }

                // BarChart Data
                const labels = [];
                const ingresosData = [];
                const gastosData = [];

                if (dashboardData.flujoVentas && dashboardData.flujoVentas.length > 0) {
                  const labelSet = new Set();
                  dashboardData.flujoVentas.forEach(f => labelSet.add(f.label));
                  (dashboardData.flujoGastos || []).forEach(f => labelSet.add(f.label));
                  
                  Array.from(labelSet).sort().forEach(lbl => {
                    // Extract HH or DD for short labels
                    let shortLabel = lbl;
                    if (lbl.includes(':')) {
                      shortLabel = lbl.split(':')[0] + 'h';
                    } else if (lbl.includes('-')) {
                      shortLabel = lbl.split('-').pop(); // just the day
                    }
                    labels.push(shortLabel);
                    
                    const iv = dashboardData.flujoVentas.find(x => x.label === lbl);
                    const ig = (dashboardData.flujoGastos || []).find(x => x.label === lbl);
                    ingresosData.push(iv ? iv.total : 0);
                    gastosData.push(ig ? ig.total : 0);
                  });
                } else {
                  labels.push("Sin datos");
                  ingresosData.push(0);
                  gastosData.push(0);
                }

                // Subsampling labels if too many (to avoid crowding x-axis)
                let displayLabels = labels;
                if (labels.length > 7) {
                  displayLabels = labels.map((l, i) => (i % Math.ceil(labels.length / 7) === 0) ? l : '');
                }

                return (
                  <View style={{ gap: 16 }}>
                    {/* Nuevos KPIs Estilo Gerencial */}
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={[s.statCard, { flex: 1, padding: 10 }]}>
                        <Text style={{ fontSize: 10, color: C.text2, fontWeight: 'bold' }}>MARGEN UTILIDAD</Text>
                        <Text style={{ fontSize: 18, color: deficit ? C.red : C.green, fontWeight: '800' }}>{margen.toFixed(1)}%</Text>
                        <Text style={{ fontSize: 9, color: C.text3 }}>% de ganancia neta</Text>
                      </View>
                      <View style={[s.statCard, { flex: 1, padding: 10 }]}>
                        <Text style={{ fontSize: 10, color: C.text2, fontWeight: 'bold' }}>GANANCIA LÍQUIDA</Text>
                        <Text style={{ fontSize: 18, color: deficit ? C.red : C.brand, fontWeight: '800' }}>\${b.toLocaleString('es-CO')}</Text>
                        <Text style={{ fontSize: 9, color: C.text3 }}>Balance real</Text>
                      </View>
                      <View style={[s.statCard, { flex: 1, padding: 10 }]}>
                        <Text style={{ fontSize: 10, color: C.text2, fontWeight: 'bold' }}>TICKET PROMEDIO</Text>
                        <Text style={{ fontSize: 18, color: C.text, fontWeight: '800' }}>\${Math.round(ticketPromedio).toLocaleString('es-CO')}</Text>
                        <Text style={{ fontSize: 9, color: C.text3 }}>Por cobro</Text>
                      </View>
                    </View>

                    {/* Gráfico de Pastel - Distribución */}
                    <Text style={[s.sectionTitle, { fontSize: 14, marginTop: 4 }]}>📊 Distribución Ingresos vs Gastos</Text>
                    <View style={[s.card, { padding: 10, backgroundColor: C.surface, alignItems: 'center' }]}>
                      {deficit && (
                        <View style={{ position: 'absolute', top: '45%', alignSelf: 'center', zIndex: 10, backgroundColor: 'rgba(255,255,255,0.9)', padding: 6, borderRadius: 8 }}>
                          <Text style={{ color: C.red, fontWeight: 'bold', fontSize: 14 }}>⚠️ Déficit Operativo (-\${Math.abs(b).toLocaleString('es-CO')})</Text>
                        </View>
                      )}
                      <PieChart
                        data={pieData}
                        width={screenWidth - 20}
                        height={160}
                        chartConfig={{ color: (opacity = 1) => \`rgba(0, 0, 0, \${opacity})\` }}
                        accessor={"population"}
                        backgroundColor={"transparent"}
                        paddingLeft={"0"}
                        center={[0, 0]}
                        absolute
                      />
                    </View>

                    {/* Gráfico de Barras - Comparativa */}
                    <Text style={[s.sectionTitle, { fontSize: 14, marginTop: 4 }]}>📈 Comparativa: Ingresos vs Egresos</Text>
                    <View style={[s.card, { padding: 10, paddingRight: 0, backgroundColor: C.surface }]}>
                       <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={{ width: Math.max(screenWidth - 40, labels.length * 40) }}>
                            <BarChart
                              data={{
                                labels: displayLabels,
                                datasets: [
                                  { data: ingresosData, colors: [(opacity = 1) => C.green] },
                                  { data: gastosData, colors: [(opacity = 1) => C.red] }
                                ]
                              }}
                              width={Math.max(screenWidth - 40, labels.length * 40)}
                              height={220}
                              withCustomBarColorFromData={true}
                              flatColor={true}
                              chartConfig={{
                                backgroundColor: C.surface,
                                backgroundGradientFrom: C.surface,
                                backgroundGradientTo: C.surface,
                                decimalPlaces: 0,
                                color: (opacity = 1) => C.text,
                                labelColor: (opacity = 1) => C.text3,
                                style: { borderRadius: 16 },
                                barPercentage: 0.6,
                                propsForLabels: { fontSize: 9 }
                              }}
                              style={{ marginVertical: 8, borderRadius: 16 }}
                              showValuesOnTopOfBars={false}
                            />
                          </View>
                       </ScrollView>
                       <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 4 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                             <View style={{ width: 10, height: 10, backgroundColor: C.green, borderRadius: 2 }} />
                             <Text style={{ fontSize: 11, color: C.text2 }}>Ingresos</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                             <View style={{ width: 10, height: 10, backgroundColor: C.red, borderRadius: 2 }} />
                             <Text style={{ fontSize: 11, color: C.text2 }}>Egresos</Text>
                          </View>
                       </View>
                    </View>
                  </View>
                );
              })()}`;

if (content.includes(targetStart)) {
  content = content.replace(targetStart, replacement);
  fs.writeFileSync(file, content);
  console.log('App.js successfully updated.');
} else {
  console.log('Target not found in App.js');
}
