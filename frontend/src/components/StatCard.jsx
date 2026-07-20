export default function StatCard({ label, value, sub, colorClass = "cw", onClick, active = false, title }) {
  const classes = ["sc"];
  if (onClick) classes.push("clickable");
  if (active) classes.push("active");
  return (
    <div
      className={classes.join(" ")}
      onClick={onClick}
      title={title || (onClick ? (active ? "Clic para quitar filtro" : "Clic para filtrar la tabla") : undefined)}
    >
      <div className="sc-l">{label}</div>
      <div className={"sc-v " + colorClass}>{value}</div>
      {sub ? <div className="sc-s">{sub}</div> : null}
    </div>
  );
}
