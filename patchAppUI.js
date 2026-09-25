const fs = require('fs');

const appFile = 'App.js';
let content = fs.readFileSync(appFile, 'utf8');

// Replace the date range buttons to add custom date and navigation
const oldRangeButtons = `{['hoy', 'semana', 'mes'].map(rango => (
                  <TouchableOpacity
                    key={rango}
                    onPress={() => setDashboardRango(rango)}
                    style={{
                      flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6,
                      backgroundColor: dashboardRango === rango ? C.brand : 'transparent',
                    }}
                  >
                    <Text style={{ fontWeight: 'bold', fontSize: 13, color: dashboardRango === rango ? 'white' : C.text2, textTransform: 'capitalize' }}>
                      {rango}
                    </Text>
                  </TouchableOpacity>
                ))}`;

const newRangeButtons = `{['hoy', 'semana', 'mes'].map(rango => (
                  <TouchableOpacity
                    key={rango}
                    onPress={() => setDashboardRango(rango)}
                    style={{
                      flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6,
                      backgroundColor: dashboardRango === rango ? C.brand : 'transparent',
                    }}
                  >
                    <Text style={{ fontWeight: 'bold', fontSize: 13, color: dashboardRango === rango ? 'white' : C.text2, textTransform: 'capitalize' }}>
                      {rango}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  onPress={() => {
                    if (!['hoy', 'semana', 'mes'].includes(dashboardRango)) {
                      setDashboardRango('hoy');
                    } else {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      setDashboardRango(d.toISOString().split('T')[0]);
                    }
                  }}
                  style={{
                    flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6,
                    backgroundColor: !['hoy', 'semana', 'mes'].includes(dashboardRango) ? C.brand : 'transparent',
                  }}
                >
                  <Text style={{ fontWeight: 'bold', fontSize: 13, color: !['hoy', 'semana', 'mes'].includes(dashboardRango) ? 'white' : C.text2 }}>
                    📅 Día
                  </Text>
                </TouchableOpacity>
              </View>

              {!['hoy', 'semana', 'mes'].includes(dashboardRango) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.surface, padding: 10, borderRadius: 8, marginBottom: 16 }}>
                  <TouchableOpacity onPress={() => {
                    const d = new Date(dashboardRango);
                    d.setDate(d.getDate() - 1);
                    setDashboardRango(d.toISOString().split('T')[0]);
                  }}>
                    <Ionicons name="chevron-back-circle" size={32} color={C.brand} />
                  </TouchableOpacity>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: C.text3, fontWeight: '700' }}>FECHA ESPECÍFICA</Text>
                    <Text style={{ fontSize: 16, color: C.text, fontWeight: '800' }}>{dashboardRango}</Text>
                  </View>
                  <TouchableOpacity onPress={() => {
                    const d = new Date(dashboardRango);
                    d.setDate(d.getDate() + 1);
                    setDashboardRango(d.toISOString().split('T')[0]);
                  }}>
                    <Ionicons name="chevron-forward-circle" size={32} color={C.brand} />
                  </TouchableOpacity>
                </View>
              )}`;

