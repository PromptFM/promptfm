export interface AffectedSurfaceResult {
  routes: string[];
  selectors: string[];
  allRoutes: boolean;
}

const ALL_PUBLIC_ROUTES = [
  '/',
  '/top',
  '/library',
  '/status',
  '/channels',
  '/schedule',
  '/about',
  '/submit',
  '/faq',
  '/contact',
  '/privacy',
  '/terms',
  '/copyright',
  '/dmca',
];

const DEFAULT_CORE_ROUTES = ['/', '/top', '/library', '/status'];

const GLOBAL_THEME_TRIGGERS: RegExp[] = [
  /^src\/app\/globals\.css$/,
  /^src\/app\/layout\.tsx$/,
  /^src\/components\/Navbar\.tsx$/,
  /^src\/components\/ThemeToggle\.tsx$/,
  /^src\/lib\/theme\/.*\.ts$/,
  /^tailwind\.config\.(ts|js|mjs)$/,
];

export interface ComponentRouteMapping {
  pattern: RegExp;
  routes: string[];
  selectors: string[];
}

export function getComponentMappings(): ComponentRouteMapping[] {
  return [
    {
      pattern: /^src\/components\/FundingSection\.tsx$/,
    routes: ['/'],
    selectors: ['#funding'],
  },
  {
    pattern: /^src\/components\/ContributeSection\.tsx$/,
    routes: ['/'],
    selectors: ['#contribute'],
  },
  {
    pattern: /^src\/components\/ScheduleView\.tsx$/,
    routes: ['/', '/status'],
    selectors: ['#schedule'],
  },
  {
    pattern: /^src\/components\/ChannelsGrid\.tsx$/,
    routes: ['/'],
    selectors: ['#channels'],
  },
  {
    pattern: /^src\/components\/CommunitySection\.tsx$/,
    routes: ['/'],
    selectors: ['#community'],
  },
  {
    pattern: /^src\/components\/Footer\.tsx$/,
    routes: ALL_PUBLIC_ROUTES,
    selectors: ['footer'],
  },
  {
    pattern: /^src\/components\/CookieConsentBanner\.tsx$/,
    routes: ALL_PUBLIC_ROUTES,
    selectors: ['[role="region"][aria-label*="Cookie"]'],
  },
  {
    pattern: /^src\/components\/AudioPlayer\.tsx$/,
    routes: ['/', '/top', '/library', '/status'],
    selectors: ['[aria-label="Live radio player"]'],
  },
  {
    pattern: /^src\/components\/UpNextSection\.tsx$/,
    routes: ['/'],
    selectors: ['#up-next'],
  },
  {
    pattern: /^src\/app\/page\.tsx$/,
    routes: ['/'],
    selectors: ['main'],
  },
  {
    pattern: /^src\/app\/channels\/page\.tsx$/,
    routes: ['/channels'],
    selectors: ['main'],
  },
  {
    pattern: /^src\/app\/schedule\/page\.tsx$/,
    routes: ['/schedule'],
    selectors: ['main'],
  },
  {
    pattern: /^src\/app\/top\/page\.tsx$/,
    routes: ['/top'],
    selectors: ['main'],
  },
  {
    pattern: /^src\/app\/library\/page\.tsx$/,
    routes: ['/library'],
    selectors: ['main'],
  },
  {
    pattern: /^src\/app\/status\/page\.tsx$/,
    routes: ['/status'],
    selectors: ['main'],
  },
  {
    pattern: /^src\/app\/about\/page\.tsx$/,
    routes: ['/about'],
    selectors: ['main'],
  },
  {
    pattern: /^src\/app\/submit\/page\.tsx$/,
    routes: ['/submit'],
    selectors: ['main'],
  },
  {
    pattern: /^src\/app\/faq\/page\.tsx$/,
    routes: ['/faq'],
    selectors: ['main'],
  },
  {
    pattern: /^src\/app\/contact\/page\.tsx$/,
    routes: ['/contact'],
    selectors: ['main'],
  },
  {
    pattern: /^src\/app\/privacy\/page\.tsx$/,
    routes: ['/privacy'],
    selectors: ['main'],
  },
  {
    pattern: /^src\/app\/terms\/page\.tsx$/,
    routes: ['/terms'],
    selectors: ['main'],
  },
  {
    pattern: /^src\/app\/copyright\/page\.tsx$/,
    routes: ['/copyright'],
    selectors: ['main'],
  },
  {
    pattern: /^src\/app\/dmca\/page\.tsx$/,
    routes: ['/dmca'],
    selectors: ['main'],
  },
];
}

/**
 * Resolves the list of routes and component selectors affected by changed files.
 * Used by E2E and CI accessibility checks (Issue #241).
 */
export function resolveAffectedSurfaces(changedFiles: string[]): AffectedSurfaceResult {
  if (changedFiles.length === 0) {
    return {
      routes: DEFAULT_CORE_ROUTES,
      selectors: [],
      allRoutes: false,
    };
  }

  const isGlobal = changedFiles.some((file) =>
    GLOBAL_THEME_TRIGGERS.some((pattern) => pattern.test(file))
  );

  if (isGlobal) {
    return {
      routes: ALL_PUBLIC_ROUTES,
      selectors: ['nav', 'main', 'footer'],
      allRoutes: true,
    };
  }

  const routesSet = new Set<string>();
  const selectorsSet = new Set<string>();

  for (const file of changedFiles) {
    for (const mapping of getComponentMappings()) {
      if (mapping.pattern.test(file)) {
        for (const route of mapping.routes) {
          routesSet.add(route);
        }
        for (const selector of mapping.selectors) {
          selectorsSet.add(selector);
        }
      }
    }
  }

  return {
    routes: Array.from(routesSet),
    selectors: Array.from(selectorsSet),
    allRoutes: routesSet.size >= ALL_PUBLIC_ROUTES.length,
  };
}
