// TypeScript-facing barrel for './callkeep.service' imports. Metro and jest
// resolve the platform-specific files (callkeep.service.ios.ts /
// callkeep.service.android.ts / callkeep.service.web.ts) BEFORE this file, so
// at runtime this module is shadowed and never bundled. It exists so tsc can
// type-check those imports. It re-exports the web implementation because it
// has no native dependencies.

export type { CallKeepConfig } from './callkeep.service.web';
export { CallKeepService, callKeepService } from './callkeep.service.web';
