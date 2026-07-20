export default function Bar({ label, value, max, color = "#4a9eff", right, onClick, title }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className={"br" + (onClick ? " clickable" : "")} onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      <div className="bl" title={title || label}>{label}</div>
      <div className="bt">
        <div className="bf" style={{ width: pct + "%", background: color }} />
      </div>
      <div className="bc">{right ?? value.toLocaleString()}</div>
    </div>
  );
}
