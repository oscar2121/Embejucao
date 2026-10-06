const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const target = `                        <TouchableOpacity 
                          onPress={() => abrirEdicion(prod)}
                          style={{ backgroundColor: '#FF9800', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 }}
                        >
                          <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 13 }}>✏️ Editar</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>      </View>

                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: p.disp !== false ? C.green : C.text3, fontWeight: '700', fontSize: 10, marginBottom: 6 }}>
                        {p.disp !== false ? 'ACTIVO' : 'INACTIVO'}
                      </Text>
                      <TouchableOpacity
                        onPress={() => toggleProducto(p.id, p.disp)}
                        style={{
                          width: 40,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: p.disp !== false ? C.green : '#D1D5DB',
                          justifyContent: 'center',
                          alignItems: p.disp !== false ? 'flex-end' : 'flex-start',
                          padding: 2,
                        }}
                      >
                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' }} />
                      </TouchableOpacity>
                    </View>
                  </View>`;

const replacement = `                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <View style={{ alignItems: 'center' }}>
                            <Text style={{ color: prod.disp !== false ? C.green : C.text3, fontWeight: '700', fontSize: 10, marginBottom: 6 }}>
                              {prod.disp !== false ? 'ACTIVO' : 'INACTIVO'}
                            </Text>
                            <TouchableOpacity
                              onPress={() => toggleProducto(prod.id, prod.disp)}
                              style={{
                                width: 40, height: 24, borderRadius: 12,
                                backgroundColor: prod.disp !== false ? C.green : '#D1D5DB',
                                justifyContent: 'center',
                                alignItems: prod.disp !== false ? 'flex-end' : 'flex-start',
                                padding: 2,
                              }}
                            >
                              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' }} />
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity 
                            onPress={() => abrirEdicion(prod)}
                            style={{ backgroundColor: '#FF9800', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 }}
                          >
                            <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 13 }}>✏️ Editar</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </View>`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync('App.js', content);
  console.log("Patched successfully");
} else {
  console.log("Target not found!");
}
