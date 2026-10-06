const fs = require('fs');

let content = fs.readFileSync('App.js', 'utf8');

const regex = /const \[auditFechaFilter, setAuditFechaFilter\] = useState\(''\);/;

const replacement = `const [auditFechaFilter, setAuditFechaFilter] = useState('');
  const [modalFechaVisible, setModalFechaVisible] = useState(false);`;

content = content.replace(regex, replacement);

fs.writeFileSync('App.js', content, 'utf8');
console.log('Injected state');
