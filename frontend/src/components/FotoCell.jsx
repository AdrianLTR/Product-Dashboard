// Celda de "Foto descriptiva SL". Si el valor es una URL, muestra una
// miniatura clickeable (carga diferida); si es texto, lo muestra; si esta
// vacio, marca en rojo que falta.
export default function FotoCell({ value }) {
  const v = (value || "").trim();
  if (!v) return <span className="diff-rem">— sin foto</span>;

  const isUrl = /^https?:\/\//i.test(v);
  if (isUrl) {
    return (
      <a href={v} target="_blank" rel="noopener noreferrer" title={v}>
        <img
          src={v}
          alt="foto"
          loading="lazy"
          style={{ height: 32, width: 32, objectFit: "cover", borderRadius: 4, border: "1px solid var(--b2)", display: "block" }}
          onError={(e) => { e.currentTarget.replaceWith(document.createTextNode("ver ↗")); }}
        />
      </a>
    );
  }
  return <span title={v}>{v.length > 30 ? v.slice(0, 30) + "…" : v}</span>;
}
