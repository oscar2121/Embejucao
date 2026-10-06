const fs = require('fs');

// 1. PATCH SERVER.JS
let serverContent = fs.readFileSync('server.js', 'utf8');

// Disable delete endpoint
const deleteRegex = /app\.delete\('\/api\/usuarios\/:id', authorize\(\['admin'\]\), \(req, res\) => \{[\s\S]*?(?=app\.)/g;
const newDeleteEndpoint = `app.delete('/api/usuarios/:id', authorize(['admin']), (req, res) => {
  return res.status(403).json({ error: 'Acción no permitida: La eliminación de usuarios está deshabilitada por reglas de negocio.' });
});

`;
serverContent = serverContent.replace(deleteRegex, newDeleteEndpoint);

// Prevent updating roles during user update
const postRegex = /if \(id\) \{([\s\S]*?)\} else \{/g;
serverContent = serverContent.replace(postRegex, (match, updateBlock) => {
  // Replace syncRoles call in the updateBlock so it just returns success
  let newUpdateBlock = updateBlock.replace(/syncRoles\(id, [^,]+, res\);/g, "res.json({ success: true, id });");
  return `if (id) {${newUpdateBlock}} else {`;
});

fs.writeFileSync('server.js', serverContent);
console.log('server.js patched');

// 2. PATCH APP.JS (Mobile)
let appContent = fs.readFileSync('App.js', 'utf8');

// Remove Eliminar button from user list
// Match the {u.nombre !== 'Administrador' && ( <TouchableOpacity onPress={() => eliminarUsuario... </TouchableOpacity> )}
const btnRegexApp = /\{u\.nombre !== 'Administrador' && \([\s\S]*?eliminarUsuario\([\s\S]*?<\/TouchableOpacity>\s*\)\}/;
appContent = appContent.replace(btnRegexApp, '');

// In the edit modal, hide roles section if editUserSel
const rolesSectionApp = `<Text style={{ fontSize: 12, fontWeight: '700', color: C.text, marginTop: 14, marginBottom: 6 }}>Roles Asignados</Text>`;
const newRolesSectionApp = `{!editUserSel && <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, marginTop: 14, marginBottom: 6 }}>Roles Asignados</Text>}`;
appContent = appContent.replace(rolesSectionApp, newRolesSectionApp);

const rolesMapApp = /\{rolesDisponibles\.map\(r => \([\s\S]*?<\/TouchableOpacity>\s*\)\s*\)\}/;
appContent = appContent.replace(rolesMapApp, `{!editUserSel && rolesDisponibles.map(r => {
                      const isSelected = newUserRoles.includes(r.id);
                      return (
                        <TouchableOpacity
                          key={r.id}
                          onPress={() => {
                            if (isSelected) setNewUserRoles(newUserRoles.filter(x => x !== r.id));
                            else setNewUserRoles([...newUserRoles, r.id]);
                          }}
                          style={{
                            paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20,
                            backgroundColor: isSelected ? C.orange : C.surf2,
                            borderWidth: 1, borderColor: isSelected ? C.orange : C.border
                          }}
                        >
                          <Text style={{ fontSize: 11, color: isSelected ? '#fff' : C.text, fontWeight: '600' }}>
                            {isSelected ? '✓ ' : ''}{r.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}`);

// For PIN, App.js already hides PIN on edit, wait, let's see.
// It says: `{!editUserSel && ( <> <Text ...>PIN Inicial ...`
// So PIN is ALREADY hidden in edit! But the prompt says:
// "Campos permitidos para edición: Nombre del usuario. PIN / Contraseña (campo numérico o de texto para actualizar su clave de acceso)."
// So we must SHOW the PIN field in edit as an optional field!
appContent = appContent.replace(/\{\!editUserSel && \(\s*<>\s*<Text([^>]+)>PIN Inicial \(4 a 6 d.*?<\/Text>\s*<TextInput([\s\S]*?)keyboardType="numeric"([\s\S]*?)>\s*<\/>\s*\)\}/, 
  `<Text$1>{editUserSel ? 'Nuevo PIN (Opcional)' : 'PIN Inicial (4 a 6 dígitos)'}</Text>
                    <TextInput$2keyboardType="numeric"$3>`);

fs.writeFileSync('App.js', appContent);
console.log('App.js patched');

// 3. PATCH ADMINMODULE.JSX (Desktop)
let adminContent = fs.readFileSync('desktop-app/src/AdminModule.jsx', 'utf8');

// Remove Eliminar button from user list
const btnRegexAdmin = /<button[\s\S]*?eliminarUsuario\([\s\S]*?<\/button>/;
adminContent = adminContent.replace(btnRegexAdmin, '');

// In the edit modal, hide roles section if userModalData.id
// The roles section in AdminModule.jsx looks like: <h4 className="text-sm font-semibold text-gray-700 mb-3">Roles y Permisos</h4>
adminContent = adminContent.replace(/<h4 className="text-sm font-semibold text-gray-700 mb-3">Roles y Permisos<\/h4>[\s\S]*?<div className="flex flex-wrap gap-2">[\s\S]*?<\/div>/, (match) => {
  return `{ !userModalData.id && ( <>
    ${match}
  </> )}`;
});

// The PIN field: 
// In AdminModule.jsx it says: `{!userModalData.id && ( <div> <label>PIN Inicial`
adminContent = adminContent.replace(/\{\!userModalData\.id && \(\s*<div>\s*<label([^>]+)>PIN Inicial \(4-6 dígitos\)<\/label>\s*<input([\s\S]*?)maxLength="6"([\s\S]*?)>\s*<\/div>\s*\)\}/, 
  `<div>
                      <label$1>{userModalData.id ? 'Nuevo PIN (Opcional)' : 'PIN Inicial (4-6 dígitos)'}</label>
                      <input$2maxLength="6"$3>
                    </div>`);

fs.writeFileSync('desktop-app/src/AdminModule.jsx', adminContent);
console.log('AdminModule.jsx patched');
