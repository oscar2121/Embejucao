const fs = require('fs');

let content = fs.readFileSync('src/AdminModule.jsx', 'utf8');

const categoriasDef = `
const CATEGORIAS = [
  { id: 1, nombre: "🍔 Hamburguesas" },
  { id: 2, nombre: "🌭 Perros Calientes" },
  { id: 3, nombre: "🌯 Burritos" },
  { id: 4, nombre: "🌭 Salchipapas" },
  { id: 5, nombre: "🌽 Mazorcada" },
  { id: 6, nombre: "🥤 Jugos Naturales" },
  { id: 7, nombre: " Limonadas" },
  { id: 8, nombre: " Bebidas / Cervezas" },
  { id: 9, nombre: "☕ Bebidas Calientes" },
];
`;

// Insert at the top after imports
if (!content.includes('const CATEGORIAS')) {
  content = content.replace(/export function AdminModule/, categoriasDef + "\nexport function AdminModule");
}

// Replace 'categorias' with 'CATEGORIAS' in the array logic
content = content.replace(/const listaCategorias = Array\.isArray\(categorias\) \? categorias : \[\];/, "const listaCategorias = Array.isArray(typeof categorias !== 'undefined' ? categorias : CATEGORIAS) ? (typeof categorias !== 'undefined' ? categorias : CATEGORIAS) : CATEGORIAS;");

fs.writeFileSync('src/AdminModule.jsx', content, 'utf8');
console.log("Patched ReferenceError");
