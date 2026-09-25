const fs = require('fs');
let code = fs.readFileSync('App.js', 'utf8');

const targetRegex = /<Text style={{ fontSize: 13, fontWeight: '700', color: C\.text2, marginBottom: 8 }}>🍟 Adicionales Extra:<\/Text>[\s\S]*?<\/View>/;

const replacement = `{(!prodToConfig.cat || Number(prodToConfig.cat) < 6) && (
                  <>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: C.text2, marginBottom: 8 }}>🍟 Adicionales Extra:</Text>
                    <View style={{ gap: 8, marginBottom: 16 }}>
                      {adicionalesDisponibles.map(adic => {
                        const isSelected = configAdicionales.some(a => a.id === adic.id);
                        return (
                          <TouchableOpacity
                            key={adic.id}
                            onPress={() => {
                              if (isSelected) {
                                setConfigAdicionales(prev => prev.filter(a => a.id !== adic.id));
                              } else {
                                setConfigAdicionales(prev => [...prev, adic]);
                              }
                            }}
                            style={{
                              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                              padding: 12, borderRadius: 8, borderWidth: 1.5,
                              borderColor: isSelected ? C.orange : C.border,
                              backgroundColor: isSelected ? 'rgba(232,82,10,0.05)' : C.surf2
                            }}
                          >
                            <Text style={{ fontWeight: '700', color: C.text }}>{adic.nombre}</Text>
                            <Text style={{ fontWeight: '700', color: C.orange }}>+\${adic.precio.toLocaleString("es-CO")}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}`;

if (targetRegex.test(code)) {
  code = code.replace(targetRegex, replacement);
  fs.writeFileSync('App.js', code);
  console.log("Success");
} else {
  console.log("Target section not found");
}
