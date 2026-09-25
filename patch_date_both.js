const fs = require('fs');

let adminContent = fs.readFileSync('desktop-app/src/AdminModule.jsx', 'utf8');

const replacementAdmin = `type="date"
                    value={auditFechaFilter}
                    onChange={(e) => setAuditFechaFilter(e.target.value)}
                    style={{
                      backgroundColor: '#F5EBE1',
                      border: '1.5px solid #D4A373',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      color: '#333',
                      fontSize: '14px',
                      cursor: 'pointer',
                      width: '100%'
                    }}`;

// Use Regex to be safe with newlines and spaces
const adminRegex = /type="text"[\s\r\n]*placeholder="Ej\. 2026-06-08"[\s\r\n]*value=\{auditFechaFilter\}[\s\r\n]*onChange=\{\(e\) => setAuditFechaFilter\(e\.target\.value\)\}[\s\r\n]*style=\{\{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var\(--border\)', fontSize: '14px', backgroundColor: 'var\(--surf2\)' \}\}/m;

adminContent = adminContent.replace(adminRegex, replacementAdmin);
fs.writeFileSync('desktop-app/src/AdminModule.jsx', adminContent);
console.log("Patched AdminModule.jsx");

// App.js
let appContent = fs.readFileSync('App.js', 'utf8');

// Also inject the modal code for App.js inside AdminView
const modalCode = `
      {/* Modal Fecha Auditoría Ligero */}
      <Modal visible={modalFechaVisible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFF', padding: 20, borderRadius: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Filtrar por Fecha</Text>
            
            <TouchableOpacity 
              onPress={() => { setAuditFechaFilter(new Date().toISOString().split('T')[0]); setModalFechaVisible(false); }}
              style={{ padding: 12, backgroundColor: '#F5EBE1', borderRadius: 8, marginBottom: 8 }}
            >
              <Text style={{ textAlign: 'center', color: '#333', fontWeight: 'bold' }}>Hoy</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => { 
                const d = new Date(); d.setDate(d.getDate() - 1); 
                setAuditFechaFilter(d.toISOString().split('T')[0]); 
                setModalFechaVisible(false); 
              }}
              style={{ padding: 12, backgroundColor: '#F5EBE1', borderRadius: 8, marginBottom: 8 }}
            >
              <Text style={{ textAlign: 'center', color: '#333', fontWeight: 'bold' }}>Ayer</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => { setAuditFechaFilter(''); setModalFechaVisible(false); }}
              style={{ padding: 12, backgroundColor: '#FFD7D7', borderRadius: 8, marginBottom: 16 }}
            >
              <Text style={{ textAlign: 'center', color: '#D32F2F', fontWeight: 'bold' }}>Borrar Filtro (Todas las fechas)</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setModalFechaVisible(false)} style={{ padding: 12, borderRadius: 8 }}>
              <Text style={{ textAlign: 'center', color: '#666' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
`;

const stateCode = `  const [auditFechaFilter, setAuditFechaFilter] = useState('');
  const [modalFechaVisible, setModalFechaVisible] = useState(false);
  const abrirSelectorFecha = () => setModalFechaVisible(true);
`;

const appTargetRegex = /<TextInput[\s\r\n]*placeholder="Ej\. 2026-06-08"[\s\r\n]*value=\{auditFechaFilter\}[\s\r\n]*onChangeText=\{setAuditFechaFilter\}[\s\r\n]*style=\{\{[\s\S]*?\}\}[\s\r\n]*\/>/;

const appReplacement = `<TouchableOpacity 
                      onPress={abrirSelectorFecha}
                      style={{
                        backgroundColor: '#F5EBE1',
                        borderRadius: '8px',
                        padding: 12,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <Text style={{ color: auditFechaFilter ? '#333' : '#999', fontSize: 14 }}>
                        {auditFechaFilter || 'Seleccionar fecha...'}
                      </Text>
                      <Text style={{ fontSize: 16 }}>📅</Text>
                    </TouchableOpacity>`;

if (appContent.match(appTargetRegex)) {
  appContent = appContent.replace(appTargetRegex, appReplacement);
  
  // Clean up duplicate auditFechaFilter if it exists to avoid redeclaration error
  appContent = appContent.replace(/const \[auditFechaFilter, setAuditFechaFilter\] = useState\(''\);/, '');

  // Insert modal state and functions near the top of AdminView
  const adminViewMatch = appContent.match(/function AdminView\(\{[\s\S]*?\}\) \{/);
  if (adminViewMatch) {
    appContent = appContent.replace(adminViewMatch[0], adminViewMatch[0] + '\\n' + stateCode);
  }
  
  // Insert modal code just before the final return of AdminView or before another modal
  const modalMatch = appContent.match(/\{\/\* --- CONFIRMAR CANCELAR PEDIDO MODAL --- \*\/\}/);
  if (modalMatch) {
    appContent = appContent.replace(modalMatch[0], modalCode + '\\n' + modalMatch[0]);
  }
  
  fs.writeFileSync('App.js', appContent);
  console.log("Patched App.js successfully");
} else {
  console.log("App.js target not found");
}
