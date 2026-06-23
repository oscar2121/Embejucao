# 📡 Sincronización en Tiempo Real - Embejucão POS

## ✅ ¿Qué se arregló?

La **sincronización entre dos celulares ahora funciona en tiempo real** siguiendo estos pasos:

1. **IP Dinámica**: Ya no está hardcodeada a `192.168.1.100`
2. **Configuración Inicial**: Pantalla para ingresar la IP del servidor
3. **Sincronización Automática**: Los pedidos se sincronizan cada **5 segundos**
4. **Actualización de Estado**: Cuando cambias el estado del item en cocina, aparece al instante en mesero

---

## 🚀 Cómo Usar (Paso a Paso)

### **1. En la Computadora: Inicia el Servidor**

```bash
# Abre terminal en la carpeta del proyecto
npm run server
```

Deberías ver:
```
Servidor corriendo en puerto 3001
Base de datos conectada
```

### **2. En WINDOWS: Obtén la IP de tu PC**

```bash
# Abre terminal (cmd o PowerShell)
ipconfig
```

Busca esta línea:
```
Adaptador de Ethernet o Adaptador de LAN inalámbrico:
   IPv4 Address (Dirección IPv4): 192.168.X.XXX
```

**Ejemplo:** `192.168.1.100`

### **3. En el PRIMER CELULAR (Mesero)**

1. Abre la app
2. Aparece pantalla: "⚙️ Configuración del Servidor"
3. Ingresa la IP (ej: `192.168.1.100`)
4. Toca "Conectar →"
5. Si ve ✅ "Conectado al servidor", está listo

**Pantalla de configuración:**
```
🍔 Embejucão POS

⚙️ Configuración del Servidor

Dirección IP:
[192.168.1.100]

[Conectar →]

📡 Nota: Ambos teléfonos deben estar 
en la MISMA red WiFi que el servidor.
```

### **4. En el SEGUNDO CELULAR (Chef)**

Repite los pasos 3 (igual IP)

---

## 🔄 Flujo de Sincronización

```
MESERO (Teléfono 1)          COCINA (Teléfono 2)
─────────────────            ────────────────
1. Crea pedido                1. Cada 5s: GET /pedidos/date/HOY
2. POST a servidor            2. Recibe: Mesa 2 - 2 items
3. ✅ "Pedido enviado"        3. ✅ "Nuevo pedido"
                              
4. Mesero espera...           4. Chef: Toca "Preparando"
                              5. PUT /pedidos/uuid/item/0 
                              
6. Recibe actualización       6. Ya aparece "Preparando"
7. Después "Listo"            7. Chef: Toca "Listo"
8. Mesa se marca "Libre"      8. Pedido desaparece (completo)
```

---

## 🔧 Indicadores de Conexión

**En la esquina superior derecha:**
- 🟢 **Punto verde** = Conectado al servidor
- 📡 **"Sin conexión"** = No puede alcanzar servidor

**Si dice "Sin conexión":**
1. Revisa que ambos estén en **misma WiFi**
2. Verifica que `npm run server` está ejecutándose
3. Toca el botón ⚙️ para reconfigurable la IP
4. Prueba con `http://servidor-ip:3001/health` en browser

---

## 💾 Modo Offline

Si se desconecta WiFi:
- Los pedidos se guardan **localmente** en el celular
- Cuando vuelve conexión, se sincronizan automáticamente
- No se pierden datos

---

## 📋 Casos de Uso

### **Caso 1: Mesero crea pedido**
```
1. Mesero: Selecciona Mesa 5
2. Mesero: Selecciona items (2 pizzas, 1 gaseosa)
3. Mesero: Toca "Enviar Pedido"
4. Resultado: 
   - Servidor guarda en BD
   - Chef recibe en <5 segundos
```

### **Caso 2: Chef marca preparando**
```
1. Chef ve pedido: Mesa 5
2. Chef toca cada item → "Preparando"
3. Actualiza servidor
4. Mesero recibe actualización automáticamente
5. Mesero ve: "Preparando" → puede informar al cliente
```

### **Caso 3: Mesero offline**
```
1. Mesero crea pedido (sin WiFi)
2. Se guarda localmente con aviso ⚠️
3. Mesero se conecta a WiFi
4. Pedido se envía automáticamente
5. Chef recibe
```

---

## 🐛 Troubleshooting

| Problema | Solución |
|----------|----------|
| "❌ No puedo conectar" | Revisa IP, verifica `npm run server` |
| Sincronización lenta | Reinicia app, verifica WiFi |
| Datos no aparecen | Toca ⚙️, vuelve a configurar IP |
| "Sin conexión" constante | WiFi puede estar separada del server |

---

## ⚡ Resumen Técnico

**Actualizado en App.js:**
- ✅ Eliminada IP hardcodeada
- ✅ Agregada pantalla de configuración
- ✅ IP se guarda en AsyncStorage (persiste)
- ✅ Sincronización cada 5 segundos (automática)
- ✅ Actualización de items usa IP dinámica
- ✅ Indicador de conexión en tiempo real

**API Endpoints que sincroniza:**
```
GET  /api/pedidos/date/2024-XX-XX  (cada 5s, ambos celulares)
POST /api/pedidos  (al crear pedido)
PUT  /api/pedidos/:uuid/item/:idx  (al cambiar estado)
```

---

## 🎯 ¿Cómo verificar que funciona?

1. Inicia servidor: `npm run server`
2. Configura IP en ambos celulares
3. En Mesero: Crea un pedido (Mesa 1, 2 items)
4. En Chef: Dentro de 5 segundos debe aparecer en "👨‍🍳 Cocina"
5. En Chef: Cambia a "Preparando"
6. En Mesero: Debe actualizarse automáticamente

Si todo funciona = ✅ **Sincronización en tiempo real lista**
