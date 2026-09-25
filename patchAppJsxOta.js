const fs = require('fs');

const appJsxPath = 'desktop-app/src/App.jsx';
let content = fs.readFileSync(appJsxPath, 'utf8');

// 1. Add useEffect to import
if (content.includes("import { useState }")) {
  content = content.replace("import { useState }", "import { useState, useEffect } from");
}

// 2. Add State and Logic to App()
const appFuncStart = `function App() {`;
const updateLogic = `function App() {
  const DESKTOP_VERSION = '1.0.0';
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

  const isNewerVersion = (latest, current) => {
    const clean = (v) => String(v || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const [lMaj, lMin, lPat] = clean(latest);
    const [cMaj, cMin, cPat] = clean(current);
    if (lMaj !== cMaj) return lMaj > cMaj;
    if (lMin !== cMin) return lMin > cMin;
    return lPat > cPat;
  };

  const checkDesktopUpdates = async (manual = false) => {
    try {
      // Usar la misma base URL que los demas o localhost
      const host = serverUrl || 'http://localhost:3001';
      const res = await axios.get(\`\${host}/api/check-update?platform=desktop\`);
      if (res.data && res.data.updateAvailable) {
        if (isNewerVersion(res.data.latestVersion, DESKTOP_VERSION)) {
          setUpdateInfo(res.data);
          setUpdateModalVisible(true);
        } else if (manual) {
          alert('El sistema ya está en la última versión (' + DESKTOP_VERSION + ')');
        }
      } else if (manual) {
        alert(res.data.message || 'Sin versiones disponibles');
      }
    } catch (e) {
      console.log('Error checking desktop updates:', e);
      if (manual) alert('Error al comprobar actualizaciones.');
    }
  };

  useEffect(() => {
    // Comprobar actualización automáticamente al arrancar
    checkDesktopUpdates();
  }, []);
`;
content = content.replace(appFuncStart, updateLogic);

// 3. Add bottom sidebar version indicator
const sidebarFind = `            </button>
          ))}
        </aside>`;
const sidebarReplace = `            </button>
          ))}
          <div style={{ flex: 1 }}></div>
          <div style={{ padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', marginBottom: '4px' }}>v{DESKTOP_VERSION}</span>
            <button 
              onClick={() => checkDesktopUpdates(true)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '18px' }}
              title="Buscar actualización"
            >
              🔄
            </button>
          </div>
        </aside>`;
content = content.replace(sidebarFind, sidebarReplace);

// 4. Add Modal UI at the end of return inside app-container
const renderModal = `
      {/* UPDATE MODAL */}
      {updateModalVisible && updateInfo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ width: '400px', backgroundColor: 'var(--surface)', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ backgroundColor: 'var(--brand)', padding: '16px', textAlign: 'center', color: 'white' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>Actualización Disponible</h2>
              <p style={{ margin: 0, opacity: 0.8 }}>¡Hay una nueva versión para Desktop!</p>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div><small style={{ color: 'var(--text2)' }}>Versión actual</small><br/><strong>{DESKTOP_VERSION}</strong></div>
                <div style={{ textAlign: 'right' }}><small style={{ color: 'var(--text2)' }}>Nueva versión</small><br/><strong style={{ color: 'var(--green)' }}>{updateInfo.latestVersion}</strong></div>
              </div>
              <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '20px', maxHeight: '100px', overflowY: 'auto' }}>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: 'var(--text2)' }}>Novedades:</p>
                {updateInfo.releaseNotes && updateInfo.releaseNotes.map((n, i) => (
                  <p key={i} style={{ margin: '4px 0 0', fontSize: '13px' }}>• {n}</p>
                ))}
              </div>
              <button 
                onClick={() => {
                  if (updateInfo.downloadUrl) {
                    if (window.electronAPI && window.electronAPI.openExternal) {
                      window.electronAPI.openExternal(updateInfo.downloadUrl);
                    } else {
                      window.open(updateInfo.downloadUrl, '_blank');
                    }
                  }
                  setUpdateModalVisible(false); // Ocultar despus de clic
                }}
                style={{ width: '100%', padding: '12px', backgroundColor: 'var(--green)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Descargar e Instalar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;`;

const appEndRegex = /    <\/div>\s*\);\s*\}\s*export default App;/;
content = content.replace(appEndRegex, renderModal);

fs.writeFileSync(appJsxPath, content, 'utf8');
console.log('App.jsx desktop updated');
