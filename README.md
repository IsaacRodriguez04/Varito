# VARITO — Finanzas Personales

## El problema que resuelve

En México es muy común comprar a meses sin intereses (MSI). El problema es que no existe una forma sencilla de saber cuánto debes en total, cuándo vence cada cuota, ni cómo eso afecta tu flujo de dinero mensual. Las apps de finanzas genéricas tratan las compras a meses como un gasto único, ignorando completamente la realidad de los vencimientos futuros.

VARITO resuelve exactamente eso: registras una compra a 12 meses y el sistema automáticamente genera las 12 cuotas con sus fechas de vencimiento reales, basadas en el día de corte y los días al vencimiento de tu tarjeta específica. Desde ese momento puedes ver en un calendario cuándo cae cada pago, cuánto debes en total por tarjeta, y recibir una notificación push 3 días antes de que venza cualquier cuota.

---

## Arquitectura general

```
Usuario (navegador / PWA)
        │
        ▼
  Next.js 16 (Vercel)
  ├── App Router — server components renderizan datos directamente desde Supabase
  ├── Server Actions — mutaciones (crear/editar/borrar) corren en el servidor
  ├── Middleware (proxy.ts) — protege rutas, redirige si no hay sesión
  └── API Routes
        ├── /api/auth/callback — intercambia el código OAuth de Google por sesión
        ├── /api/push/subscribe — guarda/elimina suscripciones push
        └── /api/cron/notify — enviado por Vercel Cron cada día a las 9AM México
                │
                ▼
        web-push → navegador del usuario (notificación nativa)
        │
        ▼
  Supabase (PostgreSQL + Auth + RLS)
```

**Flujo de datos típico:** el usuario abre la app → el middleware verifica la sesión en Supabase → si hay sesión, el server component consulta directamente la base de datos (sin API intermedia) → renderiza HTML con los datos → el cliente recibe una página ya con contenido.

Las mutaciones van por Server Actions: el formulario llama una función que corre en el servidor, valida la sesión, escribe en Supabase y llama `revalidatePath()` para que Next.js regenere las páginas afectadas.

---

## Por qué cada tecnología

| Tecnología | Por qué |
|---|---|
| **Next.js 16 App Router** | Server components permiten leer Supabase directamente sin exponer claves al cliente ni hacer fetch desde el navegador |
| **Supabase** | PostgreSQL gestionado con Auth integrado, RLS por fila, y cliente para SSR (`@supabase/ssr`) que sincroniza cookies entre servidor y cliente |
| **Tailwind v4 + shadcn/ui** | Componentes accesibles listos, sin JS extra, estilizables con utilidades |
| **Base UI** | Componentes headless para selects complejos donde shadcn no cubría el caso (selects con ícono + label dinámico) |
| **Recharts** | Gráfica de dona para distribución de gastos por categoría, con tooltip y leyenda personalizada |
| **web-push** | Librería Node.js para enviar notificaciones push con VAPID sin depender de servicios externos de terceros |
| **Vercel Cron** | Ejecuta el endpoint de notificaciones diariamente sin necesidad de un servidor dedicado |
| **date-fns** | Cálculos de fechas para MSI (próximo corte, suma de meses preservando días de fin de mes) |

---

## Modelo de datos y relaciones

```
auth.users (Supabase Auth)
    │
    │ trigger on_auth_user_created
    ▼
profiles ──────────────────────────────┐
    │                                  │
    ├── accounts                       │
    │     └── type: credit/debit/cash  │
    │           cut_day: día de corte  │
    │           days_to_due: días      │
    │                                  │
    ├── categories                     │
    │     └── icon, color, is_system   │
    │                                  │
    ├── goals
    │     ├── target_amount / saved_amount
    │     └── is_completed
    │
    ├── movements ─────────────────────┤
    │     ├── type: expense/income/    │
    │     │         saving/transfer    │
    │     ├── category_id → categories │
    │     ├── account_id → accounts    │
    │     ├── destination_account_id   │  (solo en transfers)
    │     ├── goal_id → goals          │  (solo en saving, opcional)
    │     └── installments: 1/3/6/... │
    │           │                      │
    │           │ (si es expense+credit│ y MSI > 1)
    │           ▼                      │
    │       installments               │
    │           ├── installment_number │
    │           ├── due_date           │
    │           ├── amount             │
    │           └── is_paid / paid_at  │
    │                                  │
    └── push_subscriptions ────────────┘
          ├── endpoint
          ├── p256dh
          └── auth
```

### Reglas clave

