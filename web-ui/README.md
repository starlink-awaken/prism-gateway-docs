# ReflectGuard Web UI

> Modern React-based dashboard for ReflectGuard (Phase 3 Week 2)

**Version:** 2.4.0
**Status:** 🚧 MVP Development
**Tech Stack:** React 18 + Vite 5 + TypeScript + Zustand + Tailwind CSS

---

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (with API proxy)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The dev server will start at `http://localhost:5173` with automatic proxy to backend API at `http://localhost:3000`.

---

## Architecture

### Project Structure

```
web-ui/
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── common/        # Base components (Card, Button, etc.)
│   │   └── Dashboard/     # Dashboard-specific components
│   ├── pages/             # Route pages
│   │   ├── Dashboard.tsx  # Main dashboard (✅ MVP complete)
│   │   ├── Analytics.tsx  # Analytics page (🚧 Phase 3 Week 3-4)
│   │   └── Settings.tsx   # Settings page (🚧 Phase 3 Week 3-4)
│   ├── stores/            # Zustand state management
│   │   └── analyticsStore.ts
│   ├── services/          # API and WebSocket clients
│   │   └── api.ts
│   ├── types/             # TypeScript type definitions
│   │   └── api.ts
│   ├── utils/             # Helper functions
│   │   └── formatters.ts
│   ├── App.tsx            # Root component with routing
│   ├── main.tsx           # React entry point
│   └── index.css          # Global styles + Tailwind
├── index.html             # HTML template
├── vite.config.ts         # Vite configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies and scripts
```

### Tech Stack Rationale

| Technology | Purpose | Reasoning |
|------------|---------|-----------|
| **React 18** | UI Framework | Mature ecosystem, excellent TypeScript support, team familiarity |
| **Vite 5** | Build Tool | Fast HMR (~50ms), ESM-native, simple configuration |
| **TypeScript 5.3+** | Type Safety | Matches backend, strict mode with `noUncheckedIndexedAccess` |
| **Zustand** | State Management | Lightweight (3KB), simple API, no boilerplate |
| **Tailwind CSS 3.4** | Styling | Utility-first, dark mode support, responsive design |
| **Chart.js 4** | Data Visualization | Canvas-based, performant, extensive chart types |
| **React Router 6** | Client-side Routing | Standard routing solution, type-safe |
| **Lucide React** | Icons | Modern icon set, tree-shakeable, 1000+ icons |

**Full evaluation:** See `reports/PHASE3_WEEK2_TECH_STACK_DECISION.md`

---

## Features (MVP)

### ✅ Completed (Week 2 MVP)

- **Dashboard Page**
  - 4 stat cards: Total Checks, Violations, Avg Check Time, Today Retros
  - 2 trend charts: Violation trend, Performance trend
  - Real-time event stream (WebSocket)
  - Period selector (Today, Week, Month, Year)
  - Loading and error states
  - Responsive design

- **Components**
  - `StatCard` - Metric display with trend indicators
  - `TrendChart` - Chart.js wrapper for line charts
  - `EventStream` - WebSocket-powered real-time events
  - `Card` - Base card component (shadcn/ui pattern)

- **Infrastructure**
  - API service layer with type-safe responses
  - Zustand store for analytics data
  - WebSocket connection management
  - Vite proxy for API and WebSocket
  - Dark mode support via CSS variables

### 🚧 Planned (Week 3-4)

- Analytics page with advanced charts
- Settings page with configuration options
- Authentication UI
- Export functionality
- Alert management
- More chart types (bar, pie, radar)

---

## API Integration

### REST API Endpoints

The UI consumes the following backend APIs (proxied via Vite):

```typescript
GET /api/v1/analytics/dashboard?period=week
  → Returns dashboard summary with metrics and trends

GET /api/v1/analytics/usage?period=month
  → Returns usage metrics

GET /api/v1/analytics/quality?period=year
  → Returns quality metrics

GET /api/v1/analytics/performance?period=today
  → Returns performance metrics
```

**API Documentation:** See `api/analytics-api.md`

### WebSocket Events

Real-time event stream connects to `ws://localhost:3000/ws`:

```json
{
  "type": "event",
  "eventType": "check" | "violation" | "retro" | "info",
  "message": "Gateway 检查完成",
  "timestamp": "2026-02-07T08:00:00.000Z",
  "id": "evt_12345"
}
```

---

## Development

### Scripts

```bash
npm run dev          # Start dev server (port 5173)
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Environment Variables

Create `.env.local` for custom configuration:

```env
# API base URL (default: http://localhost:3000 in dev)
VITE_API_BASE_URL=http://localhost:3000

# WebSocket URL (default: ws://localhost:3000/ws in dev)
VITE_WS_URL=ws://localhost:3000/ws
```

### TypeScript Configuration

Strict mode enabled with additional checks:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Code Style

- **React Components:** Function components with TypeScript
- **State Management:** Zustand hooks (`useAnalyticsStore`)
- **Styling:** Tailwind utility classes with `cn()` helper
- **File Naming:** PascalCase for components, camelCase for utilities
- **Import Order:** React → Libraries → Local components → Types → Styles

---

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| **First Contentful Paint (FCP)** | <1.0s | TBD |
| **Largest Contentful Paint (LCP)** | <2.5s | TBD |
| **Time to Interactive (TTI)** | <3.0s | TBD |
| **Bundle Size (gzipped)** | <200KB | TBD |
| **HMR Update** | <100ms | ~50ms ✅ |

---

## Browser Support

- **Chrome:** Latest 2 versions
- **Firefox:** Latest 2 versions
- **Safari:** Latest 2 versions
- **Edge:** Latest 2 versions

---

## Testing

### Unit Tests (Planned - Week 3)

```bash
npm run test         # Run unit tests with Vitest
npm run test:ui      # Open Vitest UI
npm run test:coverage # Generate coverage report
```

### E2E Tests (Planned - Week 4)

```bash
npm run e2e          # Run Playwright E2E tests
npm run e2e:ui       # Open Playwright UI
```

---

## Deployment

### Production Build

```bash
npm run build
# Output: dist/
```

### Static Hosting

The built files in `dist/` can be served by any static hosting service:

- **Nginx:** Serve `dist/` with fallback to `index.html`
- **Vercel/Netlify:** Auto-deploy from Git
- **S3 + CloudFront:** Upload `dist/` to S3 bucket

### Docker (Optional)

```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## Troubleshooting

### Issue: API requests fail with CORS errors

**Solution:** Ensure backend API is running at `http://localhost:3000` and CORS is enabled.

### Issue: WebSocket connection fails

**Solution:** Check that WebSocket server is running at `ws://localhost:3000/ws`. Verify no firewall blocking.

### Issue: Hot Module Replacement (HMR) not working

**Solution:** Restart dev server, clear browser cache, check Vite version.

### Issue: Tailwind styles not applying

**Solution:** Verify `tailwind.config.js` includes all content paths. Restart dev server.

---

## Related Documentation

- **Technology Decision:** `reports/PHASE3_WEEK2_TECH_STACK_DECISION.md`
- **API Documentation:** `api/analytics-api.md`
- **Phase 3 Plan:** `reports/PHASE3_ITERATION_PLAN.md`
- **Main Project:** `reflectguard/README.md`

---

## Contributors

- **Phase 3 Week 2 Lead:** AI Assistant with Claude Sonnet 4.5
- **Project Owner:** ReflectGuard Team

## License

MIT License - See `LICENSE` file in root directory.

---

**Last Updated:** 2026-02-07
**Status:** MVP Scaffolding Complete ✅ | Dashboard Core Components In Progress 🚧
