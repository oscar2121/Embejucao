const mapFiados = (fiadosList) => {
  if (!fiadosList) return [];
  const grouped = {};
  fiadosList.forEach(f => {
    let history = [];
    if (f.ordenes_historial) {
      history = f.ordenes_historial;
    } else if (f.items && f.items.length > 0 && (f.items[0].fecha || f.items[0].items)) {
      history = f.items;
    } else if (f.items) {
      history = [{
        fecha: f.fecha_fiado || new Date().toISOString(),
        mesa: String(f.mesa || ''),
        items: f.items
      }];
    }
    const key = f.deudor ? f.deudor.trim().toLowerCase() : 'desconocido';
    if (!grouped[key]) {
      grouped[key] = {
        ...f,
        uuids: [f.uuid],
        ordenes_historial: [...history],
        items: [...history]
      };
    } else {
      if (f.uuid) grouped[key].uuids.push(f.uuid);
      grouped[key].ordenes_historial.push(...history);
      grouped[key].items.push(...history);
    }
  });
  return Object.values(grouped);
};

const alreadyMapped = [
  {
    "id": 105,
    "uuid": "a1",
    "items": [
      {
        "fecha": "2026-09-12T00:28:45.729Z",
        "mesa": "",
        "items": [
          {
            "id": 202
          }
        ]
      }
    ],
    "estado": "fiado",
    "deudor": "rafa",
    "uuids": [
      "a1"
    ],
    "ordenes_historial": [
      {
        "fecha": "2026-09-12T00:28:45.729Z",
        "mesa": "",
        "items": [
          {
            "id": 202
          }
        ]
      }
    ]
  }
];

console.log(JSON.stringify(mapFiados(alreadyMapped), null, 2));
