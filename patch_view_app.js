const fs = require('fs');
let appContent = fs.readFileSync('App.js', 'utf8');

const targetStr = `                <Text style={s.btnPrimaryTxt}>
                  {pedidoEditando ? 'Guardar Cambios ✏️' : 'Enviar a cocina 🔥'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* --- MODAL DE CONFIGURAR PRODUCTO (ADICIONALES Y NOTAS) --- */}`;

const replacementStr = `                <Text style={s.btnPrimaryTxt}>
                  {pedidoEditando ? 'Guardar Cambios ✏️' : 'Enviar a cocina 🔥'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
      </ScrollView>

      {/* --- MODAL DE CONFIGURAR PRODUCTO (ADICIONALES Y NOTAS) --- */}`;

if (appContent.includes(targetStr)) {
  appContent = appContent.replace(targetStr, replacementStr);
  fs.writeFileSync('App.js', appContent, 'utf8');
  console.log("Patched missing View closing tag in App.js");
} else {
  console.log("Target string not found in App.js for closing tag");
}