- Un `movement` de tipo `expense` con `account_id` de una tarjeta de crédito genera automáticamente registros en `installments` (incluso si `installments = 1`, es decir, contado — el registro indica cuándo se paga ese cargo).
- Los `installments` se crean solo si la cuenta tiene `cut_day` y `days_to_due` configurados.
- Al editar un movimiento, se eliminan los installments no pagados y se recalculan. Los pagados se conservan.
- Al borrar un movimiento con cuotas pagadas, el movimiento se deja (para mantener el historial de cuotas pagadas) y solo se eliminan los installments pendientes.
- Al editar `cut_day` o `days_to_due` de una cuenta de crédito, todos los installments no pagados de los movimientos de esa tarjeta se recalculan automáticamente con los nuevos valores. Los ya pagados se preservan.
- El campo `installments` acepta cualquier valor entero ≥ 1, no solo los plazos típicos (3, 6, 12…). El formulario ofrece botones rápidos para los valores comunes y un input libre para plazos atípicos.
- El campo `is_recurring` en movements marca si un movimiento debe sugerirse cada mes.
- Los `budgets` son límites de gasto por categoría por mes (`YYYY-MM`). La restricción `UNIQUE (user_id, category_id, month)` garantiza un solo presupuesto por categoría por mes; el upsert actualiza si ya existe.
- Los movimientos de tipo `income` y `saving` requieren `account_id` (cuenta destino / cuenta origen respectivamente). El balance de cuentas débito/efectivo los contabiliza: ingresos suman, ahorros restan.
- Un `movement` de tipo `saving` puede tener `goal_id` apuntando a una meta activa. Al crear/editar/borrar ese movimiento, `goals.saved_amount` se ajusta automáticamente. Si no se asigna meta, el ahorro se registra como "ahorro general" sin afectar ninguna meta.
- RLS garantiza que cada query retorna únicamente filas donde `user_id = auth.uid()`.

---

## Cálculo de fechas MSI

El corazón de la app. Dado el día de compra, el día de corte de la tarjeta y los días al vencimiento:

1. **Primer corte:** si el día de compra es **estrictamente menor** que el día de corte del mismo mes, el corte aplica ese mismo mes; en cualquier otro caso (compra igual o posterior al corte) aplica el siguiente mes. Esto replica el comportamiento real de los bancos: una compra hecha el mismo día del corte ya entra al siguiente periodo.
2. **Primera fecha de vencimiento:** corte + días_al_vencimiento.
3. **Cuotas siguientes:** se suma 1 mes por cuota, preservando el día (si el mes de destino tiene menos días, se ajusta al último día del mes).
4. **Distribución del monto:** el importe total se divide entre N cuotas con redondeo a 2 decimales. Si hay centavos residuales por el redondeo, se suman a la primera cuota.

Ejemplo A: tarjeta con corte día 15, 20 días al vencimiento. Compra de $1,200 a 3 meses el 20 de mayo:
- El 20 ≥ 15 → primer corte: 15 de junio → vencimiento: 5 de julio
- Cuota 1: $400.00 — 5 de julio
- Cuota 2: $400.00 — 5 de agosto
- Cuota 3: $400.00 — 5 de septiembre

Ejemplo B: misma tarjeta, compra el 15 de mayo (día de corte):
- El 15 = 15 (no es menor) → primer corte: 15 de **julio** → vencimiento: 4 de agosto
- Cuota 1: $400.00 — 4 de agosto
- Cuota 2: $400.00 — 4 de septiembre
- Cuota 3: $400.00 — 4 de octubre

---

## Autenticación y sesión

El flujo es 100% OAuth con Google — no hay contraseñas:

1. Usuario hace click en "Continuar con Google"
2. Supabase redirige a Google con el Client ID configurado
3. Google redirige de vuelta a `/api/auth/callback` con un código
4. El callback intercambia el código por tokens, Supabase crea la sesión y guarda cookies httpOnly
5. El trigger `on_auth_user_created` crea automáticamente un `profile` y las categorías predefinidas del usuario
6. El middleware (`proxy.ts`) lee la sesión en cada request usando `@supabase/ssr`, que sincroniza las cookies entre el servidor y el cliente automáticamente

---

## Notificaciones push

El sistema usa el estándar Web Push con claves VAPID (Voluntary Application Server Identification):

