const fs = require('fs');

let appPath = 'App.js';
let appCode = fs.readFileSync(appPath, 'utf8');

// Añadir Keyboard al import
if (!appCode.includes('Keyboard,')) {
  appCode = appCode.replace('Vibration, AppState, Image, Dimensions', 'Vibration, AppState, Image, Dimensions, Keyboard');
}

// Reemplazar el bloque de login problemático
const searchBlock = `
                      setLoggedUser({ nombre: loginTargetUser.nombre, roles: res.data.roles });
                      setUserRol(principalRole);
                      
                      if (loginPinInput === '1234' && res.data.roles.includes('admin')) {
                        setLoginModalVisible(false);
                        setSelectedUserLogin(loginTargetUser);
                        setForceChangeAdminPin(true);
                      } else {
                        setTab(principalRole);
                        setLoginModalVisible(false);
                        showToast('✅ Sesión iniciada');
                      }
`.trim();

const replacementBlock = `
                      Keyboard.dismiss();
                      setLoginModalVisible(false);
                      setTimeout(() => {
                        setLoggedUser({ nombre: loginTargetUser.nombre, roles: res.data.roles });
                        setUserRol(principalRole);
                        
                        if (loginPinInput === '1234' && res.data.roles.includes('admin')) {
                          setSelectedUserLogin(loginTargetUser);
                          setForceChangeAdminPin(true);
                        } else {
                          setTab(principalRole);
                          showToast('✅ Sesión iniciada');
                        }
                      }, 250);
`.trim();

if (appCode.includes(searchBlock)) {
  appCode = appCode.replace(searchBlock, replacementBlock);
  fs.writeFileSync(appPath, appCode);
  console.log("App.js patched successfully.");
} else {
  console.log("Could not find the block in App.js");
}
