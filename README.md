# GYM BROS · App (web instalable + celular)

App del gimnasio GYM BROS, estilo SmartFit. **Todo corre en Cloudflare**:

| Parte | Dónde vive |
|---|---|
| App web instalable (PWA) | Cloudflare Workers (archivos estáticos) |
| Servidor / API | Cloudflare Workers (`worker/index.ts`) |
| Base de datos | Cloudflare D1 |
| Dominio | Cloudflare (tu dominio) |

No necesitas Supabase, Railway ni un computador prendido. El mismo código sirve después para la app de Play Store / App Store (Expo).

---

## Qué trae

**Socios**
- Registro e ingreso. La cuenta queda *pendiente* hasta que un admin la activa.
- **Inicio:** plan, aviso cuando el plan vence en 7 días o menos, **aforo en vivo** ("ahora hay 23 personas"), días entrenados y racha, y próxima clase.
- **QR de entrada firmado** que cambia cada 30 s (una captura no sirve).
- **Celebración** a pantalla completa cuando recepción escanea tu QR, con racha y visitas del mes.
- **Clases:** reservar y cancelar, con cupos.
- **Rutina:** la que asigna el admin.
- **Progreso:** anotas peso y repeticiones de cada serie, ves tus **récords** (con aviso de nuevo récord) y un gráfico por ejercicio.
- **Perfil:** plan, vencimiento, estadísticas y datos.

**Administradores** (misma app, otro menú)
- **Hoy:** gente en el gym ahora, entradas del día, socios activos, nuevos del mes, **ventas del mes en pesos**, lista de **por vencer** y últimas entradas. Se actualiza solo.
- **Planes y ajustes:** planes con precio en CLP y duración (mensual, trimestral, etc.) y aforo máximo.
- **Socios:** filtros (pendientes, por vencer, activos, inactivos, admins) y buscador.
- **Detalle del socio:** activar o renovar eligiendo un plan (queda registrada la venta), historial de pagos y visitas, entrada manual, cambiar clave, asignar rutina, desactivar y convertir en admin.
- **Escanear QR** con la cámara y **Clases** (crear y eliminar).

**Cómo se crean los usuarios**
1. Los **2 administradores base** se crean una sola vez en la página `/setup`.
2. Los **socios** se registran solos (quedan pendientes) **o** el admin los crea ya activos.
3. Un admin puede convertir a cualquier socio en admin.

---

## Publicar en Cloudflare (todo desde el navegador)

Se recomienda hacerlo desde un computador (con el celular es incómodo subir archivos).

### 1. Subir el código a GitHub
1. En [github.com](https://github.com) → **New repository** → nombre `gymbros-app` → **Create**.
2. Toca **uploading an existing file**, arrastra **todo el contenido** de la carpeta `gymbros-app` (no la carpeta, lo que hay dentro) y presiona **Commit changes**.

### 2. Crear la base de datos D1
1. Entra a [dash.cloudflare.com](https://dash.cloudflare.com) (crea la cuenta si no tienes).
2. **Storage & Databases → D1 → Create database** → nombre `gymbros-db` → **Create**.
3. Copia el **Database ID**.
4. En GitHub abre `wrangler.jsonc`, toca el lápiz ✏️, reemplaza `PEGA-AQUI-EL-ID-DE-TU-BASE-D1` por tu ID y presiona **Commit changes**.

Las tablas se crean solas la primera vez que se usa la app.

### 3. Conectar GitHub con Cloudflare
1. **Workers & Pages → Create → Import a repository** → conecta tu GitHub y elige `gymbros-app`.
2. Configura:
   - **Build command:** `npm run build:web`
   - **Deploy command:** `npx wrangler deploy`
3. **Deploy**. La primera vez tarda unos minutos. Cada vez que cambies algo en GitHub, Cloudflare vuelve a publicar solo.

### 4. Agregar las claves secretas
En tu Worker `gymbros` → **Settings → Variables and Secrets → Add**, tipo **Secret**:

| Nombre | Valor |
|---|---|
| `JWT_SECRET` | Una frase larga y secreta inventada por ti (mínimo 16 caracteres, ideal 40). Si la cambias, todos deben ingresar de nuevo. |
| `SETUP_KEY` | Una clave para la página de configuración (la usas solo una vez). |

Guarda (**Deploy**).

### 5. Crear los 2 administradores
1. Abre `https://gymbros.TU-USUARIO.workers.dev/setup` (la dirección exacta aparece en tu Worker).
2. Escribe la `SETUP_KEY` y los datos de los dos administradores → **Crear administradores**.
3. **Importante:** vuelve a **Variables and Secrets** y **borra `SETUP_KEY`**. Así la página queda cerrada.

### 6. Tu dominio
- Si tu dominio es **.cl**, se compra en [NIC Chile](https://www.nic.cl). Después, en Cloudflare: **Add a domain**, y en NIC Chile cambias los *servidores DNS* por los que te da Cloudflare.
- Luego en tu Worker: **Settings → Domains & Routes → Add → Custom domain** → `gymbros.cl` (o `app.gymbros.cl`).

### 7. Instalar la app en el celular
- **Android (Chrome):** abre tu dominio → menú ⋮ → **Instalar app** / *Agregar a pantalla de inicio*.
- **iPhone (Safari):** abre tu dominio → botón **Compartir** → **Agregar a inicio**.

Queda con el ícono de GYM BROS y se abre a pantalla completa, como una app.

---

## Después: app en Play Store / App Store
1. Crea el archivo `.env` con `EXPO_PUBLIC_API_URL=https://tu-dominio.cl`.
2. Con una cuenta en [expo.dev](https://expo.dev): `npm install`, `npx expo install expo@latest`, `npx expo install --fix` y `npx eas build --platform android` (o `ios`). Expo compila en su nube.
3. Necesitas cuenta de desarrollador: Google Play (pago único) y Apple (pago anual).

---

## Para quien programe

```
App.tsx · src/                App Expo / React Native (web + nativa)
  lib/api.ts                  Cliente de la API y tipos
  context/AuthContext.tsx     Sesión
  screens/auth|member|admin   Pantallas
worker/index.ts               API en Cloudflare Workers + D1 (sin dependencias)
public/                       index.html, manifest.json, sw.js e íconos de la PWA
tests/worker.test.mts         Prueba de punta a punta del servidor
wrangler.jsonc                Configuración de Cloudflare
```

- **Seguridad:** claves con PBKDF2-SHA256 (100.000 iteraciones), sesión con token HS256 de 30 días, QR firmado con HMAC y válido 90 s, permisos de admin revisados en el servidor en cada pedido.
- **Probar el servidor:** `npm run test:server` (Node 22+, usa SQLite en memoria).
- **Desarrollo local:** `npm install`, `npm run build:web`, crear `.dev.vars` con `JWT_SECRET=...` y `SETUP_KEY=...`, y `npx wrangler dev`.
- **Colores:** `src/theme.ts` (`accent: #E8915A`). Diseño en Claude Design.

## Pendiente para próximas versiones
- Pagos en línea (Webpay / Mercado Pago).
- Recuperar clave por correo (hoy la cambia el admin).
- Varias sedes, notificaciones y ranking.
