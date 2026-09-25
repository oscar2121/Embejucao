const fs = require('fs');

function patchAppJs() {
  let txt = fs.readFileSync('App.js', 'utf8');

  // 1. Revertir el bypass en iniciarAgregarProducto
  const targetIniciar = `  const iniciarAgregarProducto = (prod) => {
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

  const replacementIniciar = `  const iniciarAgregarProducto = (prod) => {
    setProdToConfig(prod);
    setConfigObservaciones('');
    setConfigAdicionales([]);
    setConfigCantidad(1);
    setProdConfigModalVisible(true);
  };`;

  txt = txt.replace(targetIniciar, replacementIniciar);

  // 2. Ocultar adicionales en bebidas en App.js
  const targetModal = `<Text style={{ fontSize: 13, fontWeight: '700', color: C.text2, marginBottom: 8 }}>🌭 Adicionales Extra:</Text>
                <View style={{ gap: 8, marginBottom: 16 }}>
                  {adicionalesDisponibles.map(adic => {`;
  
  const replacementModal = `{!['bebidas', 'cervezas', 'cerveza', 'jugos', 'gaseosas', 'licores'].includes((prodToConfig?.categoria || '').toLowerCase().trim()) && (
                  <>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: C.text2, marginBottom: 8 }}>🌭 Adicionales Extra:</Text>
                    <View style={{ gap: 8, marginBottom: 16 }}>
                      {adicionalesDisponibles.map(adic => {`;

  const targetModalEnd = `                        </TouchableOpacity>
                      );
                    })}
                  </View>`;

  const replacementModalEnd = `                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  </>
                )}`;

  if (txt.includes(targetModal)) {
    txt = txt.replace(targetModal, replacementModal);
    txt = txt.replace(targetModalEnd, replacementModalEnd);
  }

  fs.writeFileSync('App.js', txt);
  console.log('App.js patched successfully for Adicionales and Notas logic.');
}

function patchPedidosModule() {
  let txt = fs.readFileSync('desktop-app/src/PedidosModule.jsx', 'utf8');

  // 1. Revertir el bypass en iniciarAgregarProducto
  const targetIniciar = `  const iniciarAgregarProducto = (prod) => {
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

  const replacementIniciar = `  const iniciarAgregarProducto = (prod) => {
    setProdToConfig(prod);
    setConfigObservaciones('');
    setConfigAdicionales([]);
    setConfigCantidad(1);
    setProdConfigModalVisible(true);
  };`;

  txt = txt.replace(targetIniciar, replacementIniciar);

  // 2. Ocultar adicionales en bebidas en PedidosModule.jsx
  const targetModal = `<h3 style={{ fontSize: '16px', color: 'var(--text-light)', marginBottom: '12px' }}>🍟 Adicionales Extra:</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '24px' }}>
              {adicionales.map(adic => {`;
              
  const replacementModal = `{!['bebidas', 'cervezas', 'cerveza', 'jugos', 'gaseosas', 'licores'].includes((prodToConfig?.categoria || '').toLowerCase().trim()) && (
              <>
                <h3 style={{ fontSize: '16px', color: 'var(--text-light)', marginBottom: '12px' }}>🍟 Adicionales Extra:</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '24px' }}>
                  {adicionales.map(adic => {`;

  const targetModalEnd = `                  </div>
                );
              })}
            </div>`;

  const replacementModalEnd = `                  </div>
                );
              })}
            </div>
            </>
            )}`;

  if (txt.includes(targetModal)) {
    txt = txt.replace(targetModal, replacementModal);
    txt = txt.replace(targetModalEnd, replacementModalEnd);
  }

  fs.writeFileSync('desktop-app/src/PedidosModule.jsx', txt);
  console.log('PedidosModule.jsx patched successfully for Adicionales and Notas logic.');
}

patchAppJs();
patchPedidosModule();
