const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

// Inject the state
content = content.replace(/const \[auditFechaFilter, setAuditFechaFilter\] = useState\(''\);/, "const [catExpandida, setCatExpandida] = useState(null);\n  const [auditFechaFilter, setAuditFechaFilter] = useState('');");

// Replace the render logic
const regex = /\{Object\.entries\(productos\.reduce\(\(acc, p\) => \{[\s\S]*?<\/View>\s*\)\)\}\s*<\/ScrollView>/;

const newRender = `{(() => {
              const catsSeguras = Array.isArray(CATEGORIAS) ? CATEGORIAS : [];
              const prodsSeguros = Array.isArray(productos) ? productos : [];
              
              const catalogoAgrupado = catsSeguras.map(cat => {
                const prodsDeCat = prodsSeguros.filter(p => Number(p.cat) === Number(cat.id));
                return { ...cat, items: prodsDeCat };
              });

              return catalogoAgrupado.map(cat => (
                <View key={cat.id}>
                  <TouchableOpacity 
                    onPress={() => setCatExpandida(prev => prev === cat.id ? null : cat.id)}
                    style={{ 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      paddingVertical: 12, 
                      paddingHorizontal: 6,
                      marginTop: 10
                    }}
                  >
                    <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#E07A5F' }}>
                      {cat.nombre} ({cat.items.length})
                    </Text>
                    <Text style={{ fontSize: 16, color: '#E07A5F', fontWeight: 'bold' }}>
                      {catExpandida === cat.id ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>

                  {catExpandida === cat.id && (
                    <View style={{ gap: 10, marginBottom: 10 }}>
                      {cat.items.map(prod => (
                        <View 
                          key={prod.id} 
                          style={{ 
                            backgroundColor: '#F3EDE2', 
                            borderRadius: 14, 
                            padding: 14, 
                            flexDirection: 'row', 
                            justifyContent: 'space-between', 
                            alignItems: 'center' 
                          }}
                        >
                          <TouchableOpacity 
                            onPress={() => abrirModalEditarProducto(prod)}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                          >
                            <Text style={{ fontSize: 24 }}>{prod.emoji || '🍔'}</Text>
                            <View>
                              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1F2937' }}>{prod.nombre}</Text>
                              <Text style={{ fontSize: 14, color: '#4B5563', marginTop: 2 }}>
                                \${Number(prod.precio || 0).toLocaleString()}
                              </Text>
                            </View>
                          </TouchableOpacity>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <TouchableOpacity 
                              onPress={() => abrirModalEditarProducto(prod)}
                              style={{ padding: 6 }}
                            >
                              <Text style={{ fontSize: 18 }}>✏️</Text>
                            </TouchableOpacity>

                            <View style={{ alignItems: 'center' }}>
                              <Text style={{ fontSize: 9, fontWeight: '700', color: prod.disp !== false ? '#15803D' : '#6B7280', marginBottom: 2 }}>
                                {prod.disp !== false ? 'ACTIVO' : 'INACTIVO'}
                              </Text>
                              <Switch
                                value={prod.disp !== false}
                                onValueChange={() => toggleProducto(prod.id, prod.disp)}
                                trackColor={{ false: '#D1D5DB', true: '#2E7D32' }}
                                thumbColor="#FFFFFF"
                              />
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ));
            })()}
          </ScrollView>`;

content = content.replace(regex, newRender);

fs.writeFileSync('App.js', content, 'utf8');
console.log('Patch complete');
