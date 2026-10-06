import { StyleSheet } from 'react-native';
import { formatearHoraSegura, formatearFechaSegura } from '../utils/cocinaFilter';

export const C = {
  brand: "#3D1A0A",
  mid: "#7B3B1A",
  orange: "#E8520A",
  orangeL: "#FF6B2B",
  cream: "#F5E6C8",
  cream2: "#EDD9A3",
  surface: "#FBF5E8",
  surf2: "#F2E8D0",
  surf3: "#E8D8B8",
  text: "#1C0A02",
  text2: "#6B4A30",
  text3: "#A88060",
  border: "rgba(61,26,10,0.12)",
  green: "#2D6A3F",
  greenL: "#4CAF70",
  yellow: "#D97706",
  red: "#DC2626",
};

export const CATEGORIAS = [
  { id: 1, nombre: "🍔 Hamburguesas" },
  { id: 2, nombre: "🌭 Perros Calientes" },
  { id: 3, nombre: "🌯 Burritos" },
  { id: 4, nombre: "🌭 Salchipapas" },
  { id: 5, nombre: "🌽 Mazorcada" },
  { id: 6, nombre: "🥤 Jugos Naturales" },
  { id: 7, nombre: "🍋 Limonadas" },
  { id: 8, nombre: "🍺 Cervezas y Licores" },
  { id: 9, nombre: "☕ Bebidas Calientes" },
  { id: 10, nombre: "🍟 Adicionales" },
];

export const obtenerMinutosTranscurridos = (horaPedidoString) => {
  if (!horaPedidoString) return 0;
  try {
    const ahora = new Date();
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    let [tiempo, ampm] = horaPedidoString.toLowerCase().split(/( [ap]\.?\s*m\.?)/);
    let [horas, minutos] = tiempo.split(':').map(Number);
    if (isNaN(horas) || isNaN(minutos)) return 0;
    if (ampm) {
      if (ampm.includes('p') && horas < 12) horas += 12;
      if (ampm.includes('a') && horas === 12) horas = 0;
    }
    const minutosPedido = horas * 60 + minutos;
    const diferencia = minutosAhora - minutosPedido;
    return diferencia < 0 ? 0 : diferencia;
  } catch (e) {
    return 0;
  }
};

export const cleanNum = (val) => {
  if (val === null || val === undefined) return '';
  return String(val).replace(/[^0-9]/g, '');
};

export const formatMoneyInput = (val) => {
  if (val === null || val === undefined) return '';
  const numStr = String(val).replace(/[^0-9]/g, '');
  if (!numStr) return '';
  const parsed = parseInt(numStr, 10);
  return isNaN(parsed) ? '' : parsed.toLocaleString('es-CO');
};

