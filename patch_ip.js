const fs = require('fs');

let content = fs.readFileSync('App.js', 'utf8');

// Default serverIP and ipConfigured
content = content.replace(
  'const [serverIP, setServerIP] = useState("");',
  'const [serverIP, setServerIP] = useState("https://brisket-pregnant-squiggly.ngrok-free.dev");'
);

content = content.replace(
  'const [ipConfigured, setIpConfigured] = useState(false);',
  'const [ipConfigured, setIpConfigured] = useState(true);'
);

fs.writeFileSync('App.js', content);
console.log('App.js patched successfully');
