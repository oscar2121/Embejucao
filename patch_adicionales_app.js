const fs = require('fs');
let txt = fs.readFileSync('App.js', 'utf8');

const target = `  const iniciarAgregarProducto = (prod) => {
    setProdToConfig(prod);
    setConfigObservaciones('');
    setConfigAdicionales([]);
    setConfigCantidad(1);
    setProdConfigModalVisible(true);
  };`;

const replacement = `  const iniciarAgregarProducto = (prod) => {
    const categoriasSinAdicionales = ['bebidas', 'cervezas', 'cerveza', 'jugos', 'gaseosas', 'licores'];
    const categoriaNormalizada = (prod?.categoria || '').toLowerCase().trim();

    if (categoriasSinAdicionales.includes(categoriaNormalizada)) {
      // Se añade directamente al pedido sin desplegar modal de adicionales
      const nuevoItem = {
        ...prod,
        id_unico: uuid.v4(),
        nombre: prod.nombre,
        precio: prod.precio,
        cantidad: 1,
        estado: 'pendiente',
        nota: ''
      };
      
      setCarrito(c => {
        const isEditing = !!pedidoEditando;
        const ex = c.find(i => i.id === prod.id && i.nombre === prod.nombre && i.nota === '' && (!isEditing || i.estado !== 'listo'));
        if (ex) {
          return c.map(i => (i.id === prod.id && i.nombre === prod.nombre && i.nota === '' && (!isEditing || i.estado !== 'listo'))
            ? { ...i, cantidad: i.cantidad + 1 }
            : i
          );
        }
        return [...c, nuevoItem];
      });
      showToast(\`➕ 1x \${prod.nombre}\`);
    } else {
      // Es comida: abrir modal de adicionales si el plato los admite
      setProdToConfig(prod);
      setConfigObservaciones('');
      setConfigAdicionales([]);
      setConfigCantidad(1);
      setProdConfigModalVisible(true);
    }
  };`;

txt = txt.replace(target, replacement);
fs.writeFileSync('App.js', txt);
console.log('App.js patched successfully');
