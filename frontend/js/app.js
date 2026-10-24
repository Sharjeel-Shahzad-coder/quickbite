/* QuickBite front end v2 - plain JavaScript, no build step. */
const $ = id => document.getElementById(id);
const money = n => "Rs. " + Number(n).toLocaleString("en-PK");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const slug = s => String(s).toLowerCase().replace(/\s+/g, "-");
const CUISINE = { "Desi": "🍛", "Fast Food": "🍔", "Italian": "🍝", "Japanese": "🍣", "Chinese": "🥡", "BBQ": "🍢", "Dessert": "🍰", "Cafe": "☕" };
const CATEGORY = { Mains: "🍛", Grill: "🍢", Breads: "🫓", Rice: "🍚", Sides: "🍟", Burgers: "🍔", Drinks: "🥤", Pasta: "🍝", Pizza: "🍕", Dessert: "🍰", Rolls: "🍣", Nigiri: "🍣", Ramen: "🍜" };
const STATUSES = ["Placed", "Preparing", "Out for delivery", "Delivered"];

async function api(path, opts = {}) {
  let res;
  try { res = await fetch(path, opts); }
  catch (e) { throw new Error("Can't reach the server. Start the app with docker compose up and open http://localhost."); }
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error(data.error || "Request failed (" + res.status + ")");
  return data;
}

