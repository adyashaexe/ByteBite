package com.bytebite;

import com.sun.net.httpserver.*;
import java.io.IOException;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.*;
import java.time.format.TextStyle;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

/** ByteBite server: zero-dependency REST API + static frontend on the JDK's built-in HTTP server. */
@SuppressWarnings("unchecked")
public final class Main {
    static final Store store = new Store(Path.of("data", "bytebite.json"));
    static final Path WEB = Path.of("frontend");
    static final Pattern ID = Pattern.compile("^[rmou]\\d+$");
    static final Set<String> PAYMENTS = Set.of("UPI", "Card", "Cash");

    static final class Ex extends RuntimeException {
        final int code;
        Ex(int code, String msg) { super(msg); this.code = code; }
    }

    public static void main(String[] args) throws Exception {
        store.load();
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
        HttpServer srv = HttpServer.create(new InetSocketAddress(port), 0);
        srv.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
        srv.createContext("/api/", Main::api);
        srv.createContext("/", Main::staticFile);
        srv.start();
        Thread.ofVirtual().start(() -> {
            while (true) {
                try { Thread.sleep(2000); store.tick(); } catch (InterruptedException e) { return; }
            }
        });
        System.out.println("\n  🍽️  ByteBite running on Java " + Runtime.version().feature() + "  →  http://localhost:" + port);
        System.out.println("  Admin: admin@bytebite.dev / Admin@123   Customer: user@bytebite.dev / User@123\n");
    }

    // ------------------------------------------------------------------ plumbing
    static void send(HttpExchange x, int code, String type, byte[] body) throws IOException {
        x.getResponseHeaders().set("Content-Type", type);
        x.getResponseHeaders().set("Cache-Control", "no-cache");
        x.sendResponseHeaders(code, body.length == 0 ? -1 : body.length);
        if (body.length > 0) try (var os = x.getResponseBody()) { os.write(body); }
        x.close();
    }

    static void staticFile(HttpExchange x) throws IOException {
        String p = URLDecoder.decode(x.getRequestURI().getPath(), StandardCharsets.UTF_8);
        if (p.equals("/")) p = "/index.html";
        Path f = WEB.resolve(p.substring(1)).normalize();
        if (!f.startsWith(WEB) || !Files.isRegularFile(f)) f = WEB.resolve("index.html");
        if (!Files.isRegularFile(f)) { send(x, 404, "text/plain", "Frontend not found. Run from the project root.".getBytes()); return; }
        String n = f.getFileName().toString();
        String t = n.endsWith(".html") ? "text/html; charset=utf-8" : n.endsWith(".css") ? "text/css; charset=utf-8"
            : n.endsWith(".js") ? "text/javascript; charset=utf-8" : n.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
        send(x, 200, t, Files.readAllBytes(f));
    }

