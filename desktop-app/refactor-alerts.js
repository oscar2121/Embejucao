const fs = require('fs');

const files = [
  'C:/Users/oscar/OneDrive/Desktop/files/desktop-app/src/CajaModule.jsx',
  'C:/Users/oscar/OneDrive/Desktop/files/desktop-app/src/AdminModule.jsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  if (!content.includes("import toast from 'react-hot-toast'")) {
    content = content.replace("import axios from 'axios';", "import axios from 'axios';\nimport toast from 'react-hot-toast';");
  }
  
  // Convert success alerts to toast.success
  content = content.replace(/alert\((['"`].*?exitosamente.*?)['"`]\)/gi, 'toast.success($1)');
  content = content.replace(/alert\((['"`].*?correctamente.*?)['"`]\)/gi, 'toast.success($1)');
  content = content.replace(/alert\((`.*?exitosamente.*?`)\)/gi, 'toast.success($1)');
  
  // In AdminModule there is a nested ternary alert: 
  // alert(editUserSel ? (isChangingPin ? "PIN actualizado exitosamente" : "Usuario actualizado exitosamente") : "Usuario creado exitosamente");
  content = content.replace(/alert\(editUserSel \? \(isChangingPin \? "PIN actualizado exitosamente" : "Usuario actualizado exitosamente"\) : "Usuario creado exitosamente"\);/g, 'toast.success(editUserSel ? (isChangingPin ? "PIN actualizado exitosamente" : "Usuario actualizado exitosamente") : "Usuario creado exitosamente");');
  
  // Convert all remaining alert to toast.error
  content = content.replace(/alert\(/g, 'toast.error(');
  
  fs.writeFileSync(file, content);
});

console.log("Alerts replaced with toasts!");
