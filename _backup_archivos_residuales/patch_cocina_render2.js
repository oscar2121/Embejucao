const fs = require('fs');

let content = fs.readFileSync('App.js', 'utf8');

// Normalize to LF for replacement, then restore CRLF at end
const normalized = content.replace(/\r\n/g, '\n');

const badBlock = `              const renderItem = (it) => (\n                      {estadoLabel[it.estado]}\n                    </Text>\n                  </TouchableOpacity>\n                  {it.estado === "preparando" && (\n                    <TouchableOpacity style={[s.btnSmGreen, { marginLeft: 6 }]} onPress={() => onActualizar(p.uuid, it.originalIdx, "listo")}>\n                      <Text style={{ color: "white", fontSize: 12 }}>✅ Listo</Text>\n                    </TouchableOpacity>\n                  )}\n                </View>\n              );`;

const goodBlock = `              const renderItem = (it) => (
                <View
                  key={it.originalIdx}
                  style={{
                    backgroundColor: '#EFE6D8',
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 8,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Text style={{ color: '#EA580C', fontWeight: 'bold', fontSize: 14 }}>×{it.cantidad}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#1F2937' }}>{it.nombre}</Text>
                      {!!it.nota && <Text style={{ fontSize: 11, color: '#6B7280' }}>📌 {it.nota}</Text>}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {(!it.estado || it.estado === 'pendiente') && (
                      <TouchableOpacity
                        onPress={() => onActualizar(p.uuid, it.originalIdx, 'preparando')}
                        style={{ backgroundColor: '#E0D4C3', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 }}
                      >
                        <Text style={{ color: '#5A4A3E', fontSize: 12, fontWeight: '600' }}>⏳ Pendiente</Text>
                      </TouchableOpacity>
                    )}
                    {it.estado === 'preparando' && (
                      <>
                        <View style={{ backgroundColor: '#FDE68A', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8 }}>
                          <Text style={{ color: '#B45309', fontSize: 12, fontWeight: 'bold' }}>🔥 Preparando</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => onActualizar(p.uuid, it.originalIdx, 'listo')}
                          style={{ backgroundColor: '#15803D', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 }}
                        >
                          <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>✅ Listo</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {it.estado === 'listo' && (
                      <View style={{ backgroundColor: '#DCFCE7', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 }}>
                        <Text style={{ color: '#166534', fontSize: 12, fontWeight: 'bold' }}>✓ Despachado</Text>
                      </View>
                    )}
                  </View>
                </View>
              );`;

if (!normalized.includes(badBlock)) {
  console.log('Block not found. Searching for partial match...');
  const idx = normalized.indexOf('const renderItem = (it) =>');
  console.log('renderItem at char:', idx);
  console.log(JSON.stringify(normalized.substring(idx, idx + 200)));
  process.exit(1);
}

const fixed = normalized.replace(badBlock, goodBlock);
// Restore CRLF
fs.writeFileSync('App.js', fixed.replace(/\n/g, '\r\n'), 'utf8');
console.log('SUCCESS: renderItem replaced');
