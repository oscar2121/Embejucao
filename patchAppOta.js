const fs = require('fs');

// Patch App.js (Mobile)
const appJsPath = 'App.js';
let appJs = fs.readFileSync(appJsPath, 'utf8');

// Replace isVersionNewerMobile with robust isNewerVersion
const versionCmpFind = `const isVersionNewerMobile = (local, remote) => {
  if (!remote) return false;
  const cleanLocal = local.replace(/^v/, '').split('.').map(Number);
  const cleanRemote = remote.replace(/^v/, '').split('.').map(Number);
  
  for (let i = 0; i < Math.max(cleanLocal.length, cleanRemote.length); i++) {
    const l = cleanLocal[i] || 0;
    const r = cleanRemote[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
};`;
const versionCmpFallback = `const isVersionNewerMobile = (local, remote) => {
  if (!remote) return false;
  const cleanLocal = local.replace(/^v/, '').split('.').map(Number);`;
  
const versionCmpReplace = `const isNewerVersion = (latest, current) => {
  const clean = (v) => String(v || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const [lMaj, lMin, lPat] = clean(latest);
  const [cMaj, cMin, cPat] = clean(current);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
};`;

if (appJs.includes('const isVersionNewerMobile =')) {
  // Try exact match or substring
  const startIdx = appJs.indexOf('const isVersionNewerMobile =');
  const endIdx = appJs.indexOf('};', startIdx) + 2;
  appJs = appJs.substring(0, startIdx) + versionCmpReplace + appJs.substring(endIdx);
}

// Fix checkForUpdates
const checkForUpdatesFind = `const checkForUpdates = async () => {
    if (!ipConfigured || !serverIP) return;
    try {
      let cleanIP = serverIP.trim();
      if (cleanIP.endsWith('/')) cleanIP = cleanIP.slice(0, -1);
      
      let checkUrl = \`http://\${cleanIP}:3001/api/check-update\`;
      if (cleanIP.startsWith('http://') || cleanIP.startsWith('https://')) {
        checkUrl = \`\${cleanIP}/api/check-update\`;
      }
      const response = await axios.get(checkUrl, { 
        timeout: 15000,
        headers: { 'Bypass-Tunnel-Reminder': 'true', 'ngrok-skip-browser-warning': 'true' }
      });
      if (response.data && response.data.version) {
        const { version: remoteVersion, notes, apkUrl } = response.data;
        if (isVersionNewerMobile(APP_VERSION, remoteVersion)) {
          setUpdateInfo({ version: remoteVersion, notes, apkUrl });
          setUpdateModalVisible(true);
        }
      }
    } catch (err) {
      console.log("No se pudo comprobar la actualización de la app:", err.message);
    }
  };`;

const checkForUpdatesReplace = `const checkForUpdates = async () => {
    if (!ipConfigured || !serverIP) return;
    try {
      let cleanIP = serverIP.trim();
      if (cleanIP.endsWith('/')) cleanIP = cleanIP.slice(0, -1);
      
      let checkUrl = \`http://\${cleanIP}:3001/api/check-update?platform=mobile\`;
      if (cleanIP.startsWith('http://') || cleanIP.startsWith('https://')) {
        checkUrl = \`\${cleanIP}/api/check-update?platform=mobile\`;
      }
      const response = await axios.get(checkUrl, { 
        timeout: 15000,
        headers: { 'Bypass-Tunnel-Reminder': 'true', 'ngrok-skip-browser-warning': 'true' }
      });
      
      if (response.data && response.data.updateAvailable) {
        const { latestVersion, releaseNotes, downloadUrl } = response.data;
        if (isNewerVersion(latestVersion, APP_VERSION)) {
          setUpdateInfo({ version: latestVersion, notes: releaseNotes, apkUrl: downloadUrl });
          setUpdateModalVisible(true);
        }
      }
    } catch (err) {
      console.log("No se pudo comprobar la actualización OTA:", err.message);
    }
  };`;

// Substring replace
const startCheckIdx = appJs.indexOf('const checkForUpdates = async () => {');
const endCheckIdx = appJs.indexOf('};', startCheckIdx) + 2;
appJs = appJs.substring(0, startCheckIdx) + checkForUpdatesReplace + appJs.substring(endCheckIdx);

// Block screen modal
appJs = appJs.replace(`onRequestClose={() => setUpdateModalVisible(false)}`, `onRequestClose={() => {}} // Impide cerrar en Android back`);
appJs = appJs.replace(`<TouchableOpacity style={[s.btnOutline, { flex: 1 }]} onPress={() => setUpdateModalVisible(false)}>
                  <Text style={[s.btnText, { color: C.text }]}>Mäs tarde</Text>
                </TouchableOpacity>`, ''); // Remove close button if exists. Or just keep it.

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('App.js OTA mobile updated');
