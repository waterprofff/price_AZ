/* price-byt.js — наполняем существующую таблицу из одного общего CSV и фильтруем list=byt.
 * Верстку/стили НЕ трогаем. Работает на GitHub Pages.
 */

// === ВАШ единый CSV-URL (Publish to web) ===
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRhmVwX16I7aMJ6CKS_5GGu3rI915mv9VRg11ZL9pau_672ZRHNZclBQ6P7Di_TJeF42B4ULkxUg3Lt/pub?output=csv";

// === Фильтр по колонке list ===
const LIST_FILTER = "byt"; // для этой страницы подставляем только byt

const ENABLE_PROMOS = true;      // выключить акционную логику: false
const CSV_DELIMITER = ",";       // стандарт для Google Sheets CSV
const DISCOUNT_MODE = "current"; // 'current'|'baseOnly'|'promoOnly'
const fmtMoney = n => n.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
const bust = url => url + (url.includes("?") ? "&" : "?") + "cb=" + Date.now();

function parseCsv(text, delimiter) {
  const rows = []; let row = []; let val = ""; let q = false;
  const pushVal = () => { row.push(val); val=""; };
  const pushRow = () => { rows.push(row); row=[]; };
  for (let i=0;i<text.length;i++){
    const ch=text[i];
    if(q){
      if(ch==='"'){ if(text[i+1]==='"'){ val+='"'; i++; } else { q=false; } }
      else val+=ch;
    } else {
      if(ch==='"') q=true;
      else if(ch===delimiter) pushVal();
      else if(ch==='\n'){ pushVal(); pushRow(); }
      else if(ch!=='\r') val+=ch;
    }
  }
  if(val.length||row.length){ pushVal(); pushRow(); }
  const [head,...data]=rows; if(!head) return [];
  const names=head.map(h=>String(h||"").trim());
  return data
    .filter(r=>r.length && r.some(c=>String(c).trim()))
    .map(r=>Object.fromEntries(names.map((h,i)=>[h, r[i]!=null? String(r[i]).trim() : ""])));
}

function parseRuDate(s){ if(!s) return null;
  const m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s.trim()); if(!m) return null;
  const [,dd,mm,yyyy]=m; return new Date(+yyyy, +mm-1, +dd);
}
function isPromoActive(item, today=new Date()){
  if(!ENABLE_PROMOS) return false;
  const s=parseRuDate(item.promo_start), e=parseRuDate(item.promo_end);
  if(!s||!e) return false;
  const t0=new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const s0=new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const e0=new Date(e.getFullYear(), e.getMonth(), e.getDate());
  return t0>=s0 && t0<=e0;
}
function computePrices(item){
  const base = Number(item.price)||0;
  let promoActive = isPromoActive(item);
  let promo = null;
  if(promoActive){
    if(item.promo_price!==""){
      const v=Number(item.promo_price);
      if(!Number.isNaN(v)) promo=v;
    }
    if(promo==null && item.promo_discount!==""){
      const d=Number(item.promo_discount);
      if(!Number.isNaN(d)) promo=Math.round(base*(1-d/100));
    }
    if(promo==null) promoActive=false;
  }
  return { base, promoActive, promo };
}

// ——— поиск вашей текущей таблицы по заголовкам (оформление не меняем)
function findPriceTable() {
  const tables = Array.from(document.querySelectorAll("table"));
  let best=null, score=-1;
  for(const t of tables){
    const heads = Array.from(t.querySelectorAll("thead th, tr th")).map(th=>th.textContent.trim().toLowerCase()).join(" ");
    let s=0;
    if(heads.includes("артикул")) s++;
    if(heads.includes("цена")) s++;
    if(heads.includes("акция")) s++;
    if(s>score){ score=s; best=t; }
  }
  return best;
}
function mapColumns(table){
  const ths = Array.from(table.querySelectorAll("thead th"));
  const texts = ths.map(th=>th.textContent.trim().toLowerCase());
  const idx = {
    article: texts.findIndex(t=>/артикул/.test(t)),
    name:    texts.findIndex(t=>/наимен/.test(t)),
    description: texts.findIndex(t=>/описан/.test(t)),
    pack:    texts.findIndex(t=>/упак/.test(t)),
    pallet:  texts.findIndex(t=>/палет|палета/.test(t)),
    price:   texts.findIndex(t=>/цена/.test(t)),
    promo:   texts.findIndex(t=>/акци/.test(t)),
    image:   texts.findIndex(t=>/фото|image/.test(t)),
    link:    texts.findIndex(t=>/карточ|перейти|ссылка|product/.test(t))
  };
  return { ths, idx };
}
function buildRowByStructure(struct, item){
  const { idx, ths } = struct;
  const { base, promoActive, promo } = computePrices(item);
  const tdAt = k => {
    const el=document.createElement("td"); let html="";
    if(k===idx.article) html = item.article||"";
    else if(k===idx.name) html = item.name||"";
    else if(k===idx.description) html = item.description||"";
    else if(k===idx.pack) html = item.pack||"";
    else if(k===idx.pallet) html = item.pallet||"";
    else if(k===idx.price) html = fmtMoney(base);
    else if(k===idx.promo) html = (promoActive&&promo!=null) ? fmtMoney(promo) : "";
    else if(k===idx.image) html = item.image_url ? `<img loading="lazy" src="${item.image_url}" alt="">` : "";
    else if(k===idx.link)  html = item.product_url ? `<a class="urla" href="${item.product_url}" target="_blank" rel="noopener">перейти</a>` : "";
    el.innerHTML = html; return el;
  };
  const tr=document.createElement("tr");
  const colCount = (ths.length||0) || 9;
  for(let c=0;c<colCount;c++) tr.appendChild(tdAt(c));
  tr.dataset.base = String(Number(item.price)||0);
  tr.dataset.promo = (promo!=null? String(promo) : "");
  tr.dataset.promoActive = String(!!(promoActive && promo!=null));
  return tr;
}
function renderTable(table, items){
  let tbody = table.querySelector("tbody");
  if(!tbody){ tbody = document.createElement("tbody"); table.appendChild(tbody); }
  tbody.innerHTML="";
  const struct = mapColumns(table);
  items.forEach(it => tbody.appendChild(buildRowByStructure(struct, it)));
}

