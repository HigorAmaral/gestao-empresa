function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/**
 * Calcula a cor de texto (#09090b ou #ffffff) com maior razão de contraste WCAG 2.1.
 */
function getContrastColor(hexColor?: string | null): string {
  if (!hexColor) return "#ffffff";
  const hex = hexColor.replace("#", "").trim();
  let r = 0;
  let g = 0;
  let b = 0;
  if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else {
    return "#ffffff";
  }

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return "#ffffff";

  const lum = relativeLuminance(r, g, b);
  const lumDark = relativeLuminance(9, 9, 11); // #09090b
  const lumWhite = 1; // #ffffff

  const contrastDark = (Math.max(lum, lumDark) + 0.05) / (Math.min(lum, lumDark) + 0.05);
  const contrastWhite = (Math.max(lum, lumWhite) + 0.05) / (Math.min(lum, lumWhite) + 0.05);

  return contrastDark > contrastWhite ? "#09090b" : "#ffffff";
}

export function DynamicThemeStyles({
  primaryColor,
  sidebarColor,
  accentColor,
}: {
  primaryColor?: string | null;
  sidebarColor?: string | null;
  accentColor?: string | null;
}) {
  const primary = primaryColor?.trim() || "#09090b";
  const sidebar = sidebarColor?.trim() || "#09090b";
  const accent = accentColor?.trim() || "#2563eb";
  const primaryFg = getContrastColor(primary);

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          :root {
            --primary: ${primary};
            --primary-dark: ${primary};
            --primary-fg: ${primaryFg};
            --border-strong: ${primary};
            --sidebar: ${sidebar};
            --accent: ${accent};
          }
          .btn:not(.secondary):not(.ghost):not(.danger):not(.warning) {
            background-color: var(--primary) !important;
            border-color: var(--primary) !important;
            color: var(--primary-fg) !important;
          }
          .sidebar {
            background-color: var(--sidebar) !important;
          }
          .mobile-topbar {
            background-color: var(--sidebar) !important;
          }
          .mobile-bottom-nav {
            background-color: var(--sidebar) !important;
          }
          .stat.primary {
            background-color: var(--primary) !important;
            border-color: var(--primary) !important;
            color: var(--primary-fg) !important;
          }
          .stat.primary .label,
          .stat.primary .hint,
          .stat.primary a {
            color: var(--primary-fg) !important;
          }
          .badge.green,
          .badge.purple {
            background-color: var(--primary) !important;
            border-color: var(--primary) !important;
            color: var(--primary-fg) !important;
          }
          .bars .bar.green,
          .bars .bar:not(.red) {
            background-color: var(--primary) !important;
          }
          input:focus,
          select:focus,
          textarea:focus {
            border-color: var(--primary) !important;
            box-shadow: 0 0 0 2px ${primary}26 !important;
          }
        `,
      }}
    />
  );
}