1. **Suscripción:** el usuario activa las notificaciones desde el ícono de campana en el dashboard → el navegador solicita permiso → se genera un `PushSubscription` con `endpoint`, `p256dh` y `auth` → se guarda en la tabla `push_subscriptions` via POST a `/api/push/subscribe`
2. **Envío:** cada día a las 9AM hora México, Vercel Cron llama a `/api/cron/notify` con el header `Authorization: Bearer {CRON_SECRET}` → el endpoint busca installments con `due_date = hoy + 3 días` → agrupa por usuario → busca sus suscripciones → envía una notificación por usuario con `webpush.sendNotification()`
3. **Recepción:** el service worker (`/public/sw.js`) intercepta el evento `push` y muestra la notificación nativa del sistema operativo. Al hacer click, abre `/calendar`
4. **Limpieza:** si al enviar el push retorna código 410 o 404, significa que la suscripción expiró; se elimina automáticamente de la tabla

---

## Seguridad

- **RLS en todas las tablas:** ninguna query puede retornar datos de otro usuario, incluso si el token JWT es válido
- **Service role key solo en servidor:** el cron y las operaciones admin usan `SUPABASE_SERVICE_ROLE_KEY` que nunca se expone al cliente (no tiene prefijo `NEXT_PUBLIC_`)
- **CRON_SECRET:** el endpoint del cron valida el header `Authorization` para que nadie pueda dispararlo manualmente en producción
- **`REVOKE EXECUTE`** en funciones internas: `delete_unpaid_installments` y `handle_new_user` no son accesibles vía REST API por roles `anon` o `authenticated`
- **Cookies httpOnly:** la sesión de Supabase vive en cookies que JavaScript no puede leer

---

## Features adicionales

### Reportes y analítica (`/reports`)

Resumen de los últimos 12 meses. Incluye:

- **Tarjetas resumen:** ingresos, gastos, ahorros y neto totales del período.
- **Gráfica de barras Ingresos vs Gastos:** cada mes como grupo de dos barras (verde/rojo).
- **Gráfica de ahorro mensual:** barras del ahorro acumulado por mes.
- **Top categorías:** ranking de categorías por gasto total con barra de progreso proporcional y porcentaje.

Accesible desde el nav (ícono 📊) y desde el dashboard principal.

### Balance por cuenta (`/accounts`)

Las cuentas de **débito y efectivo** muestran su saldo actual calculado en tiempo real:

```
saldo = saldo_inicial + Σ ingresos − Σ gastos − Σ ahorros ± transferencias
```

Todos los movimientos de tipo `income`, `expense`, `saving` y `transfer` que tienen `account_id` apuntando a una cuenta débito/efectivo afectan su saldo. Al registrar un ingreso se pide "Cuenta destino"; al registrar un ahorro o gasto se pide "Cuenta".

El saldo inicial se configura al crear o editar la cuenta (campo "Saldo inicial"). Las tarjetas de crédito muestran en cambio una barra de utilización: deuda pendiente vs límite de crédito, con colores verde/amarillo/rojo según el porcentaje utilizado.

El dashboard también muestra una sección "Saldo por cuenta" con los saldos de débito/efectivo de un vistazo.

La columna `initial_balance NUMERIC DEFAULT 0` fue agregada a la tabla `accounts`.

### Metas de ahorro (`/goals`)

Módulo completo de seguimiento de metas de ahorro:

- **Crear meta:** nombre, ícono, color, monto objetivo, monto ya ahorrado, fecha objetivo y notas.
- **Progreso visual:** barra de progreso coloreada con el color de la meta, porcentaje y monto restante.
- **Completar / reactivar:** botón de check para marcar una meta como completada; las completadas se listan en una sección separada con opacidad reducida.
- **Dashboard:** muestra las 3 metas activas más recientes con su progreso.
- **Vinculación automática con movimientos:** al registrar un movimiento de tipo `saving`, el formulario muestra un selector opcional de meta activa. Si se selecciona, `goals.saved_amount` se incrementa al crear, se ajusta al editar (aplica la diferencia entre monto viejo y nuevo), y se decrementa al borrar el movimiento.

La tabla `goals` fue creada en Supabase con RLS (ver sección de migraciones manuales).

### Límites de gasto por categoría

Cada categoría puede tener un límite de gasto mensual. Se configura desde la página de **Categorías** pulsando el icono de cartera (💼) en cada fila. Tanto el dashboard como la página de categorías muestran una barra de progreso:

- Verde: < 80 % consumido
- Amarillo: 80–99 % consumido
- Rojo + aviso ⚠: presupuesto superado

En la página de **Categorías** se muestra el gasto real del mes actual debajo del nombre de cada categoría (ej. `$1,200 de $2,000`), con la barra de progreso alineada.

La tabla `budgets` guarda un registro por `(user_id, category_id, month)`. El upsert actualiza el valor si ya existía para ese mes.

### Movimientos recurrentes

Al crear o editar un movimiento (cualquier tipo excepto transferencia) se puede activar **"Repetir este movimiento cada mes"**. Los movimientos recurrentes muestran un badge **↻** en la lista.

