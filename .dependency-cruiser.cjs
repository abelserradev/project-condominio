/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'auth-no-buildings-imports',
      comment: 'ADR-001: auth usa building-lookup, no el módulo buildings.',
      severity: 'error',
      from: { path: '^src/auth/' },
      to: { path: '^src/buildings/' },
    },
    {
      name: 'buildings-no-common-module',
      comment: 'Phase 3: BuildingsModule no importa CommonModule (TenantGuardsModule).',
      severity: 'error',
      from: { path: '^src/buildings/' },
      to: { path: '^src/common/common\\.module' },
    },
    {
      name: 'common-no-buildings-module',
      comment: 'Phase 3: CommonModule no importa BuildingsModule.',
      severity: 'error',
      from: { path: '^src/common/' },
      to: { path: '^src/buildings/buildings\\.module' },
    },
    {
      name: 'auth-no-owners-imports',
      comment: 'Phase 2b: auth usa owners-login, no el módulo owners.',
      severity: 'error',
      from: { path: '^src/auth/' },
      to: { path: '^src/owners/' },
    },
    {
      name: 'utils-no-service',
      comment:
        'Utils bajo src/**/utils/ no deben importar servicios Nest (ADR-002 / arch Phase 1).',
      severity: 'error',
      from: {
        path: '^src/.+/utils/',
      },
      to: {
        path: '\\.service\\.ts$',
      },
    },
    {
      name: 'no-circular',
      comment:
        'Ciclos de import; baseline Phase 1 permite 1 SCC (auth/buildings) hasta ADR-001.',
      severity: 'warn',
      from: {},
      to: {
        circular: true,
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
