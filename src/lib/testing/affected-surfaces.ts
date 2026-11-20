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
  '/about',
  '/submit',
  '/faq',
  '/contact',
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

interface ComponentRouteMapping {
  pattern: RegExp;
  routes: string[];
  selectors: string[];
}

const COMPONENT_MAPPINGS: ComponentRouteMapping[] = [
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
    pattern: /^src\/app\/dmca\/page\.tsx$/,
    routes: ['/dmca'],
    selectors: ['main'],
  },
];

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
    for (const mapping of COMPONENT_MAPPINGS) {
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
    allRoutes: false,
  };
}