Al abrir la pantalla de movimientos de cualquier mes, si existen movimientos recurrentes del mes anterior que aún no tienen un equivalente en el mes actual (comparación por descripción exacta, case-insensitive), aparece un banner al tope con cada sugerencia. Desde el banner el usuario puede:

- **Agregar** → abre el formulario pre-relleno con los datos del movimiento anterior. El nuevo movimiento también queda marcado como recurrente por defecto, por lo que se seguirá sugiriendo el mes siguiente.
- **Detener** → llama al servidor para poner `is_recurring = false` en el movimiento original. Desaparece del banner de forma inmediata (optimista) y ya no se sugiere en meses futuros.

### Búsqueda y filtros en movimientos

En la parte superior de la pantalla de movimientos hay:

- **Buscador de texto** — filtra por descripción (case-insensitive) con botón de limpiar.
- **Chips de tipo** — Todos / Gasto / Ingreso / Ahorro / Transferencia.
- **Selects de categoría y cuenta** — filtros independientes que se pueden combinar.

Todos los filtros son cliente y no generan requests extra al servidor. La barra de resumen (Ingresos / Gastos) refleja los totales del subconjunto filtrado. Cuando hay filtros activos se muestra el conteo "X de Y movimientos" y un botón **Limpiar filtros**.

---

## Estructura de carpetas relevante

```
src/
├── app/
│   ├── (auth)/login/          — Página de login pública
│   ├── (app)/                 — Rutas protegidas (requieren sesión)
│   │   ├── dashboard/         — Resumen mensual + gráficas + barras de presupuesto + saldos + metas
│   │   ├── movements/         — CRUD de movimientos, sugerencias recurrentes, búsqueda/filtros
│   │   ├── accounts/          — CRUD de cuentas + balance calculado por cuenta
│   │   ├── categories/        — CRUD de categorías + límites de gasto mensuales con progreso
│   │   ├── budgets/           — Server actions para upsert/delete de presupuestos
│   │   ├── calendar/          — Calendario de cuotas MSI
│   │   ├── reports/           — Analítica de 12 meses (ingresos, gastos, ahorro, top categorías)
│   │   ├── goals/             — Metas de ahorro con seguimiento de progreso
│   │   └── settings/          — Perfil y cerrar sesión
│   └── api/
│       ├── auth/callback/     — Intercambio OAuth
│       ├── push/subscribe/    — Gestión de suscripciones push
│       └── cron/notify/       — Envío diario de notificaciones
├── components/layout/         — BottomNav, PageHeader, SignOutButton, PushSubscription
├── lib/
│   ├── supabase/              — Clientes server y browser
│   ├── msi-calculator.ts      — Lógica de fechas MSI
│   ├── date-utils.ts          — Helpers de fechas
│   └── currency.ts            — Formateo MXN
├── types/app.types.ts         — Tipos compartidos
└── proxy.ts                   — Middleware de autenticación
public/
├── sw.js                      — Service worker (caché offline + push events)
└── manifest.json              — Configuración PWA
supabase/
└── schema.sql                 — Schema completo de la base de datos
vercel.json                    — Configuración del cron job
```

---

## Migraciones manuales en Supabase

Los siguientes cambios de esquema deben ejecutarse en el **SQL Editor** de Supabase en el orden indicado:

```sql
-- 1. Saldo inicial en cuentas de débito/efectivo
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS initial_balance NUMERIC NOT NULL DEFAULT 0;

-- 2. Tabla de metas de ahorro
CREATE TABLE IF NOT EXISTS goals (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name          TEXT        NOT NULL,
  icon          TEXT        NOT NULL DEFAULT '🎯',
  color         TEXT        NOT NULL DEFAULT '#6366f1',
  target_amount NUMERIC     NOT NULL,
  saved_amount  NUMERIC     NOT NULL DEFAULT 0,
  target_date   DATE,
  notes         TEXT,
  is_completed  BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_owner" ON goals
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Vínculo entre movimientos de ahorro y metas (ejecutar DESPUÉS de crear goals)
ALTER TABLE movements
  ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES goals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movements_goal_id ON movements(goal_id);
```

---

## Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública anon (expuesta al cliente) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada admin (solo servidor, bypasa RLS) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Clave pública VAPID para suscripciones push |
| `VAPID_PRIVATE_KEY` | Clave privada VAPID para firmar notificaciones |
| `VAPID_MAILTO` | Email de contacto requerido por el estándar VAPID |
| `CRON_SECRET` | Token secreto para autenticar el endpoint del cron |
