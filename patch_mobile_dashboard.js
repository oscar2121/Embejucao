const fs = require('fs');

let content = fs.readFileSync('App.js', 'utf8');

const regex = /\{\/\* Botones de Rango de Fecha \*\/\}\s*<View style=\{\{ flexDirection: 'row', gap: 8, backgroundColor: C\.surf, padding: 4, borderRadius: 8, marginBottom: 16 \}\}\>\s*\{\['hoy', 'semana', 'mes'\]\.map\(rango => \(\s*<TouchableOpacity[\s\S]*?<\/TouchableOpacity>\s*\)\)\}\s*<\/View>/;

const replacement = `{/* TARJETA DE CONTROL DE CAJA (TURNO ACTUAL O HISTÓRICO) */}
              <View style={{ backgroundColor: '#2C201A', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#4A372D' }}>
                <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#4A372D', paddingBottom: 12, marginBottom: 12, alignItems: 'center' }}>
                  <Text style={{ flex: 1, color: '#A08D84', fontSize: 13, fontWeight: 'bold' }}>ESTADO DE CAJA</Text>
                  {dashboardData?.sesion?.abierta ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#15803D' }} />
                      <Text style={{ color: '#15803D', fontWeight: 'bold', fontSize: 14 }}>ABIERTA</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626' }} />
                      <Text style={{ color: '#DC2626', fontWeight: 'bold', fontSize: 14 }}>CERRADA</Text>
                    </View>
                  )}
                </View>
                
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  <View style={{ width: '48%' }}>
                    <Text style={{ color: '#A08D84', fontSize: 11 }}>Apertura</Text>
                    <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>
                      {dashboardData?.sesion?.apertura ? new Date(dashboardData.sesion.apertura).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--'}
                    </Text>
                  </View>
                  <View style={{ width: '48%' }}>
                    <Text style={{ color: '#A08D84', fontSize: 11 }}>Cierre</Text>
                    <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>
                      {dashboardData?.sesion?.cierre ? new Date(dashboardData.sesion.cierre).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'En curso'}
                    </Text>
                  </View>
                  <View style={{ width: '48%', marginTop: 8 }}>
                    <Text style={{ color: '#A08D84', fontSize: 11 }}>Base Inicial</Text>
                    <Text style={{ color: '#E07A5F', fontSize: 14, fontWeight: 'bold' }}>
                      {dashboardData?.sesion?.base ? \`$\${Number(dashboardData.sesion.base).toLocaleString()}\` : '$0'}
                    </Text>
                  </View>
                  <View style={{ width: '48%', marginTop: 8 }}>
                    <Text style={{ color: '#A08D84', fontSize: 11 }}>Total Turno</Text>
                    <Text style={{ color: '#E07A5F', fontSize: 14, fontWeight: 'bold' }}>
                      {dashboardData?.sesion?.recaudado ? \`$\${Number(dashboardData.sesion.recaudado).toLocaleString()}\` : '$0'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* FILTROS DE FECHA Y RANGO (SCROLL HORIZONTAL + BOTÓN FECHA ESPECÍFICA) */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                  {['hoy', 'ayer', 'semana', 'mes'].map(rango => {
                    const isSelected = dashboardRango === rango;
                    return (
                      <TouchableOpacity
                        key={rango}
                        onPress={() => setDashboardRango(rango)}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 16,
                          borderRadius: 20,
                          backgroundColor: isSelected ? '#E07A5F' : '#3A2A22',
                          marginRight: 10
                        }}
                      >
                        <Text style={{ color: isSelected ? 'white' : '#A08D84', fontWeight: 'bold', textTransform: 'capitalize' }}>
                          {rango}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                
                <TouchableOpacity
                  onPress={() => setModalFechaVisible(true)}
                  style={{
                    padding: 10,
                    backgroundColor: (dashboardRango !== 'hoy' && dashboardRango !== 'ayer' && dashboardRango !== 'semana' && dashboardRango !== 'mes') ? '#E07A5F' : '#3A2A22',
                    borderRadius: 12,
                    marginLeft: 10
                  }}
                >
                  <Text style={{ fontSize: 18 }}>📅</Text>
                </TouchableOpacity>
              </View>`;

content = content.replace(regex, replacement);

fs.writeFileSync('App.js', content, 'utf8');
console.log('Patched App.js');
