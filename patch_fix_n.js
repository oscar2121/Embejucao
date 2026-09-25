const fs = require('fs');

let content = fs.readFileSync('App.js', 'utf8');

const literalString = "const [auditFechaFilter, setAuditFechaFilter] = useState('');\\n  const [modalFechaVisible, setModalFechaVisible] = useState(false);";
const replacement = `const [auditFechaFilter, setAuditFechaFilter] = useState('');
  const [modalFechaVisible, setModalFechaVisible] = useState(false);`;

if (content.includes(literalString)) {
    content = content.replace(literalString, replacement);
    fs.writeFileSync('App.js', content, 'utf8');
    console.log("Patched literally successfully");
} else {
    console.log("Not found with literal \\n");
}
