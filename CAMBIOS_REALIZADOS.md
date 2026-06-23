# 📋 Cambios Realizados - Embejucão POS

## 🎯 Objetivo Cumplido
✅ Sincronización multi-dispositivo para que 2 celulares compartan datos en tiempo real  
✅ Almacenamiento persistente en base de datos (SQLite)  
✅ Filtrado automático por fecha (solo muestra datos del día actual)  

---

## 📁 Archivos Creados

### 1. **`server.js`** (Nuevo)
- Servidor Express con Node.js
- API REST con 5 endpoints:
  - `POST /api/pedidos` - Crear pedido
  - `GET /api/pedidos/date/:fecha` - Obtener pedidos del día
  - `GET /api/pedidos/:uuid` - Obtener pedido específico
  - `PUT /api/pedidos/:uuid/item/:idx` - Actualizar estado
  - `DELETE /api/pedidos/:uuid` - Completar pedido
- Base de datos SQLite con tabla `pedidos` y `mesas`
- CORS habilitado para conexiones desde celulares

### 2. **`App.js`** (Modificado)
**Cambios principales:**
- Importa `AsyncStorage` para almacenamiento local
- Importa `axios` para conectar con el servidor
- Importa `react-native-uuid` para IDs únicos
- Sincronización automática cada 5 segundos
- Funciona offline - guarda localmente y sincroniza después
- Indicador de conexión (🟢 verde = conectado, 📡 rojo = sin conexión)
- Cambió de IDs incrementales (`id`) a UUIDs (`uuid`)

**Funciones nuevas:**
- `sincronizar()` - Obtiene pedidos del servidor
- `useEffect` - Inicializa datos y sincronización periódica
- Manejo de estado online/offline

### 3. **`package.json`** (Actualizado)
**Dependencias agregadas:**
```json
"@react-native-async-storage/async-storage": "^3.1.1",
"axios": "^1.17.0",
"react-native-uuid": "^2.0.0"
```

**DevDependencies agregadas:**
```json
"cors": "^2.8.5",
"express": "^4.18.2",
"sqlite3": "^5.1.6"
```

**Scripts agregados:**
```json
"server": "node server.js",
"dev": "node server.js"
```

### 4. **`config.js`** (Nuevo)
- Configuración centralizada
- URL del API
- Intervalo de sincronización
- Timeout de requests

### 5. **`apiService.js`** (Nuevo)
- Funciones de API reutilizables
- Almacenamiento local con AsyncStorage
- Manejo de errores

### 6. **`embejucao.db`** (Nuevo)
- Base de datos SQLite
- Guarda todos los pedidos del día
- Persistencia entre reinicios

### 7. **`README.md`** (Nuevo)
- Documentación completa
- Instrucciones de instalación
- Guía de troubleshooting
- Explicación de endpoints

### 8. **`GUIA_RAPIDA.md`** (Nuevo)
- Guía paso a paso para empezar
- Cómo obtener la IP
- Verificación rápida

### 9. **`.env.example`** (Nuevo)
- Template de configuración
- Variables de entorno

---

## 🔄 Cómo Funciona la Sincronización

```
CELULAR 1 (Mesero)          SERVIDOR                CELULAR 2 (Cocina)
    ↓                            ↓                           ↓
Crea pedido → AsyncStorage   SQLite DB   ← Obtiene cada 5s
    ↓            ↓                ↓               ↓
Envía POST → API REST        Guarda              Muestra
    ↓            ↓                ↓               ↓
OK ✅         Responde        Escribe         Actualiza UI
```

---

## 📱 Flujo de Datos Nuevo

### Antiguo (sin sincronización):
```
Celular 1: Crear pedido → Guardar en memoria
Celular 2: (No ve nada - datos diferentes)
Al reiniciar → Datos perdidos ❌
```

### Nuevo (con sincronización):
```
Celular 1: Crear pedido → AsyncStorage + Servidor
Celular 2: Sincroniza cada 5s → Ve el pedido ✅
Al reiniciar → Carga desde servidor ✅
Sin conexión → Funciona offline y sincroniza después ✅
```

---

## 🔑 Cambios Técnicos Importantes

### 1. IDs de Pedidos
- **Antes**: `id: nextId++` (incremental, solo en memoria)
- **Ahora**: `uuid: uuid.v4()` (único, globalme valide)

### 2. Estado de Pedidos
- **Antes**: Estructura simple `{ id, mesa, hora, items }`
- **Ahora**: `{ uuid, mesa, hora, items, fecha, created_at, synced }`

### 3. Persistencia
- **Antes**: Todo en memoria (se perdía al cerrar la app)
- **Ahora**: 
  - Local: AsyncStorage en cada celular
  - Remoto: SQLite en servidor

### 4. Conectividad
- **Antes**: No había concepto de conexión
- **Ahora**: Sincronización automática con indicador visual

---

## 📊 Beneficios

✅ **Múltiples celulares**: Meseros en diferentes áreas  
✅ **Tiempo real**: Pedidos aparecen instantáneamente  
✅ **Offline-first**: Funciona sin internet  
✅ **Histórico**: Todos los pedidos guardados  
✅ **Por fecha**: Fácil filtrar datos del día  
✅ **Sin pérdida**: Datos persistentes  

---

## 🚀 Próximos Pasos

1. Cambiar IP en `App.js` línea 41 con tu IP real
2. Ejecutar `npm run server` en una terminal
3. Ejecutar `npm start` en otra terminal
4. Abrirla en 2 celulares (misma red WiFi)
5. Probar creando pedidos

---

## ⚠️ Requisitos Críticos

- ✅ Ambos celulares en la **MISMA red WiFi**
- ✅ IP correcta en `App.js` (NO localhost)
- ✅ Servidor corriendo (`npm run server`)
- ✅ Firewall permite puerto 3001

---

**Versión:** 1.0.0  
**Fecha:** 6 Junio 2026  
**Estado:** ✅ Listo para usar