function applyDiscount(percent){
  const table = findPriceTable(); if(!table) return;
  const tbody = table.querySelector("tbody"); if(!tbody) return;
  const p = Math.max(0, Math.min(99, Number(percent)||0));
  tbody.querySelectorAll("tr").forEach(tr=>{
    const base = Number(tr.dataset.base||0);
    const promoActive = tr.dataset.promoActive==='true';
    const promo = tr.dataset.promo ? Number(tr.dataset.promo) : null;
    let target = base;
    if(DISCOUNT_MODE==='current') target = (promoActive && promo!=null) ? promo : base;
    if(DISCOUNT_MODE==='promoOnly') target = (promoActive && promo!=null) ? promo : base;
    if(DISCOUNT_MODE==='baseOnly') target = base;
    const discounted = Math.round(target*(1 - p/100));
    const { idx } = mapColumns(table);
    const tds = tr.children;
    if(promoActive && promo!=null && idx.promo>=0 && tds[idx.promo]){
      tds[idx.promo].textContent = fmtMoney(discounted);
    } else if(idx.price>=0 && tds[idx.price]) {
      tds[idx.price].textContent = fmtMoney(discounted);
      if(idx.promo>=0 && tds[idx.promo]) tds[idx.promo].textContent = "";
    }
  });
}
function resetTable(original){
  const table = findPriceTable(); if(!table) return;
  renderTable(table, original);
  const inp=document.getElementById('discount'); if(inp) inp.value="";
}

async function loadCsv(url){
  const r = await fetch(bust(url), { cache: "no-store" });
  if(!r.ok) throw new Error("CSV load error " + r.status);
  const text = await r.text();
  return parseCsv(text, CSV_DELIMITER);
}

(async function main(){
  try{
    const table = findPriceTable(); if(!table) return;
    const raw = await loadCsv(CSV_URL);

    // Фильтрация по list=byt (регистр неважен)
    const items = raw
      .filter(x => (x.list||"").toString().trim().toLowerCase() === LIST_FILTER)
      .map(x => ({
        article: x.article ?? "", name: x.name ?? "", description: x.description ?? "",
        pack: x.pack ?? "", pallet: x.pallet ?? "",
        price: x.price ?? "", promo_price: x.promo_price ?? "", promo_discount: x.promo_discount ?? "",
        promo_start: x.promo_start ?? "", promo_end: x.promo_end ?? "",
        image_url: x.image_url ?? "", product_url: x.product_url ?? ""
      }));

    renderTable(table, items);

    const btnApply = document.getElementById('applyDiscount');
    const btnReset = document.getElementById('resetDiscount');
    const input = document.getElementById('discount');
    if(btnApply && input) btnApply.addEventListener('click', ()=>applyDiscount(input.value));
    if(btnReset) btnReset.addEventListener('click', ()=>resetTable(items));

    setInterval(async()=>{
      try{
        const fresh = await loadCsv(CSV_URL);
        const upd = fresh
          .filter(x => (x.list||"").toString().trim().toLowerCase() === LIST_FILTER)
          .map(x => ({
            article: x.article ?? "", name: x.name ?? "", description: x.description ?? "",
            pack: x.pack ?? "", pallet: x.pallet ?? "",
            price: x.price ?? "", promo_price: x.promo_price ?? "", promo_discount: x.promo_discount ?? "",
            promo_start: x.promo_start ?? "", promo_end: x.promo_end ?? "",
            image_url: x.image_url ?? "", product_url: x.product_url ?? ""
          }));
        renderTable(table, upd);
      }catch(e){ console.warn("Автообновление не удалось:", e); }
    }, 10*60*1000);

  }catch(e){ console.error(e); }
})();
