const fs = require('fs');
let content = fs.readFileSync('App.js', 'utf8');

const regex = /const \[auditFechaFilter, setAuditFechaFilter\] = useState\(''\);\\n  const \[modalFechaVisible, setModalFechaVisible\] = useState\(false\);\\n  const abrirSelectorFecha = \(\) => setModalFechaVisible\(true\);/;

const replacement = `const [auditFechaFilter, setAuditFechaFilter] = useState('');
  const [modalFechaVisible, setModalFechaVisible] = useState(false);
  const abrirSelectorFecha = () => setModalFechaVisible(true);`;

content = content.replace(regex, replacement);

fs.writeFileSync('App.js', content, 'utf8');
console.log('Fixed literal newlines');