    static void api(HttpExchange x) throws IOException {
        int code = 200; String out;
        try {
            if (x.getRequestMethod().equals("OPTIONS")) { send(x, 204, "text/plain", new byte[0]); return; }
            URI u = x.getRequestURI();
            String raw = new String(x.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            Map<String, Object> body;
            try { body = Json.obj(raw); } catch (RuntimeException e) { throw new Ex(400, "Invalid JSON body"); }
            String h = x.getRequestHeaders().getFirst("Authorization");
            Object res;
            synchronized (store) {
                Map<String, Object> user = h != null && h.startsWith("Bearer ") ? store.verify(h.substring(7)) : null;
                res = route(x.getRequestMethod(), u.getPath().substring(5), query(u.getRawQuery()), body, user);
            }
            out = Json.write(res);
        } catch (Ex e) { code = e.code; out = Json.write(Map.of("error", e.getMessage())); }
        catch (Exception e) { e.printStackTrace(); code = 500; out = Json.write(Map.of("error", "Server error")); }
        send(x, code, "application/json; charset=utf-8", out.getBytes(StandardCharsets.UTF_8));
    }

    static Map<String, String> query(String q) {
        Map<String, String> m = new HashMap<>();
        if (q != null) for (String kv : q.split("&")) {
            int i = kv.indexOf('=');
            if (i > 0) m.put(URLDecoder.decode(kv.substring(0, i), StandardCharsets.UTF_8), URLDecoder.decode(kv.substring(i + 1), StandardCharsets.UTF_8));
        }
        return m;
    }

    static String str(Object o) { return o == null ? "" : o.toString().trim(); }
    static double num(Object o, double d) { return o instanceof Number n ? n.doubleValue() : d; }
    static Map<String, Object> ok() { return new LinkedHashMap<>(Map.of("ok", true)); }

    // -------------------------------------------------------------------- routes
    static Object route(String m, String path, Map<String, String> q, Map<String, Object> b, Map<String, Object> user) {
        List<String> ids = new ArrayList<>(); List<String> norm = new ArrayList<>();
        for (String s : path.split("/")) { if (ID.matcher(s).matches()) { ids.add(s); norm.add("{id}"); } else norm.add(s); }
        String key = m + " " + String.join("/", norm);
        boolean pub = key.startsWith("POST auth/") || key.startsWith("GET restaurants") || key.equals("GET promos");
        if (!pub && user == null) throw new Ex(401, "Please log in");
        if (key.contains(" admin/") && !"ADMIN".equals(user.get("role"))) throw new Ex(403, "Admins only");
        String id = ids.isEmpty() ? null : ids.get(0);

        return switch (key) {
            case "POST auth/signup" -> signup(b);
            case "POST auth/login" -> {
                var u = store.findByEmail(str(b.get("email")));
                if (u == null || !store.checkPassword(str(b.get("password")), (String) u.get("hash"))) throw new Ex(401, "Invalid email or password");
                yield session(u);
            }
            case "GET auth/me" -> userView(user);
            case "GET promos" -> Store.PROMOS;
            case "GET restaurants" -> listRestaurants(q);
            case "GET restaurants/{id}" -> restaurant(id);
            case "POST restaurants/{id}/favorite" -> {
                List<Object> favs = (List<Object>) user.get("favs");
                if (!favs.remove(id)) favs.add(id);
                store.save(); yield Map.of("favs", favs);
            }
            case "GET cart" -> cartView(user);
            case "POST cart/add" -> addToCart(user, b);
            case "PUT cart/items/{id}" -> {
                var items = (List<Map<String, Object>>) cart(user).get("items");
                int qty = (int) num(b.get("qty"), 1);
                items.removeIf(i -> i.get("itemId").equals(id) && qty <= 0);
                for (var i : items) if (i.get("itemId").equals(id)) i.put("qty", Math.min(qty, 20));
                store.save(); yield cartView(user);
            }
            case "DELETE cart/items/{id}" -> { ((List<Map<String, Object>>) cart(user).get("items")).removeIf(i -> i.get("itemId").equals(id)); store.save(); yield cartView(user); }
            case "DELETE cart" -> { store.carts.remove(user.get("id")); store.save(); yield cartView(user); }
            case "POST cart/promo" -> {
                String code = str(b.get("code")).toUpperCase();
                if (!code.isEmpty() && !Store.PROMOS.containsKey(code)) throw new Ex(400, "Unknown promo code");
                cart(user).put("promo", code.isEmpty() ? null : code); store.save(); yield cartView(user);
            }
            case "POST cart/tip" -> { cart(user).put("tip", Math.max(0, Math.min(500, num(b.get("tip"), 0)))); store.save(); yield cartView(user); }
            case "POST order/place" -> place(user, b);
            case "GET order/my" -> orders(user, false);
            case "GET order/{id}" -> ownOrder(user, id);
            case "POST order/{id}/cancel" -> {
                var o = ownOrder(user, id);
                if (!"PLACED".equals(o.get("status"))) throw new Ex(400, "Order can only be cancelled before it starts preparing");
                store.setStatus(o, "CANCELLED"); store.save(); yield o;
            }
            case "POST order/{id}/review" -> review(user, id, b);
            case "GET admin/stats" -> stats();
            case "GET admin/orders" -> orders(user, true);
            case "PUT admin/orders/{id}/status" -> {
                var o = store.orders.get(id); String st = str(b.get("status"));
                if (o == null) throw new Ex(404, "Order not found");
                if (!Store.STATUSES.contains(st) && !st.equals("CANCELLED")) throw new Ex(400, "Bad status");
                o.put("manual", true); store.setStatus(o, st); store.save(); yield o;
            }
            case "POST admin/restaurants" -> {
                if (str(b.get("name")).isEmpty()) throw new Ex(400, "Name required");
                var r = new LinkedHashMap<String, Object>();
                r.put("id", store.id("r")); r.put("name", str(b.get("name"))); r.put("cuisine", str(b.getOrDefault("cuisine", "Other")));
                r.put("emoji", str(b.getOrDefault("emoji", "🍽️"))); r.put("hue", String.valueOf(new Random().nextInt(360)));
                r.put("rating", 4.0); r.put("ratingCount", 0); r.put("etaMinutes", (int) num(b.get("etaMinutes"), 30));
                r.put("deliveryFee", (int) num(b.get("deliveryFee"), 30)); r.put("tag", str(b.get("tag"))); r.put("open", true); r.put("menu", new ArrayList<>());
                store.restaurants.put((String) r.get("id"), r); store.save(); yield r;
            }
            case "PUT admin/restaurants/{id}" -> {
                var r = need(store.restaurants.get(id), "Restaurant");
                for (String k : List.of("name", "cuisine", "emoji", "tag")) if (b.containsKey(k)) r.put(k, str(b.get(k)));
                for (String k : List.of("etaMinutes", "deliveryFee")) if (b.containsKey(k)) r.put(k, (int) num(b.get(k), 0));
                if (b.containsKey("open")) r.put("open", Boolean.TRUE.equals(b.get("open")));
                store.save(); yield r;
            }
            case "DELETE admin/restaurants/{id}" -> { store.restaurants.remove(id); store.save(); yield ok(); }
            case "POST admin/restaurants/{id}/menu" -> {
                var r = need(store.restaurants.get(id), "Restaurant");
                if (str(b.get("name")).isEmpty() || num(b.get("price"), -1) < 0) throw new Ex(400, "Name and price required");
                var it = new LinkedHashMap<String, Object>();
                it.put("id", store.id("m")); it.put("name", str(b.get("name"))); it.put("description", str(b.get("description")));
                it.put("price", num(b.get("price"), 0)); it.put("category", str(b.getOrDefault("category", "Mains")));
                it.put("veg", Boolean.TRUE.equals(b.get("veg"))); it.put("emoji", str(b.getOrDefault("emoji", "🍽️"))); it.put("popular", false);
                ((List<Object>) r.get("menu")).add(it); store.save(); yield it;
            }
            case "PUT admin/menu/{id}" -> {
                var it = need(store.findItem(id) == null ? null : store.findItem(id)[1], "Item");
                for (String k : List.of("name", "description", "category", "emoji")) if (b.containsKey(k)) it.put(k, str(b.get(k)));
                if (b.containsKey("price")) it.put("price", num(b.get("price"), 0));
                if (b.containsKey("veg")) it.put("veg", Boolean.TRUE.equals(b.get("veg")));
                store.save(); yield it;
            }
            case "DELETE admin/menu/{id}" -> {
                var f = need(store.findItem(id) == null ? null : store.findItem(id)[0], "Item");
                ((List<Map<String, Object>>) f.get("menu")).removeIf(i -> i.get("id").equals(id)); store.save(); yield ok();
            }
            default -> throw new Ex(404, "Not found");
        };
    }

    static <T> T need(T t, String what) { if (t == null) throw new Ex(404, what + " not found"); return t; }

    // ---------------------------------------------------------------------- auth
    static Map<String, Object> userView(Map<String, Object> u) {
        var v = new LinkedHashMap<>(u); v.remove("hash"); return v;
    }

    static Map<String, Object> session(Map<String, Object> u) {
        return Map.of("token", store.token((String) u.get("id")), "user", userView(u));
    }

    static Object signup(Map<String, Object> b) {
        String name = str(b.get("name")), email = str(b.get("email")), pw = str(b.get("password"));
        if (name.length() < 2) throw new Ex(400, "Please enter your name");
        if (!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) throw new Ex(400, "Enter a valid email");
        if (pw.length() < 6) throw new Ex(400, "Password must be at least 6 characters");
        if (store.findByEmail(email) != null) throw new Ex(409, "That email is already registered");
        var u = store.newUser(name, email, pw, "CUSTOMER"); store.save();
        return session(u);
    }

    // --------------------------------------------------------------- restaurants
    static Map<String, Object> summary(Map<String, Object> r) {
        var s = new LinkedHashMap<>(r); var menu = (List<Map<String, Object>>) s.remove("menu");
        s.put("menuCount", menu.size());
        s.put("pureVeg", !menu.isEmpty() && menu.stream().allMatch(i -> Boolean.TRUE.equals(i.get("veg"))));
        s.put("items", menu.stream().map(i -> i.get("name")).toList());
        return s;
    }

    static Object listRestaurants(Map<String, String> q) {
        String text = q.getOrDefault("q", "").toLowerCase(), cuisine = q.getOrDefault("cuisine", "");
        boolean veg = "1".equals(q.get("veg"));
        var list = new ArrayList<>(store.restaurants.values().stream().map(Main::summary).filter(r -> {
            if (!cuisine.isEmpty() && !cuisine.equalsIgnoreCase((String) r.get("cuisine"))) return false;
            if (veg && !Boolean.TRUE.equals(r.get("pureVeg"))) return false;
            if (text.isEmpty()) return true;
            return r.get("name").toString().toLowerCase().contains(text) || r.get("cuisine").toString().toLowerCase().contains(text)
                || ((List<Object>) r.get("items")).stream().anyMatch(n -> n.toString().toLowerCase().contains(text));
        }).toList());
        Comparator<Map<String, Object>> c = switch (q.getOrDefault("sort", "rating")) {
            case "eta" -> Comparator.comparingDouble(r -> num(r.get("etaMinutes"), 0));
            case "fee" -> Comparator.comparingDouble(r -> num(r.get("deliveryFee"), 0));
            case "name" -> Comparator.comparing(r -> r.get("name").toString());
            default -> Comparator.comparingDouble((Map<String, Object> r) -> num(r.get("rating"), 0)).reversed();
        };
        list.sort(c); return list;
    }

    static Map<String, Object> restaurant(String id) { return need(store.restaurants.get(id), "Restaurant"); }

    // ---------------------------------------------------------------------- cart
    static Map<String, Object> cart(Map<String, Object> u) {
        return store.carts.computeIfAbsent((String) u.get("id"), k -> {
            var c = new LinkedHashMap<String, Object>(); c.put("restaurantId", null); c.put("items", new ArrayList<>()); c.put("promo", null); c.put("tip", 0); return c;
        });
    }

    static Object addToCart(Map<String, Object> u, Map<String, Object> b) {
        var f = store.findItem(str(b.get("itemId"))); if (f == null) throw new Ex(404, "Item not found");
        if (!Boolean.TRUE.equals(f[0].get("open"))) throw new Ex(400, f[0].get("name") + " is closed right now");
        var c = cart(u); var items = (List<Map<String, Object>>) c.get("items");
        if (!items.isEmpty() && !f[0].get("id").equals(c.get("restaurantId"))) {
            if (!Boolean.TRUE.equals(b.get("replace"))) { throw new Ex(409, "Your cart has items from another restaurant. Start a new cart?"); }
            items.clear(); c.put("promo", null);
        }
        c.put("restaurantId", f[0].get("id"));
        int qty = Math.max(1, (int) num(b.get("qty"), 1));
        for (var i : items) if (i.get("itemId").equals(f[1].get("id"))) { i.put("qty", Math.min(20, (int) num(i.get("qty"), 0) + qty)); store.save(); return cartView(u); }
        items.add(new LinkedHashMap<>(Map.of("itemId", f[1].get("id"), "qty", qty)));
        store.save(); return cartView(u);
    }

    static Map<String, Object> cartView(Map<String, Object> u) {
        var c = cart(u); var raw = (List<Map<String, Object>>) c.get("items");
        var r = store.restaurants.get((String) c.get("restaurantId"));
        var v = new LinkedHashMap<String, Object>();
        var lines = new ArrayList<Map<String, Object>>(); double sub = 0; int count = 0;
        for (var i : new ArrayList<>(raw)) {
            var f = store.findItem((String) i.get("itemId"));
            if (f == null) { raw.remove(i); continue; }
            int q = (int) num(i.get("qty"), 1); double p = num(f[1].get("price"), 0);
            lines.add(Map.of("itemId", i.get("itemId"), "name", f[1].get("name"), "price", p, "qty", q, "emoji", f[1].get("emoji"), "veg", f[1].get("veg")));
            sub += p * q; count += q;
        }
        double fee = r == null || lines.isEmpty() ? 0 : num(r.get("deliveryFee"), 0), disc = 0; String note = null;
        String promo = (String) c.get("promo");
        if (promo != null && !lines.isEmpty()) {
            var p = Store.PROMOS.get(promo);
            if (sub < num(p.get("min"), 0)) note = "Add ₹" + (long) (num(p.get("min"), 0) - sub) + " more to use " + promo;
            else switch ((String) p.get("type")) {
                case "pct" -> disc = Math.min(Math.floor(sub * num(p.get("value"), 0) / 100), num(p.get("max"), 0));
                case "flat" -> disc = num(p.get("value"), 0);
                default -> fee = 0;
            }
        }
        double tax = Math.round(sub * 0.05), tip = lines.isEmpty() ? 0 : num(c.get("tip"), 0);
        if (lines.isEmpty()) { c.put("restaurantId", null); }
        v.put("restaurant", r == null || lines.isEmpty() ? null : Map.of("id", r.get("id"), "name", r.get("name"), "emoji", r.get("emoji"), "eta", r.get("etaMinutes")));
        v.put("items", lines); v.put("count", count); v.put("subtotal", sub); v.put("discount", disc); v.put("deliveryFee", fee);
        v.put("tax", tax); v.put("tip", tip); v.put("promo", promo); v.put("promoNote", note); v.put("total", sub - disc + fee + tax + tip);
        return v;
    }

    // -------------------------------------------------------------------- orders
    static Object place(Map<String, Object> u, Map<String, Object> b) {
        var cv = cartView(u); var lines = (List<Map<String, Object>>) cv.get("items");
        if (lines.isEmpty()) throw new Ex(400, "Your cart is empty");
        String addr = str(b.get("address")), pay = str(b.get("payment"));
        if (addr.length() < 5) throw new Ex(400, "Please enter a delivery address");
        if (!PAYMENTS.contains(pay)) throw new Ex(400, "Choose a payment method");
        var r = store.restaurants.get((String) cart(u).get("restaurantId"));
        if (r == null || !Boolean.TRUE.equals(r.get("open"))) throw new Ex(400, "Restaurant is closed");
        var o = new LinkedHashMap<String, Object>();
        o.put("id", store.id("o")); o.put("userId", u.get("id")); o.put("userName", u.get("name"));
        o.put("restaurantId", r.get("id")); o.put("restaurantName", r.get("name")); o.put("restaurantEmoji", r.get("emoji"));
        o.put("items", lines);
        for (String k : List.of("subtotal", "discount", "deliveryFee", "tax", "tip", "total", "promo")) o.put(k, cv.get(k));
        o.put("address", addr); o.put("payment", pay); o.put("note", str(b.get("note"))); o.put("createdAt", System.currentTimeMillis());
        o.put("status", "PLACED"); o.put("timeline", new ArrayList<>(List.of(Map.of("status", "PLACED", "at", System.currentTimeMillis()))));
        store.orders.put((String) o.get("id"), o);
        store.carts.remove(u.get("id")); store.save();
        return o;
    }

    static Map<String, Object> ownOrder(Map<String, Object> u, String id) {
        var o = need(store.orders.get(id), "Order");
        if (!o.get("userId").equals(u.get("id")) && !"ADMIN".equals(u.get("role"))) throw new Ex(403, "Not your order");
        return o;
    }

    static Object orders(Map<String, Object> u, boolean all) {
        return store.orders.values().stream().filter(o -> all || o.get("userId").equals(u.get("id")))
            .sorted((a, c) -> Long.compare(((Number) c.get("createdAt")).longValue(), ((Number) a.get("createdAt")).longValue())).limit(all ? 200 : 100).toList();
    }

    static Object review(Map<String, Object> u, String id, Map<String, Object> b) {
        var o = ownOrder(u, id); int stars = (int) num(b.get("rating"), 0);
        if (!"DELIVERED".equals(o.get("status"))) throw new Ex(400, "You can review after delivery");
        if (o.get("review") != null) throw new Ex(400, "Already reviewed");
        if (stars < 1 || stars > 5) throw new Ex(400, "Rating must be 1-5");
        o.put("review", Map.of("rating", stars, "comment", str(b.get("comment"))));
        var r = store.restaurants.get((String) o.get("restaurantId"));
        if (r != null) {
            double n = num(r.get("ratingCount"), 0), avg = num(r.get("rating"), 4);
            r.put("rating", Math.round((avg * n + stars) / (n + 1) * 10) / 10.0); r.put("ratingCount", (int) n + 1);
        }
        store.save(); return o;
    }

    // --------------------------------------------------------------------- stats
    static Object stats() {
        var all = store.orders.values().stream().filter(o -> !"CANCELLED".equals(o.get("status"))).toList();
        double revenue = 0; int active = 0; Map<String, Integer> status = new LinkedHashMap<>();
        for (String s : Store.STATUSES) status.put(s, 0);
        status.put("CANCELLED", 0);
        for (var o : store.orders.values()) status.merge((String) o.get("status"), 1, Integer::sum);
        Map<String, Double> byRest = new LinkedHashMap<>(); Map<String, Integer> byItem = new HashMap<>(); Map<String, String> emoji = new HashMap<>();
        LocalDate today = LocalDate.now(); double[] days = new double[14]; int[] cnt = new int[14];
        for (var o : all) {
            double t = num(o.get("total"), 0); revenue += t;
            if (!"DELIVERED".equals(o.get("status"))) active++;
            byRest.merge((String) o.get("restaurantName"), t, Double::sum);
            for (var i : (List<Map<String, Object>>) o.get("items")) { byItem.merge((String) i.get("name"), (int) num(i.get("qty"), 1), Integer::sum); emoji.put((String) i.get("name"), str(i.get("emoji"))); }
            long age = ChronoUnit.DAYS.between(Instant.ofEpochMilli(((Number) o.get("createdAt")).longValue()).atZone(ZoneId.systemDefault()).toLocalDate(), today);
            if (age >= 0 && age < 14) { days[13 - (int) age] += t; cnt[13 - (int) age]++; }
        }
        var daily = new ArrayList<Map<String, Object>>();
        for (int i = 0; i < 14; i++) {
            var d = today.minusDays(13 - i);
            daily.add(Map.of("label", d.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH), "date", d.toString(), "revenue", days[i], "orders", cnt[i]));
        }
        var top = byItem.entrySet().stream().sorted((a, c) -> c.getValue() - a.getValue()).limit(5)
            .map(e -> Map.of("name", e.getKey(), "qty", e.getValue(), "emoji", emoji.getOrDefault(e.getKey(), "🍽️"))).toList();
        var rests = byRest.entrySet().stream().sorted((a, c) -> Double.compare(c.getValue(), a.getValue())).limit(6)
            .map(e -> Map.of("name", e.getKey(), "revenue", e.getValue())).toList();
        long customers = store.users.values().stream().filter(u -> "CUSTOMER".equals(u.get("role"))).count();
        var res = new LinkedHashMap<String, Object>();
        res.put("revenue", revenue); res.put("orders", all.size()); res.put("active", active); res.put("customers", customers);
        res.put("avgOrder", all.isEmpty() ? 0 : revenue / all.size()); res.put("restaurants", store.restaurants.size());
        res.put("daily", daily); res.put("status", status); res.put("topItems", top); res.put("topRestaurants", rests);
        return res;
    }
}
