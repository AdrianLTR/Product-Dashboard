import { useEffect, useState } from "react";
import { api } from "../api";

// Sobre este tamano el listado se sube por POST a /api/sku-lists y se
// pasa a los endpoints como sku_list_id (evita el limite de tamano de la
// URL — un pegado de 4000 SKUs no cabe en un query string).
export const SKU_INLINE_MAX = 2000;

// Hook: recibe el texto pegado por el usuario, devuelve el fragmento de
// params que hay que mezclar en la query.
//   - vacio: {}
//   - chico: { skus: "..." } inline
//   - grande y ya subido: { sku_list_id: "hash" }
//   - grande y subiendo aun: {} y `posting: true`
export function useLargeSkuList(skuText) {
  const text = (skuText || "").trim();
  const [id, setId] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!text || text.length <= SKU_INLINE_MAX) {
      setId("");
      setPosting(false);
      return;
    }
    let cancelled = false;
    setPosting(true);
    setId("");
    api.storeSkuList(text).then((res) => {
      if (cancelled) return;
      setId(res.id || "");
      setPosting(false);
    }).catch(() => {
      if (cancelled) return;
      setPosting(false);
    });
    return () => { cancelled = true; };
  }, [text]);

  let params = {};
  if (text) {
    if (text.length > SKU_INLINE_MAX) {
      if (id) params = { sku_list_id: id };
      // Si aun no termino el POST, no mandamos nada y quien nos usa
      // muestra "subiendo listado" con `posting`
    } else {
      params = { skus: text };
    }
  }
  return { params, posting, isLarge: text.length > SKU_INLINE_MAX };
}