content = content.replace(oldRangeButtons, newRangeButtons + '\n              <View style={{ display: "none" }}>');
content = content.replace(/<\/View>\s*\{\(\(\) => \{/, '  {(() => {');

// Replace the charts and data rendering
const oldPieChart = `{/* Gráfico de Dona - Gastos por Categoría */}
                    <Text style={[s.sectionTitle, { fontSize: 14, marginTop: 4 }]}>📊 Distribución de Gastos</Text>
                    <View style={[s.card, { padding: 10, backgroundColor: C.surface, alignItems: 'center' }]}>
                      <PieChart`;

const newCharts = `{/* Gráfico Comparativo de Ingresos vs Egresos */}
                    <Text style={[s.sectionTitle, { fontSize: 14, marginTop: 4 }]}>⚖️ Ingresos vs Egresos</Text>
                    <View style={[s.card, { padding: 10, backgroundColor: C.surface, alignItems: 'center' }]}>
                      <BarChart
                        data={{
                          labels: ["Ingresos", "Egresos"],
                          datasets: [
                            {
                              data: [Number(dashboardData.ventas) || 0, Number(dashboardData.gastos) || 0],
                              colors: [
                                (opacity = 1) => C.green,
                                (opacity = 1) => C.red
                              ]
                            }
                          ]
                        }}
                        width={screenWidth - 20}
                        height={200}
                        fromZero
                        showValuesOnTopOfBars
                        withCustomBarColorFromData
                        chartConfig={{
                          backgroundColor: C.surface,
                          backgroundGradientFrom: C.surface,
                          backgroundGradientTo: C.surface,
                          decimalPlaces: 0,
                          color: (opacity = 1) => C.text,
                          labelColor: (opacity = 1) => C.text2,
                          barPercentage: 0.8,
                          propsForLabels: { fontSize: 12, fontWeight: 'bold' }
                        }}
                        style={{ borderRadius: 8 }}
                      />
                    </View>

                    {/* Gráfico de Flujo de Ventas */}
                    {(dashboardData.flujoVentas && dashboardData.flujoVentas.length > 0) && (
                      <>
                        <Text style={[s.sectionTitle, { fontSize: 14, marginTop: 4 }]}>📈 Flujo de Ventas</Text>
                        <View style={[s.card, { padding: 10, backgroundColor: C.surface, alignItems: 'center', overflow: 'hidden' }]}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <LineChart
                              data={{
                                labels: dashboardData.flujoVentas.map(f => f.label),
                                datasets: [{
                                  data: dashboardData.flujoVentas.map(f => Number(f.total) || 0)
                                }]
                              }}
                              width={Math.max(screenWidth - 20, dashboardData.flujoVentas.length * 60)}
                              height={200}
                              yAxisLabel="$"
                              chartConfig={{
                                backgroundColor: C.surface,
                                backgroundGradientFrom: C.surface,
                                backgroundGradientTo: C.surface,
                                decimalPlaces: 0,
                                color: (opacity = 1) => \`rgba(52, 168, 83, \${opacity})\`,
                                labelColor: (opacity = 1) => C.text3,
                                style: { borderRadius: 16 },
                                propsForDots: { r: "5", strokeWidth: "2", stroke: C.green }
                              }}
                              bezier
                              style={{ marginVertical: 8, borderRadius: 8 }}
                            />
                          </ScrollView>
                        </View>
                      </>
                    )}

                    {/* Gráfico de Dona - Gastos por Categoría */}
                    <Text style={[s.sectionTitle, { fontSize: 14, marginTop: 4 }]}>📊 Distribución de Gastos</Text>
                    <View style={[s.card, { padding: 10, backgroundColor: C.surface, alignItems: 'center' }]}>
                      <PieChart`;

content = content.replace(oldPieChart, newCharts);


const oldExpensesList = `              {/* Recent Expenses List */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 8 }}>
                <Text style={[s.sectionTitle, { fontSize: 14 }]}>💸 Últimos Egresos</Text>
              </View>
              <View style={[s.card, { padding: 14, backgroundColor: C.surface }]}>
                {(() => {
                  const filteredGastos = dashboardData.ultimosGastos || [];
                  if (filteredGastos.length === 0) {
                    return <Text style={{ fontSize: 12, color: C.text3, textAlign: 'center', paddingVertical: 10 }}>No hay gastos registrados en este periodo</Text>;
                  }
                  return filteredGastos.map((g, idx) => (
                    <View key={g.id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: idx < filteredGastos.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>{g.descripcion}</Text>
                        <Text style={{ fontSize: 10, color: C.text3 }}>🏷️ {g.categoria} • 📅 {g.fecha}</Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: C.red }}>
                        -\${(g.valor || 0).toLocaleString('es-CO')}
                      </Text>
                    </View>
                  ));
                })()}
              </View>`;

const newLists = `              {/* Recent Expenses List */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 8 }}>
                <Text style={[s.sectionTitle, { fontSize: 14 }]}>💸 Últimos Egresos</Text>
              </View>
              <View style={[s.card, { padding: 14, backgroundColor: C.surface }]}>
                {(() => {
                  const filteredGastos = dashboardData.ultimosGastos || [];
                  if (filteredGastos.length === 0) {
                    return <Text style={{ fontSize: 12, color: C.text3, textAlign: 'center', paddingVertical: 10 }}>No hay gastos registrados en este periodo</Text>;
                  }
                  return filteredGastos.map((g, idx) => (
                    <View key={g.id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: idx < filteredGastos.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>{g.descripcion || 'Sin desc'}</Text>
                        <Text style={{ fontSize: 10, color: C.text3 }}>🏷️ {g.categoria || ''} • 📅 {g.fecha || ''}</Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: C.red }}>
                        -\${(Number(g.valor) || 0).toLocaleString('es-CO')}
                      </Text>
                    </View>
                  ));
                })()}
              </View>
              
              {/* Cash Sessions History */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
                <Text style={[s.sectionTitle, { fontSize: 14 }]}>🧾 Historial de Caja</Text>
              </View>
              <View style={[s.card, { padding: 14, backgroundColor: C.surface }]}>
                {(() => {
                  const sesiones = dashboardData.cajaSesiones || [];
                  if (sesiones.length === 0) {
                    return <Text style={{ fontSize: 12, color: C.text3, textAlign: 'center', paddingVertical: 10 }}>No hay registros de caja para este rango</Text>;
                  }
                  return sesiones.map((s, idx) => (
                    <View key={s.id || idx} style={{ paddingVertical: 12, borderBottomWidth: idx < sesiones.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: C.text }}>Sesión #{s.id}</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: s.fecha_cierre ? C.text3 : C.brand }}>
                          {s.fecha_cierre ? 'CERRADA' : 'ACTIVA'}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: C.text2, marginBottom: 8 }}>
                        Apertura: {s.fecha_apertura} {s.fecha_cierre ? \`| Cierre: \${s.fecha_cierre}\` : ''}
                      </Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 11, color: C.text3 }}>Base Inicial:</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: C.text }}>\${(Number(s.base_inicial) || 0).toLocaleString('es-CO')}</Text>
                      </View>
                      {s.fecha_cierre && (
                        <>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                            <Text style={{ fontSize: 11, color: C.text3 }}>Total Ventas (Sistema):</Text>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: C.green }}>\${(Number(s.total_ventas_sistema) || 0).toLocaleString('es-CO')}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                            <Text style={{ fontSize: 11, color: C.text3 }}>Saldo Final Reportado:</Text>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: C.text }}>\${(Number(s.saldo_final_real) || 0).toLocaleString('es-CO')}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: C.border }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: C.text2 }}>Diferencia (Arqueo):</Text>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: Number(s.diferencia) < 0 ? C.red : C.green }}>
                              \${(Number(s.diferencia) || 0).toLocaleString('es-CO')}
                            </Text>
                          </View>
                        </>
                      )}
                    </View>
                  ));
                })()}
              </View>`;

content = content.replace(oldExpensesList, newLists);

// Fix potential encoding issues and save
fs.writeFileSync(appFile, content, 'utf8');
console.log('App.js patched successfully');
