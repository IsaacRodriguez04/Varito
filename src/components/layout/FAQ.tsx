'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const FAQS: { q: string; a: string }[] = [
  // ── Movimientos ──────────────────────────────────────────────
  {
    q: '¿Cómo registro un gasto?',
    a: 'Toca el botón "+" en la pantalla de Movimientos, elige el tipo "Gasto", llena el monto, descripción, categoría y cuenta (débito, efectivo o tarjeta de crédito). Si el gasto es en tarjeta de crédito puedes elegir pagarlo a meses sin intereses (MSI).',
  },
  {
    q: '¿Cómo registro un ingreso?',
    a: 'Selecciona el tipo "Ingreso" en el formulario de nuevo movimiento. Elige la cuenta de débito o efectivo donde recibirás el dinero, asigna la categoría (por ejemplo "Salario" o "Freelance") y guarda.',
  },
  {
    q: '¿Cómo registro una transferencia entre mis cuentas?',
    a: 'Elige el tipo "Transferencia". Selecciona la cuenta origen y la cuenta destino. Si la transferencia es a un tercero externo (pago a alguien más), deja la cuenta destino vacía.',
  },
  {
    q: '¿En qué se diferencia un "Ahorro" de un "Gasto"?',
    a: 'Un gasto reduce tu saldo disponible de forma definitiva (comida, servicios, etc.). Un ahorro también reduce tu saldo de la cuenta origen, pero queda registrado como dinero que reservas para una meta o fondo, no como un gasto del mes.',
  },
  {
    q: '¿Cómo registro compras a meses sin intereses (MSI)?',
    a: 'Al crear un gasto en una tarjeta de crédito, aparece el selector de plazo. Elige el número de meses (3, 6, 12, etc.) o escribe un plazo personalizado. VARITO calcula automáticamente las fechas de vencimiento de cada cuota según el día de corte y los días al límite de tu tarjeta.',
  },
  {
    q: '¿Cómo registro una bonificación bancaria (cashback, puntos canjeados, devolución de comisión)?',
    a: 'Regístrala como un "Ingreso" en tu cuenta de débito o efectivo que usas habitualmente para pagar tu tarjeta de crédito. Usa la categoría "Bonificación bancaria". Esto mantiene el historial de gastos intacto y refleja correctamente el flujo real: el gasto ocurrió en su momento, y la devolución llega después como un ingreso separado. VARITO te mostrará un aviso en tu cuenta mientras ese dinero aún no ha sido usado para pagos.',
  },
  {
    q: '¿Puedo editar o eliminar un movimiento?',
    a: 'Sí. En la lista de movimientos, toca el movimiento para ver las opciones de edición y eliminación. Si el movimiento tiene cuotas MSI ya pagadas, solo se eliminarán las cuotas pendientes; las pagadas quedan en el historial.',
  },
  {
    q: '¿Qué son los movimientos recurrentes?',
    a: 'Al crear o editar un movimiento puedes activar "Repetir este movimiento cada mes". El siguiente mes, VARITO te lo sugerirá automáticamente al inicio de la lista. Puedes aceptarlo, editarlo o ignorarlo.',
  },
  // ── Cuentas ──────────────────────────────────────────────────
  {
    q: '¿Qué tipos de cuenta puedo agregar?',
    a: 'Hay tres tipos: Crédito (tarjetas de crédito), Débito (cuentas bancarias con saldo propio) y Efectivo (dinero en mano). Cada tipo tiene una lógica de balance distinta.',
  },
  {
    q: '¿Qué es el saldo inicial?',
    a: 'Es el saldo que ya tenías en tu cuenta de débito o efectivo antes de empezar a usar VARITO. Las tarjetas de crédito no tienen saldo inicial porque su deuda se calcula a partir de las cuotas registradas.',
  },
  {
    q: '¿Qué es el día de corte y los días al vencimiento?',
    a: 'El día de corte es el día del mes en que tu banco cierra el ciclo de facturación. Los días al vencimiento son los días adicionales que tienes para pagar después del corte. VARITO usa estos dos datos para calcular exactamente cuándo vence cada cuota MSI.',
  },
  {
    q: '¿Cómo se calcula mi deuda en tarjetas de crédito?',
    a: 'La deuda mostrada es la suma de todas las cuotas sin pagar con fecha de vencimiento igual o posterior a hoy. No incluye cuotas ya pagadas ni futuras de MSI que aún no han vencido según tu ciclo.',
  },
  {
    q: '¿Por qué mi saldo en VARITO no coincide exactamente con el saldo del banco?',
    a: 'VARITO calcula el saldo con base en los movimientos que tú registras. Si hay cargos automáticos, comisiones o movimientos que no has registrado aún, habrá diferencia. Revisa y agrega esos movimientos para mantener la app sincronizada.',
  },
  // ── Dashboard ─────────────────────────────────────────────────
  {
    q: '¿Qué muestra el dashboard?',
    a: 'El dashboard muestra el resumen del mes seleccionado: ingresos, gastos, ahorro y neto; saldo de tus cuentas de débito/efectivo; gráfica de gastos por categoría; tus metas de ahorro activas; deuda total por tarjeta de crédito; y los próximos 15 días de pagos de cuotas.',
  },
  {
    q: '¿Cómo cambio el mes que estoy viendo?',
    a: 'En el dashboard y en movimientos encontrarás un selector de mes con flechas. Tócalo para navegar entre meses anteriores y ver el historial.',
  },
  {
    q: '¿Qué son los "Próximos 15 días" en el dashboard?',
    a: 'Es una lista de todas las cuotas de tarjetas de crédito que vencen en los próximos 15 días, ordenadas por fecha. Te ayuda a anticipar qué pagos debes hacer pronto.',
  },
  // ── Calendario ───────────────────────────────────────────────
  {
    q: '¿Qué muestra el calendario de pagos?',
    a: 'Muestra todas las cuotas pendientes del mes ordenadas por fecha de vencimiento, indicando a qué tarjeta pertenecen y el monto de cada cuota.',
  },
  {
    q: '¿Cómo marco una cuota como pagada?',
    a: 'En el calendario, toca el botón de check junto a la cuota. Al marcarla como pagada quedará registrada con la fecha de pago y ya no se contará en tu deuda pendiente.',
  },
  // ── Categorías y presupuestos ─────────────────────────────────
  {
    q: '¿Por qué no puedo eliminar algunas categorías?',
    a: 'Las categorías del sistema (Alimentación, Transporte, Salario, Bonificación bancaria, etc.) son predeterminadas y no se pueden eliminar para garantizar consistencia. Puedes crear, editar y eliminar tus propias categorías personalizadas.',
  },
  {
    q: '¿Cómo establezco un presupuesto mensual por categoría?',
    a: 'En la sección "Categorías", toca el ícono de edición de cualquier categoría. Ahí puedes asignar un límite de gasto mensual. La app te mostrará una barra de progreso en verde, amarillo o rojo según cuánto has gastado respecto al presupuesto.',
  },
  // ── Metas ────────────────────────────────────────────────────
  {
    q: '¿Cómo creo una meta de ahorro?',
    a: 'Ve a la sección "Metas" y toca el botón "+". Define el nombre, ícono, color, monto objetivo y fecha límite opcional. Luego registra movimientos de tipo "Ahorro" y vincúlalos a esa meta para ir acumulando.',
  },
  {
    q: '¿Qué pasa cuando completo una meta?',
    a: 'Puedes marcarla como completada desde la pantalla de metas. Pasará a la sección de metas completadas y dejará de mostrarse en el resumen del dashboard.',
  },
  // ── Reportes ──────────────────────────────────────────────────
  {
    q: '¿Qué muestran los reportes?',
    a: 'Los reportes muestran un análisis de los últimos 12 meses: gráfica de barras de ingresos vs. gastos por mes, ahorro mensual acumulado y desglose de las categorías con mayor gasto en el período.',
  },
  // ── Notificaciones y PWA ──────────────────────────────────────
  {
    q: '¿Cómo instalo VARITO en mi celular?',
    a: 'VARITO es una Progressive Web App (PWA). En Android, abre el menú del navegador y elige "Agregar a pantalla de inicio". En iPhone, toca el botón de compartir en Safari y luego "Agregar a pantalla de inicio". Una vez instalada, funciona como una app nativa.',
  },
  {
    q: '¿Para qué sirven las notificaciones push?',
    a: 'VARITO te puede enviar recordatorios automáticos 3 días antes de que venza una cuota de tarjeta de crédito, para que nunca se te pase un pago.',
  },
  {
    q: '¿Cómo activo las notificaciones?',
    a: 'En la sección "Perfil", dentro de "Notificaciones", toca el botón para activarlas. El navegador te pedirá permiso. Una vez activadas, recibirás avisos de pagos próximos.',
  },
  {
    q: '¿Puedo usar VARITO sin internet?',
    a: 'Parcialmente. Si ya tienes VARITO instalada como PWA, las pantallas que ya visitaste pueden cargar en modo sin conexión gracias al caché. Sin embargo, para registrar o consultar movimientos actualizados necesitas conexión a internet.',
  },
  // ── Seguridad ─────────────────────────────────────────────────
  {
    q: '¿Mis datos son seguros?',
    a: 'Sí. VARITO usa Supabase con Row Level Security (RLS), lo que significa que cada usuario solo puede ver y modificar sus propios datos. El acceso está protegido por tu cuenta de Google.',
  },
  {
    q: '¿Cómo inicio sesión?',
    a: 'VARITO usa exclusivamente Google OAuth. No necesitas crear una contraseña; simplemente inicia sesión con tu cuenta de Google y la app vincula todos tus datos a ese perfil.',
  },
  {
    q: '¿Puedo cerrar sesión desde la app?',
    a: 'Sí. En la sección "Perfil", al final de la página, encontrarás el botón "Cerrar sesión".',
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm font-medium"
      >
        <span>{q}</span>
        <ChevronDown
          className={cn('mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{a}</p>
      )}
    </div>
  )
}

export function FAQ() {
  return (
    <section className="rounded-xl border bg-card divide-y">
      <div className="px-4 py-3">
        <p className="text-sm font-semibold">Preguntas frecuentes</p>
      </div>
      {FAQS.map((item) => (
        <FAQItem key={item.q} q={item.q} a={item.a} />
      ))}
    </section>
  )
}
