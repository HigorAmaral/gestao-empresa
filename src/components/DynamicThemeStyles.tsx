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
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? "#09090b" : "#ffffff";
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
