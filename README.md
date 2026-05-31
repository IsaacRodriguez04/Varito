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
    ├── movements ─────────────────────┤
    │     ├── type: expense/income/    │
    │     │         saving/transfer    │
    │     ├── category_id → categories │
    │     ├── account_id → accounts    │
    │     ├── destination_account_id   │  (solo en transfers)
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

- Un `movement` de tipo `expense` con `account_id` de una tarjeta de crédito y `installments > 1` genera automáticamente N registros en `installments`.
- Los `installments` se crean solo si la cuenta tiene `cut_day` y `days_to_due` configurados.
- Al editar un movimiento, se eliminan los installments no pagados y se recalculan. Los pagados se conservan.
- Al borrar un movimiento con cuotas pagadas, el movimiento se deja (para mantener el historial de cuotas pagadas) y solo se eliminan los installments pendientes.
- RLS garantiza que cada query retorna únicamente filas donde `user_id = auth.uid()`.

---

## Cálculo de fechas MSI

El corazón de la app. Dado el día de compra, el día de corte de la tarjeta y los días al vencimiento:

1. **Primer corte:** si el día de compra es ≤ día de corte del mismo mes, el corte aplica ese mismo mes; si no, aplica el siguiente mes.
2. **Primera fecha de vencimiento:** corte + días_al_vencimiento.
3. **Cuotas siguientes:** se suma 1 mes por cuota, preservando el día (si el mes de destino tiene menos días, se ajusta al último día del mes).
4. **Distribución del monto:** el importe total se divide entre N cuotas con redondeo a 2 decimales. Si hay centavos residuales por el redondeo, se suman a la primera cuota.

Ejemplo: tarjeta con corte día 15, 20 días al vencimiento. Compra de $1,200 a 3 meses el 20 de mayo:
- El 20 > 15 → primer corte: 15 de junio → vencimiento: 5 de julio
- Cuota 1: $400.00 — 5 de julio
- Cuota 2: $400.00 — 5 de agosto
- Cuota 3: $400.00 — 5 de septiembre

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

## Estructura de carpetas relevante

```
src/
├── app/
│   ├── (auth)/login/          — Página de login pública
│   ├── (app)/                 — Rutas protegidas (requieren sesión)
│   │   ├── dashboard/         — Resumen mensual + gráficas
│   │   ├── movements/         — CRUD de movimientos
│   │   ├── accounts/          — CRUD de cuentas
│   │   ├── categories/        — CRUD de categorías
│   │   ├── calendar/          — Calendario de cuotas MSI
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
