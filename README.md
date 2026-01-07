# 🕵️ Topo Party Game (Impostor)

Un juego de fiesta multijugador para descubrir al impostor. Perfecto para reuniones con amigos y familia.

![Topo Party Game](https://impostor.carlesgregori.com/pwa-512x512.png)

## 🎮 ¿Cómo se juega?

1. **Crea una partida** seleccionando el número de jugadores y topos
2. **Pasa el móvil** a cada jugador para que vea su carta en secreto
3. **Los jugadores normales** ven la palabra secreta
4. **El topo** solo ve una pista, ¡no sabe cuál es la palabra!
5. **Todos dan pistas** sobre la palabra por turnos
6. **Descubre al topo** votando quién crees que es el impostor

## 🌐 Demo en Producción

**URL**: [https://impostor.carlesgregori.com](https://impostor.carlesgregori.com)

## ✨ Características

- 📱 **PWA (Progressive Web App)** - Instalable en móviles como app nativa
- 🔌 **Modo Offline-First** - Juega sin conexión a internet
- 🎲 **Variantes de juego**:
  - Clásico (1 o más topos)
  - Doble topo (uno engañado)
  - Adivina al jugador
- 🏷️ **Categorías**: General, Benicolet, Picantes
- 👤 **Juego local** - Pasa el móvil entre jugadores
- 🔄 **Sincronización automática** de palabras para modo offline
- 🎨 **Interfaz moderna** con modo oscuro

## 🛠️ Stack Tecnológico

| Tecnología | Uso |
|------------|-----|
| **React 18** | Framework UI |
| **TypeScript** | Tipado estático |
| **Vite** | Bundler y dev server |
| **Tailwind CSS** | Estilos utility-first |
| **shadcn/ui** | Componentes UI |
| **Supabase** | Backend (Auth, DB, Realtime) |
| **PWA (vite-plugin-pwa)** | App instalable + offline |

## 📁 Estructura del Proyecto

```
impostor/
├── src/
│   ├── components/      # Componentes React reutilizables
│   │   ├── game/        # Componentes del juego (CardReveal, PackSelector...)
│   │   ├── layout/      # Layout y navegación
│   │   ├── ui/          # Componentes shadcn/ui
│   │   └── words/       # Gestión de palabras
│   ├── hooks/           # Custom hooks
│   │   ├── useGameSession.ts    # Lógica principal del juego
│   │   ├── useOfflineCards.ts   # Sincronización offline
│   │   └── useSavedRooms.ts     # Partidas guardadas
│   ├── integrations/    # Integraciones externas
│   │   └── supabase/    # Cliente y tipos de Supabase
│   ├── pages/           # Páginas de la app
│   │   ├── Index.tsx           # Página principal
│   │   ├── NewGamePage.tsx     # Crear partida
│   │   ├── GamePage.tsx        # Juego activo
│   │   ├── AdminPage.tsx       # Panel de administración
│   │   └── AdminWordsPage.tsx  # Gestión de palabras
│   ├── types/           # Definiciones TypeScript
│   └── lib/             # Utilidades
├── supabase/
│   └── migrations/      # Migraciones SQL de la base de datos
├── public/              # Assets estáticos y PWA
└── dist/                # Build de producción
```

## 🚀 Desarrollo Local

### Requisitos previos

- Node.js 18+ 
- npm o bun

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/CarlesGdigital/impostor.git
cd impostor

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase

# Iniciar servidor de desarrollo
npm run dev
```

### Variables de entorno

Crea un archivo `.env` con:

```env
VITE_SUPABASE_URL="https://tu-proyecto.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="tu-anon-key"
```

### Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (http://localhost:8080) |
| `npm run build` | Build de producción |
| `npm run preview` | Preview del build |
| `npm run lint` | Linter ESLint |

## 🌍 Despliegue en Producción

### Opción 1: Docker (Servidor propio)

El proyecto incluye configuración para Docker Compose:

```bash
# Build de producción
npm run build

# Subir archivos al servidor
scp -r dist/* usuario@servidor:/opt/impostor/web/dist/

# En el servidor, reiniciar contenedor
docker compose restart web
```

**Estructura del servidor:**

```yaml
# docker-compose.yml
services:
  web:
    image: nginx:alpine
    volumes:
      - ./web/dist:/usr/share/nginx/html:ro
      - ./web/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "127.0.0.1:8088:80"
```

### Opción 2: Vercel/Netlify

1. Conecta tu repositorio de GitHub
2. Configura las variables de entorno de Supabase
3. Deploy automático en cada push

### Configuración del Proxy Reverso (Caddy)

```caddyfile
impostor.carlesgregori.com {
    encode gzip
    reverse_proxy impostor_web:80
}
```

### Configuración DNS

Añade un registro A apuntando al IP de tu servidor:

| Tipo | Nombre | Valor |
|------|--------|-------|
| A | impostor | TU_IP_SERVIDOR |

## 📱 Convertir a App Android (Capacitor)

```bash
# Instalar Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# Inicializar
npx cap init "Topo Party" "com.carlesgregori.impostor"

# Añadir Android
npm run build
npx cap add android

# Abrir en Android Studio
npx cap open android
```

## 🗄️ Base de Datos (Supabase)

### Tablas principales

- **packs** - Categorías de palabras (General, Benicolet, Picantes)
- **cards** - Palabras con sus pistas
- **game_sessions** - Partidas activas
- **session_players** - Jugadores en cada partida

### Migraciones

Las migraciones SQL están en `supabase/migrations/`. Para aplicar:

```bash
supabase db push
```

## 🤝 Contribuir

1. Fork del repositorio
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit de cambios (`git commit -m 'Añade nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

MIT © Carles Gregori

## 🙏 Créditos

- Desarrollado por [Carles Gregori](https://carlesgregori.com)
- UI Components: [shadcn/ui](https://ui.shadcn.com/)
- Backend: [Supabase](https://supabase.com/)
- Icons: [Lucide](https://lucide.dev/)
