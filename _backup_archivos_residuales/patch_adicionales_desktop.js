const fs = require('fs');
let txt = fs.readFileSync('desktop-app/src/PedidosModule.jsx', 'utf8');

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
      const uuidStr = Math.random().toString(36).substr(2, 9);
      const nuevoItem = {
        ...prod,
        uuid: uuidStr,
        nombre: prod.nombre,
        precio: prod.precio,
        cantidad: 1,
        estado: 'pendiente',
        nota: ''
      };
      
      setCarrito(prev => {
        const exist = prev.find(i => i.id === prod.id && i.nombre === prod.nombre && i.nota === '');
        if (exist) {
          return prev.map(i => (i.id === prod.id && i.nombre === prod.nombre && i.nota === '') 
            ? { ...i, cantidad: i.cantidad + 1 } 
            : i
          );
        }
        return [...prev, nuevoItem];
      });
      // toast.success(\`➕ 1x \${prod.nombre}\`); // Optional toast if needed, but App.js used showToast. Here we just add it silently or rely on state update.
    } else {
      setProdToConfig(prod);
      setConfigObservaciones('');
      setConfigAdicionales([]);
      setConfigCantidad(1);
      setProdConfigModalVisible(true);
    }
  };`;

txt = txt.replace(target, replacement);
fs.writeFileSync('desktop-app/src/PedidosModule.jsx', txt);
console.log('PedidosModule.jsx patched successfully');
