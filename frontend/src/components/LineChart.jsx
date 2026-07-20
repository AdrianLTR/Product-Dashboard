// Grafica de linea simple en SVG, sin dependencias.
// series: [{ name, color, values: number[] }] — todas del mismo largo que labels.
export default function LineChart({ series, labels, max: maxProp, height = 220, unit = "" }) {
  const W = 640;
  const H = height;
  const PAD_X = 40;
  const PAD_Y = 24;
  const n = labels.length;
  const max = maxProp ?? Math.max(1, ...series.flatMap((s) => s.values));

  const x = (i) => (n <= 1 ? W / 2 : PAD_X + (i * (W - 2 * PAD_X)) / (n - 1));
  const y = (v) => H - PAD_Y - (Math.min(v, max) / max) * (H - 2 * PAD_Y);

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    y: y(max * f),
    label: Math.round(max * f).toLocaleString(),
  }));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {gridLines.map((g) => (
          <g key={g.y}>
            <line x1={PAD_X} y1={g.y} x2={W - PAD_X} y2={g.y} stroke="var(--b2)" strokeWidth="1" />
            <text x={PAD_X - 6} y={g.y + 3} textAnchor="end" fontSize="9" fill="var(--tx3)" fontFamily="var(--mono)">
              {g.label}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <g key={s.name}>
            <polyline
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
            />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill={s.color}>
                <title>{`${labels[i]} · ${s.name}: ${v.toLocaleString()}${unit}`}</title>
              </circle>
            ))}
          </g>
        ))}
        {labels.map((lbl, i) => {
          // con muchas cargas, mostrar solo algunas etiquetas para no encimar
          const step = Math.ceil(n / 8);
          if (i % step !== 0 && i !== n - 1) return null;
          return (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--tx3)" fontFamily="var(--mono)">
              {lbl}
            </text>
          );
        })}
      </svg>
      <div className="fb" style={{ marginTop: 6 }}>
        {series.map((s) => (
          <span key={s.name} style={{ fontSize: 11, color: "var(--tx2)", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 3, background: s.color, display: "inline-block", borderRadius: 2 }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
