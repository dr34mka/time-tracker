declare const __DESIGN_PREVIEW__: boolean;

export const DESIGN_PREVIEW = typeof __DESIGN_PREVIEW__ !== 'undefined' && __DESIGN_PREVIEW__;
export const STORAGE_KEY = DESIGN_PREVIEW ? 'time-tracker-design-preview-v1' : 'time-tracker-v1';
export const SIDEBAR_KEY = DESIGN_PREVIEW ? 'time-tracker-design-preview-sidebar' : 'time-tracker-sidebar-open';