export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.brand },
  content: { padding: 14 },

  // NAV
  nav: { backgroundColor: C.brand, flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 54, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "rgba(245,230,200,0.1)" },
  navBrand: { fontSize: 17, fontWeight: "800", color: C.cream, letterSpacing: 0.5 },
  navTabs: { flexDirection: "row", gap: 4 },
  navTab: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  adminNav: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, backgroundColor: C.brand },
  adminNavBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  adminNavBtnActive: { backgroundColor: C.orange },
  adminNavTxt: { color: C.cream, fontWeight: '600' },
  navTabActive: { backgroundColor: C.orange },
  navTabTxt: { fontSize: 12, fontWeight: "500", color: "rgba(245,230,200,0.5)" },
  navTabTxtActive: { color: "white" },
  navBadge: { backgroundColor: C.orange, borderRadius: 9, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 3 },
  navBadgeTxt: { fontSize: 9, color: "white", fontWeight: "700" },

  // STEPS
  stepsRow: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.surf3, alignItems: "center", justifyContent: "center" },
  stepDotActive: { backgroundColor: C.orange },
  stepDotTxt: { fontSize: 11, fontWeight: "700", color: "white" },
  stepLine: { flex: 1, height: 2, backgroundColor: C.surf3, marginHorizontal: 10 },
  stepLabel: { fontSize: 12, color: C.text2, fontWeight: "500", marginLeft: 8 },

  // CARD
  card: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  cardHeader: { padding: 14, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 14, fontWeight: "700", color: C.text },

  // MESAS
  mesasGrid: { flexDirection: "row", flexWrap: "wrap", padding: 16, gap: 12 },
  mesaBtn: { width: "22%", aspectRatio: 1, borderRadius: 12, borderWidth: 2, borderColor: "transparent", alignItems: "center", justifyContent: "center", backgroundColor: C.surf2, gap: 3 },
  mesaLibre: { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" },
  mesaOcupada: { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" },
  mesaCuenta: { borderColor: "#FCD34D", backgroundColor: "#FFFBEB" },
  mesaSel: { borderColor: C.orange, shadowColor: C.orange, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  mesaNum: { fontSize: 24, fontWeight: "800", color: C.text },
  mesaLabel: { fontSize: 9, color: C.text2, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },

  // CATEGORÍAS CARRUSEL
  catRow: { flexDirection: "row", alignItems: "center", backgroundColor: C.brand, paddingHorizontal: 10, paddingVertical: 10, gap: 6 },
  catArrow: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: "rgba(245,230,200,0.25)", backgroundColor: "rgba(245,230,200,0.08)", alignItems: "center", justifyContent: "center" },
  catArrowTxt: { fontSize: 20, color: C.cream, lineHeight: 22 },
  catChip: { paddingVertical: 8, paddingHorizontal: 6, borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(245,230,200,0.2)", backgroundColor: "rgba(245,230,200,0.07)", alignItems: "center" },
  catChipActive: { backgroundColor: C.orange, borderColor: C.orange },
  catChipTxt: { fontSize: 11, fontWeight: "500", color: "rgba(245,230,200,0.7)" },
  catChipTxtActive: { color: "white" },

  // PRODUCTOS
  prodsGrid: { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 10 },
  prodCard: { width: "47%", backgroundColor: C.surf2, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, padding: 12 },
  prodNombre: { fontWeight: "600", fontSize: 13, color: C.text, marginTop: 6, marginBottom: 2 },
  prodDesc: { fontSize: 11, color: C.text2, lineHeight: 16, marginBottom: 6 },
  prodPrecio: { fontWeight: "700", fontSize: 13, color: C.orange },

  // NEW PRODUCT FORM & CATEGORY SECTIONS
  prodForm: { marginBottom: 16, padding: 12, backgroundColor: C.surf2, borderRadius: 8 },
  prodInput: { backgroundColor: C.surf3, padding: 8, marginBottom: 8, borderRadius: 6, color: C.text },
  catSection: { marginBottom: 20 },
  catHeader: { fontSize: 18, fontWeight: "700", color: C.orange, marginBottom: 8 },

  // CARRITO
  carritoItem: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  carritoNombre: { fontSize: 13, fontWeight: "500", color: C.text },
  qtyBtn: { width: 26, height: 26, borderRadius: 6, borderWidth: 1, borderColor: C.border, backgroundColor: C.surf2, alignItems: "center", justifyContent: "center" },
  qtyBtnTxt: { fontSize: 15, color: C.text, lineHeight: 18 },
  qtyNum: { fontWeight: "600", fontSize: 13, color: C.text, minWidth: 20, textAlign: "center" },
  notaInput: { fontSize: 11, color: C.text3, paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  carritoTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, backgroundColor: C.surf2 },
  carritoTotalNum: { fontWeight: "800", fontSize: 20, color: C.orange },

  // COCINA
  itemCocina: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.surf2, borderRadius: 10, padding: 10, marginBottom: 8 },
  itemQty: { fontWeight: "700", fontSize: 14, color: C.orange, minWidth: 28 },

  // BADGES
  badgeBase: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeOrange: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, backgroundColor: "#FFEDD5" },
  badgeYellow: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, backgroundColor: "#FEF3C7" },
  badgeTxt: { fontSize: 11, fontWeight: "500", color: C.text2 },

  // BUTTONS
  btnPrimary: { backgroundColor: C.orange, borderRadius: 10, padding: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
  btnPrimaryTxt: { color: "white", fontWeight: "600", fontSize: 14 },
  btnFull: { marginHorizontal: 0 },
  btnGhost: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: "rgba(245,230,200,0.2)" },
  btnSmDark: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: C.brand },
  btnSmGreen: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: C.green },
  btnSmOrange: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: C.orange },

  // ADMIN
  adminTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: "rgba(245,230,200,0.2)", backgroundColor: "transparent" },
  adminTabActive: { backgroundColor: C.orange, borderColor: C.orange },
  adminTabTxt: { fontSize: 13, fontWeight: "500", color: "rgba(245,230,200,0.6)" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  statCard: { flex: 1, minWidth: "45%", backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14 },
  statLabel: { fontSize: 11, color: C.text2, marginBottom: 4 },
  statValue: { fontWeight: "800", fontSize: 20, color: C.text },
  statSub: { fontSize: 10, color: C.text3, marginTop: 2 },
  sectionTitle: { fontWeight: "800", fontSize: 15, color: C.cream },

  // CAJA ROW
  cajaRow: { flexDirection: "column", backgroundColor: C.surf2, borderRadius: 8, padding: 12, marginBottom: 12 },
  cajaSelect: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: C.border, marginRight: 8 },
  cajaSelectActive: { backgroundColor: C.orange, borderColor: C.orange },
  cajaSelectTxt: { color: C.text, fontWeight: "600" },
  cajaButton: { backgroundColor: C.green, borderRadius: 6, paddingVertical: 8, alignItems: "center", marginTop: 8 },
  cajaButtonTxt: { color: "white", fontWeight: "600" },
  cajaInput: { borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 8, marginTop: 6 },

  // PRODUCTO ROW
  productoRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  formLabel: { fontSize: 12, fontWeight: "500", color: C.text2, marginBottom: 4 },
  formInput: { fontSize: 13, padding: 10, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surf2, color: C.text },

  // TOGGLE
  toggle: { width: 38, height: 22, borderRadius: 11, backgroundColor: C.surf3, justifyContent: "center", paddingHorizontal: 3 },
  toggleOn: { backgroundColor: C.green },
  toggleThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: "white", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  toggleThumbOn: { alignSelf: "flex-end" },

  // TOAST
  toast: { position: "absolute", bottom: 28, alignSelf: "center", backgroundColor: C.brand, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: "rgba(245,230,200,0.15)" },
  toastTxt: { color: C.cream, fontSize: 13, fontWeight: "500" },
});

export const calcularTotalPedido = (items = []) => {
  if (!Array.isArray(items)) return 0;
  return items.reduce((acc, linea) => {
    const base = Number(linea.precio || linea.precio_unitario || 0) || 0;
    const cant = Number(linea.cantidad || 1) || 1;
    const adics = (linea.adicionales || []).reduce(
      (sum, a) => sum + (Number(a.precio || 0) || 0), 0
    );
    return acc + ((base + adics) * cant);
  }, 0);
};

export const obtenerTotalSeguro = (pedido) => calcularTotalPedido(pedido?.items);

export const formatearHoraPedido = (orden) => {
  if (!orden) return '';
  return formatearHoraSegura(orden.hora || orden.fecha || orden.created_at);
};

export { formatearHoraSegura, formatearFechaSegura };

