const fs = require('fs');

let content = fs.readFileSync('App.js', 'utf8');

// 1. Replace the Date input
const dateInputRegex = /<View style=\{\{ flex: 1 \}\}>\s*<Text style=\{\{ fontSize: 11, color: C\.text2, marginBottom: 4 \}\}>Fecha \(AAAA-MM-DD\):<\/Text>\s*<TextInput\s*style=\{\[s\.formInput, \{ paddingVertical: 6 \}\]\}\s*placeholder="Ej\. 2026-06-08"\s*placeholderTextColor=\{C\.text3\}\s*value=\{auditFechaFilter\}\s*onChangeText=\{setAuditFechaFilter\}\s*\/>\s*<\/View>/;

const dateReplacement = `<View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Fecha (AAAA-MM-DD):</Text>
                  <TouchableOpacity 
                    onPress={() => setModalFechaVisible(true)}
                    style={{
                      backgroundColor: '#F3EDE2',
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: '#D4A373'
                    }}
                  >
                    <Text style={{ color: auditFechaFilter ? '#1F2937' : '#9CA3AF', fontSize: 14 }}>
                      {auditFechaFilter || 'Seleccionar...'}
                    </Text>
                    <Text style={{ fontSize: 16 }}>📅</Text>
                  </TouchableOpacity>
                </View>`;

content = content.replace(dateInputRegex, dateReplacement);

// 2. Add Modal above the card
const modalRegex = /<View style=\{\[s\.card, \{ padding: 14, backgroundColor: C\.surf2, marginBottom: 14 \}\]\}>/;
const modalReplacement = `<Modal
            visible={modalFechaVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setModalFechaVisible(false)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <View style={{ backgroundColor: '#2C201A', borderRadius: 16, padding: 20, width: '100%', maxWidth: 320, borderWidth: 1, borderColor: '#4A372D' }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#FFF', marginBottom: 16, textAlign: 'center' }}>
                  Filtrar por Fecha
                </Text>

                <TouchableOpacity
                  onPress={() => {
                    setAuditFechaFilter(new Date().toISOString().split('T')[0]);
                    setModalFechaVisible(false);
                  }}
                  style={{ backgroundColor: '#E07A5F', padding: 12, borderRadius: 8, marginBottom: 10, alignItems: 'center' }}
                >
                  <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Hoy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    const ayer = new Date();
                    ayer.setDate(ayer.getDate() - 1);
                    setAuditFechaFilter(ayer.toISOString().split('T')[0]);
                    setModalFechaVisible(false);
                  }}
                  style={{ backgroundColor: '#3A2A22', padding: 12, borderRadius: 8, marginBottom: 10, alignItems: 'center' }}
                >
                  <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Ayer</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setAuditFechaFilter('');
                    setModalFechaVisible(false);
                  }}
                  style={{ backgroundColor: '#5A3E31', padding: 12, borderRadius: 8, marginBottom: 16, alignItems: 'center' }}
                >
                  <Text style={{ color: '#FFB4A2' }}>Borrar Filtro (Todas)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setModalFechaVisible(false)}
                  style={{ padding: 8, alignItems: 'center' }}
                >
                  <Text style={{ color: '#9CA3AF' }}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <View style={[s.card, { padding: 14, backgroundColor: C.surf2, marginBottom: 14 }]}>`;

content = content.replace(modalRegex, modalReplacement);

// 3. Replace the list rendering
const listRegex = /\{showAuditoriaList && \([\s\S]*?\)\}\s*<\/ScrollView>/;
const listReplacement = `{showAuditoriaList && (
            <View style={{ marginTop: 16 }}>
              {(!auditoriaLogs || auditoriaLogs.length === 0) ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: '#A08D84', fontSize: 14 }}>No hay registros de auditoría disponibles.</Text>
                </View>
              ) : (
                auditoriaLogs.slice(0, 20).map((log, index) => (
                  <View 
                    key={log.id || index} 
                    style={{ 
                      backgroundColor: '#2C201A', 
                      borderRadius: 10, 
                      padding: 12, 
                      marginBottom: 10, 
                      borderLeftWidth: 4, 
                      borderLeftColor: '#E07A5F' 
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>{log.accion || 'Acción'}</Text>
                      <Text style={{ color: '#A08D84', fontSize: 12 }}>{log.fecha ? String(log.fecha).slice(0, 16).replace('T', ' ') : ''}</Text>
                    </View>
                    <Text style={{ color: '#D1D5DB', fontSize: 13 }}>Usuario: {log.usuario || 'Sistema'}</Text>
                    {log.detalles && <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 2 }}>{log.detalles}</Text>}
                  </View>
                ))
              )}
            </View>
          )}
          </ScrollView>`;

content = content.replace(listRegex, listReplacement);

fs.writeFileSync('App.js', content, 'utf8');
console.log('Auditoria patch complete');
