export default function StatCard({ label, value, sub, colorClass = "cw", onClick }) {
  return (
    <div className={"sc" + (onClick ? " clickable" : "")} onClick={onClick} title={onClick ? "Ver detalle" : undefined}>
      <div className="sc-l">{label}</div>
      <div className={"sc-v " + colorClass}>{value}</div>
      {sub ? <div className="sc-s">{sub}</div> : null}
    </div>
  );
}
