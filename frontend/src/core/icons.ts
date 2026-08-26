/** Minimal inline-SVG icon set (24x24 viewBox, stroke-based, currentColor). */

function icon(inner: string, size = 18): HTMLElement {
  const span = document.createElement("span");
  span.className = "icon";
  span.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  return span;
}

export const icons = {
  building: (size?: number) =>
    icon(
      `<rect x="4" y="3" width="16" height="18" rx="1"/><line x1="8" y1="7" x2="8" y2="7.01"/><line x1="12" y1="7" x2="12" y2="7.01"/><line x1="16" y1="7" x2="16" y2="7.01"/><line x1="8" y1="11" x2="8" y2="11.01"/><line x1="12" y1="11" x2="12" y2="11.01"/><line x1="16" y1="11" x2="16" y2="11.01"/><line x1="9" y1="21" x2="9" y2="16"/><line x1="15" y1="21" x2="15" y2="16"/>`,
      size,
    ),
  search: (size?: number) =>
    icon(`<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`, size),
  bell: (size?: number) =>
    icon(
      `<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>`,
      size,
    ),
  moon: (size?: number) => icon(`<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`, size),
  sun: (size?: number) =>
    icon(
      `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`,
      size,
    ),
  monitor: (size?: number) =>
    icon(
      `<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>`,
      size,
    ),
  user: (size?: number) =>
    icon(`<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>`, size),
  grid: (size?: number) =>
    icon(
      `<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>`,
      size,
    ),
  folder: (size?: number) =>
    icon(`<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"/>`, size),
  eye: (size?: number) =>
    icon(
      `<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>`,
      size,
    ),
  repeat: (size?: number) =>
    icon(
      `<path d="M21 12a9 9 0 1 1-3.5-7.1"/><polyline points="21 3 21 9 15 9"/>`,
      size,
    ),
  layers: (size?: number) =>
    icon(
      `<polygon points="12 3 21 8 12 13 3 8"/><polyline points="3 12 12 17 21 12"/><polyline points="3 16 12 21 21 16"/>`,
      size,
    ),
  timer: (size?: number) =>
    icon(
      `<circle cx="12" cy="13" r="8"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="9" y1="3" x2="15" y2="3"/>`,
      size,
    ),
  settings: (size?: number) =>
    icon(
      `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
      size,
    ),
  logout: (size?: number) =>
    icon(
      `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>`,
      size,
    ),
  key: (size?: number) =>
    icon(
      `<circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3"/>`,
      size,
    ),
  chevronDown: (size?: number) => icon(`<polyline points="6 9 12 15 18 9"/>`, size),
  chevronsUpDown: (size?: number) =>
    icon(`<polyline points="7 10 12 5 17 10"/><polyline points="7 14 12 19 17 14"/>`, size),
  plus: (size?: number) => icon(`<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`, size),
  calendar: (size?: number) =>
    icon(
      `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
      size,
    ),
  link: (size?: number) =>
    icon(
      `<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1"/>`,
      size,
    ),
  chevronLeft: (size?: number) => icon(`<polyline points="15 18 9 12 15 6"/>`, size),
  x: (size?: number) => icon(`<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`, size),
  play: (size?: number) => icon(`<polygon points="6 3 20 12 6 21 6 3"/>`, size),
  rotate: (size?: number) =>
    icon(
      `<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>`,
      size,
    ),
  checklist: (size?: number) =>
    icon(
      `<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6l1 1 2-2"/><path d="M4 12l1 1 2-2"/><path d="M4 18l1 1 2-2"/>`,
      size,
    ),
  lightbulb: (size?: number) =>
    icon(
      `<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>`,
      size,
    ),
};