function toast(msg, kind = "ok") {
  let box = $("toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; box.setAttribute("aria-live", "polite"); document.body.appendChild(box); }
  const t = document.createElement("div");
  t.className = "toast " + kind; t.textContent = msg; box.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
const show = (el, text) => { el.textContent = text; el.classList.remove("hidden"); };

/* ---------- cart + recent orders (browser storage) ---------- */
const Cart = {
  get() { try { return JSON.parse(localStorage.getItem("qb_cart")) || { restaurant: null, items: [] }; } catch (e) { return { restaurant: null, items: [] }; } },
  save(c) { localStorage.setItem("qb_cart", JSON.stringify(c)); Cart.badge(); },
  count() { return Cart.get().items.reduce((n, i) => n + i.qty, 0); },
  total() { return Cart.get().items.reduce((n, i) => n + i.qty * i.price, 0); },
  qty(id) { const i = Cart.get().items.find(x => x.id === id); return i ? i.qty : 0; },
  badge() { const b = $("cart-count"); if (b) b.textContent = Cart.count(); },
  add(item, restaurant) {
    let c = Cart.get(), switched = false;
    if (c.restaurant && c.restaurant.id !== restaurant.id) { c = { restaurant: null, items: [] }; switched = true; } // one restaurant per order
    c.restaurant = { id: restaurant.id, name: restaurant.name };
    const found = c.items.find(i => i.id === item.id);
    if (found) found.qty += 1; else c.items.push({ id: item.id, name: item.name, price: item.price, qty: 1 });
    Cart.save(c);
    return switched;
  },
  change(id, delta) {
    const c = Cart.get(), it = c.items.find(i => i.id === id);
    if (it) it.qty += delta;
    c.items = c.items.filter(i => i.qty > 0);
    if (!c.items.length) c.restaurant = null;
    Cart.save(c);
  },
  clear() { Cart.save({ restaurant: null, items: [] }); }
};
const Recent = {
  get() { try { return JSON.parse(localStorage.getItem("qb_orders")) || []; } catch (e) { return []; } },
  add(id) { localStorage.setItem("qb_orders", JSON.stringify([id, ...Recent.get().filter(x => x !== id)].slice(0, 5))); }
};

/* ---------- pages ---------- */
const pages = {
  async home() {
    const list = $("restaurant-list");
    list.innerHTML = '<div class="skeleton-card"></div>'.repeat(4);
    let all = [], cuisine = "All";
    try { all = await api("/api/restaurants"); }
    catch (e) { list.innerHTML = `<div class="empty"><p class="msg err">${esc(e.message)}</p><button class="btn" id="retry">Try again</button></div>`; $("retry").onclick = () => pages.home(); return; }

    const cuisines = ["All", ...new Set(all.map(r => r.cuisine))];
    $("chips").innerHTML = cuisines.map(c => `<button class="chip" data-c="${esc(c)}" aria-pressed="${c === "All"}">${esc(c)}</button>`).join("");
    if (all.length) $("hero-stats").textContent = `${all.length} kitchens are taking orders. The fastest delivers in ${Math.min(...all.map(r => r.delivery_time))} minutes.`;

    const render = () => {
      const q = $("search").value.trim().toLowerCase(), sort = $("sort").value;
      const rows = all.filter(r => (cuisine === "All" || r.cuisine === cuisine) && (r.name + " " + r.cuisine + " " + (r.description || "")).toLowerCase().includes(q))
        .sort((a, b) => sort === "time" ? a.delivery_time - b.delivery_time : sort === "name" ? a.name.localeCompare(b.name) : b.rating - a.rating);
      $("result-count").textContent = rows.length + (rows.length === 1 ? " restaurant" : " restaurants");
      list.innerHTML = rows.length ? rows.map(r => `
        <a class="restaurant-card" href="menu.html?id=${r.id}">
          <div class="cover" style="--h:${hue(r.name)}"><span class="cover-emoji" aria-hidden="true">${CUISINE[r.cuisine] || "🍽️"}</span><span class="pill rating">★ ${r.rating}</span></div>
          <div class="card-body"><h3>${esc(r.name)}</h3><p class="meta">${esc(r.cuisine)}</p>
          <p class="desc">${esc(r.description || "")}</p><p class="foot">Delivery in ${r.delivery_time} min</p></div>
        </a>`).join("") : `<div class="empty"><h3>No matches</h3><p>Try a different search or pick All cuisines.</p></div>`;
    };
    $("chips").addEventListener("click", ev => {
      const b = ev.target.closest(".chip"); if (!b) return;
      cuisine = b.dataset.c;
      document.querySelectorAll("#chips .chip").forEach(x => x.setAttribute("aria-pressed", x === b));
      render();
    });
    $("search").addEventListener("input", render);
    $("sort").addEventListener("change", render);
    render();
  },

  async menu() {
    const id = new URLSearchParams(location.search).get("id");
    const list = $("menu-list");
    try {
      const { restaurant: r, items } = await api("/api/restaurants/" + encodeURIComponent(id) + "/menu");
      document.title = r.name + " - QuickBite";
      $("restaurant-header").innerHTML = `<div class="menu-hero" style="--h:${hue(r.name)}">
        <span class="cover-emoji" aria-hidden="true">${CUISINE[r.cuisine] || "🍽️"}</span>
        <div><h1>${esc(r.name)}</h1><p>${esc(r.description || "")}</p>
        <span class="pill light">${esc(r.cuisine)}</span> <span class="pill light">★ ${r.rating}</span> <span class="pill light">About ${r.delivery_time} min</span></div></div>`;
      const cats = ["All", ...new Set(items.map(i => i.category))];
      $("cat-tabs").innerHTML = cats.map(c => `<button class="chip" data-c="${esc(c)}" aria-pressed="${c === "All"}">${esc(c)}</button>`).join("");
      let cat = "All";

      const bar = () => {
        const b = $("cart-bar"), c = Cart.get();
        if (!Cart.count() || !c.restaurant || c.restaurant.id !== r.id) return b.classList.add("hidden");
        $("bar-count").textContent = Cart.count() + (Cart.count() === 1 ? " item" : " items");
        $("bar-total").textContent = money(Cart.total());
        b.classList.remove("hidden");
      };
      const render = () => {
        const q = $("menu-search").value.trim().toLowerCase();
        const rows = items.filter(i => (cat === "All" || i.category === cat) && (i.name + " " + (i.description || "")).toLowerCase().includes(q));
        let html = "", last = "";
        for (const it of rows) {
          if (it.category !== last) { last = it.category; html += `<h2 class="cat">${esc(last)}</h2>`; }
          const inCart = Cart.get().restaurant && Cart.get().restaurant.id === r.id ? Cart.qty(it.id) : 0;
          html += `<article class="item"><span class="thumb" aria-hidden="true">${CATEGORY[it.category] || "🍽️"}</span>
            <div class="item-info"><h3>${esc(it.name)}</h3><span class="meta">${esc(it.description || "")}</span></div>
            <div class="item-act"><div><span class="price">${money(it.price)}</span><span class="in-cart" data-for="${it.id}">${inCart ? inCart + " in cart" : ""}</span></div>
            <button class="btn small add-btn" data-id="${it.id}" aria-label="Add ${esc(it.name)} to cart">Add</button></div></article>`;
        }
        list.innerHTML = html || `<div class="empty"><h3>Nothing found</h3><p>Try a different search or category.</p></div>`;
      };
      list.addEventListener("click", ev => {
        const btn = ev.target.closest(".add-btn"); if (!btn) return;
        const item = items.find(i => i.id === Number(btn.dataset.id));
        const switched = Cart.add(item, r);
        const tag = document.querySelector(`.in-cart[data-for="${item.id}"]`);
        if (tag) tag.textContent = Cart.qty(item.id) + " in cart";
        if (switched) render();
        toast(switched ? `Started a new cart from ${r.name}` : `Added ${item.name}`);
        bar();
      });
      $("cat-tabs").addEventListener("click", ev => {
        const b = ev.target.closest(".chip"); if (!b) return;
        cat = b.dataset.c;
        document.querySelectorAll("#cat-tabs .chip").forEach(x => x.setAttribute("aria-pressed", x === b));
        render();
      });
      $("menu-search").addEventListener("input", render);
      render(); bar();
    } catch (e) { list.innerHTML = `<p class="msg err">${esc(e.message)}</p>`; }
  },

  cart() {
    const fields = ["customer_name", "phone", "address"];
    const setErr = (f, msg) => { $("e-" + f).textContent = msg; $(f).setAttribute("aria-invalid", msg ? "true" : "false"); };
    const render = () => {
      const c = Cart.get(), n = Cart.count();
      if (!c.items.length) {
        $("cart-items").innerHTML = `<p>Your cart is empty. <a href="index.html"><strong>Choose a restaurant</strong></a> to start an order.</p>`;
        $("checkout-form").classList.add("hidden"); $("clear-cart").classList.add("hidden"); $("summary").classList.add("hidden");
      } else {
        $("cart-items").innerHTML = `<p class="meta">Ordering from ${esc(c.restaurant.name)}</p>` + c.items.map(i => `
          <div class="menu-row"><div><h3>${esc(i.name)}</h3><span class="meta">${money(i.price)} each, ${money(i.price * i.qty)} total</span></div>
          <div class="stepper"><button class="btn secondary" data-id="${i.id}" data-d="-1" aria-label="Remove one ${esc(i.name)}">-</button>
          <span class="cart-qty">${i.qty}</span>
          <button class="btn secondary" data-id="${i.id}" data-d="1" aria-label="Add one ${esc(i.name)}">+</button></div></div>`).join("");
        $("checkout-form").classList.remove("hidden"); $("clear-cart").classList.remove("hidden"); $("summary").classList.remove("hidden");
        $("summary-restaurant").textContent = c.restaurant.name;
        $("summary-count").textContent = n + (n === 1 ? " item" : " items");
      }
      $("cart-total").textContent = money(Cart.total());
      $("summary-total").textContent = money(Cart.total());
    };
    $("cart-items").addEventListener("click", ev => {
      const b = ev.target.closest("button[data-id]");
      if (b) { Cart.change(Number(b.dataset.id), Number(b.dataset.d)); render(); }
    });
    $("clear-cart").addEventListener("click", () => { Cart.clear(); render(); toast("Cart cleared"); });
    fields.forEach(f => $(f).addEventListener("input", () => setErr(f, "")));
    $("checkout-form").addEventListener("submit", async ev => {
      ev.preventDefault();
      $("form-error").classList.add("hidden");
      const v = { customer_name: $("customer_name").value.trim(), phone: $("phone").value.trim(), address: $("address").value.trim() };
      let ok = true;
      if (v.customer_name.length < 2) { setErr("customer_name", "Enter your full name."); ok = false; }
      if (!/^[0-9+\-\s()]{7,20}$/.test(v.phone)) { setErr("phone", "Enter a phone number with 7 to 20 digits."); ok = false; }
      if (v.address.length < 8) { setErr("address", "Enter your full delivery address."); ok = false; }
      if (!ok) return;
      const btn = $("place-order"); btn.disabled = true; btn.textContent = "Placing order...";
      try {
        const r = await api("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...v, items: Cart.get().items.map(i => ({ id: i.id, qty: i.qty })) }) });
        Cart.clear(); Recent.add(r.order_id);
        $("order-id").textContent = r.order_id;
        $("order-total").textContent = money(r.total);
        $("track-link").href = "track.html?id=" + r.order_id;
        $("cart-layout").classList.add("hidden");
        $("order-confirmation").classList.remove("hidden");
        window.scrollTo(0, 0);
      } catch (e) { show($("form-error"), e.message); btn.disabled = false; btn.textContent = "Place order"; }
    });
    render();
  },

  track() {
    let timer = null;
    const recent = () => {
      const r = Recent.get();
      $("recent-orders").innerHTML = r.length ? `<span class="meta">Recent orders:</span> ` + r.map(id => `<button class="chip" data-id="${id}">#${id}</button>`).join("") : "";
    };
    const load = async id => {
      clearInterval(timer);
      $("track-error").classList.add("hidden");
      try {
        const o = await api("/api/orders/" + encodeURIComponent(id));
        $("t-id").textContent = "#" + o.id;
        $("t-meta").textContent = `${o.customer_name}, delivering to ${o.address}. Placed ${o.created_at}.`;
        const st = $("order-status"); st.textContent = o.status; st.className = "pill status-" + slug(o.status);
        const idx = o.steps.indexOf(o.status);
        $("progress-fill").style.width = (idx / (o.steps.length - 1)) * 100 + "%";
        $("steps").innerHTML = o.steps.map((s, i) => `<li class="${i < idx ? "done" : i === idx ? "current" : ""}">${esc(s)}</li>`).join("");
        $("t-items").innerHTML = o.items.map(i => `<div class="menu-row"><span>${i.qty} x ${esc(i.item_name)}</span><span class="price">${money(i.price * i.qty)}</span></div>`).join("") +
          `<div class="total"><span>Total</span><span>${money(o.total)}</span></div>`;
        $("refresh-note").textContent = o.status === "Delivered" ? "This order has been delivered." : "This page updates every 5 seconds.";
        $("order-details").classList.remove("hidden");
        Recent.add(o.id); recent();
        if (o.status !== "Delivered") timer = setInterval(() => load(id), 5000);
      } catch (e) { $("order-details").classList.add("hidden"); show($("track-error"), e.message); }
    };
    $("track-form").addEventListener("submit", ev => { ev.preventDefault(); const v = $("order-id-input").value.trim().replace("#", ""); if (v) load(v); });
    $("recent-orders").addEventListener("click", ev => { const b = ev.target.closest("button[data-id]"); if (b) { $("order-id-input").value = b.dataset.id; load(b.dataset.id); } });
    recent();
    const id = new URLSearchParams(location.search).get("id");
    if (id) { $("order-id-input").value = id; load(id); }
  },

  admin() {
    let orders = [], filter = "All", timer = null;
    const key = () => sessionStorage.getItem("qb_admin");
    const headers = () => ({ "X-Admin-Key": key(), "Content-Type": "application/json" });

    const render = () => {
      const q = $("order-search").value.trim().toLowerCase();
      $("status-filters").innerHTML = ["All", ...STATUSES].map(s => {
        const n = s === "All" ? orders.length : orders.filter(o => o.status === s).length;
        return `<button class="chip" data-s="${s}" aria-pressed="${s === filter}">${s} (${n})</button>`;
      }).join("");
      const rows = orders.filter(o => (filter === "All" || o.status === filter) &&
        `${o.id} ${o.customer_name} ${o.phone} ${o.items || ""}`.toLowerCase().includes(q));
      document.querySelector("#orders-table tbody").innerHTML = rows.length ? rows.map(o => `<tr>
        <td>#${o.id}</td>
        <td>${esc(o.customer_name)}<br><span class="meta">${esc(o.phone)}</span><br><span class="meta">${esc(o.address)}</span></td>
        <td>${esc(o.items || "")}</td><td class="price">${money(o.total)}</td><td>${esc(o.created_at)}</td>
        <td><span class="pill status-${slug(o.status)}">${esc(o.status)}</span><br>
        <select data-id="${o.id}" aria-label="Status for order ${o.id}">${STATUSES.map(s => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select></td></tr>`).join("")
        : `<tr><td colspan="6" class="muted">No orders match this filter.</td></tr>`;
    };
    const load = async () => {
      const [stats, list] = await Promise.all([api("/api/admin/stats", { headers: headers() }), api("/api/admin/orders", { headers: headers() })]);
      orders = list;
      $("stat-orders").textContent = stats.orders; $("stat-active").textContent = stats.active; $("stat-revenue").textContent = money(stats.revenue);
      $("last-updated").textContent = "Updated " + new Date().toLocaleTimeString();
      render();
    };
    const startTimer = () => {
      clearInterval(timer);
      if ($("auto-refresh").checked) timer = setInterval(() => { if (!document.activeElement.matches("select")) load().catch(() => {}); }, 10000);
    };
    const open = async () => {
      try {
        await load();
        $("login-form").classList.add("hidden"); $("dashboard").classList.remove("hidden"); startTimer();
      } catch (e) { sessionStorage.removeItem("qb_admin"); show($("login-error"), e.message); }
    };
    $("login-form").addEventListener("submit", ev => { ev.preventDefault(); $("login-error").classList.add("hidden"); sessionStorage.setItem("qb_admin", $("admin-key").value); open(); });
    $("logout-btn").addEventListener("click", () => {
      sessionStorage.removeItem("qb_admin"); clearInterval(timer);
      $("dashboard").classList.add("hidden"); $("login-form").classList.remove("hidden"); $("admin-key").value = "";
    });
    $("status-filters").addEventListener("click", ev => { const b = ev.target.closest(".chip"); if (b) { filter = b.dataset.s; render(); } });
    $("order-search").addEventListener("input", render);
    $("auto-refresh").addEventListener("change", startTimer);
    document.querySelector("#orders-table").addEventListener("change", async ev => {
      if (!ev.target.matches("select")) return;
      try {
        await api(`/api/admin/orders/${ev.target.dataset.id}/status`, { method: "PATCH", headers: headers(), body: JSON.stringify({ status: ev.target.value }) });
        toast(`Order #${ev.target.dataset.id} is now ${ev.target.value}`);
        load();
      } catch (e) { toast(e.message, "err"); }
    });
    if (key()) open();
  }
};

/* ---------- shared start-up ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  Cart.badge();
  const navPage = page === "menu" ? "home" : page;
  document.querySelectorAll(".links a").forEach(a => { if (a.dataset.nav === navPage) a.setAttribute("aria-current", "page"); });
  const toggle = $("menu-toggle");
  if (toggle) toggle.addEventListener("click", () => { const open = $("nav-links").classList.toggle("open"); toggle.setAttribute("aria-expanded", open); });
  const theme = $("theme-toggle");
  if (theme) theme.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("qb_theme", next); } catch (e) {}
  });
  if (location.protocol === "file:") {
    const b = document.createElement("div"); b.className = "banner wrap";
    b.textContent = "You opened this page as a file, so there is no server behind it. Run docker compose up -d and open http://localhost instead.";
    document.querySelector("main").prepend(b);
  }
  fetch("/health").then(r => r.json()).then(h => { const s = $("host"); if (s) s.textContent = h.host; }).catch(() => {});
  if (pages[page]) pages[page]();
});
