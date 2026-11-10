export default function Loading() {
  return (
    <div style={{ padding: "8px 0" }}>
      <div
        style={{
          height: 28,
          width: 220,
          borderRadius: 6,
          background: "var(--surface-subtle)",
          marginBottom: 8,
          animation: "pulse 1.2s ease-in-out infinite",
        }}
      />
      <div
        style={{
          height: 16,
          width: 320,
          borderRadius: 6,
          background: "var(--surface-subtle)",
          marginBottom: 24,
        }}
      />
      <div
        className="card"
        style={{
          minHeight: 260,
          display: "grid",
          placeItems: "center",
          color: "var(--muted)",
          fontSize: 13,
        }}
      >
        Carregando...
      </div>
    </div>
  );
}
