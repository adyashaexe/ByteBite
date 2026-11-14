package com.bytebite;

import javax.crypto.Mac;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.SecureRandom;
import java.time.*;
import java.util.*;

/** In-memory data store with JSON snapshot persistence, auth helpers and order lifecycle. */
public final class Store {
    public static final List<String> STATUSES = List.of("PLACED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED");
    /** Seconds after placement at which the simulated kitchen/courier advances each stage. */
    private static final int[] STAGE_AT = {0, 12, 30, 55};

    public static final Map<String, Map<String, Object>> PROMOS = new LinkedHashMap<>();
    static {
        PROMOS.put("BITE20", Map.of("type", "pct", "value", 20, "max", 150, "min", 200, "desc", "20% off up to ₹150 (min ₹200)"));
        PROMOS.put("WELCOME50", Map.of("type", "flat", "value", 50, "max", 50, "min", 300, "desc", "₹50 off orders above ₹300"));
        PROMOS.put("FREESHIP", Map.of("type", "ship", "value", 0, "max", 0, "min", 150, "desc", "Free delivery above ₹150"));
    }

    private final Path file;
    private final SecureRandom rnd = new SecureRandom();
    private byte[] secret;
    private long seq = 100;
    final Map<String, Map<String, Object>> users = new LinkedHashMap<>();
    final Map<String, Map<String, Object>> restaurants = new LinkedHashMap<>();
    final Map<String, Map<String, Object>> orders = new LinkedHashMap<>();
    final Map<String, Map<String, Object>> carts = new LinkedHashMap<>();

    public Store(Path file) { this.file = file; }

    public synchronized String id(String p) { return p + (++seq); }

    // ------------------------------------------------------------ persistence
    @SuppressWarnings("unchecked")
    public synchronized void load() throws Exception {
        if (!Files.exists(file)) { seed(); save(); return; }
        Map<String, Object> d = Json.obj(Files.readString(file));
        secret = Base64.getDecoder().decode((String) d.get("secret"));
        seq = ((Number) d.get("seq")).longValue();
        for (String k : List.of("users", "restaurants", "orders", "carts")) {
            Map<String, Map<String, Object>> t = switch (k) { case "users" -> users; case "restaurants" -> restaurants; case "orders" -> orders; default -> carts; };
            t.clear(); t.putAll((Map<String, Map<String, Object>>) d.get(k));
        }
    }

    public synchronized void save() {
        try {
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("secret", Base64.getEncoder().encodeToString(secret)); d.put("seq", seq);
            d.put("users", users); d.put("restaurants", restaurants); d.put("orders", orders); d.put("carts", carts);
            Files.createDirectories(file.toAbsolutePath().getParent());
            Path tmp = file.resolveSibling(file.getFileName() + ".tmp");
            Files.writeString(tmp, Json.write(d));
            Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (Exception e) { System.err.println("Save failed: " + e); }
    }

    // ------------------------------------------------------------------- auth
    private static String hex(byte[] b) { return HexFormat.of().formatHex(b); }

    public String hashPassword(String pw) {
        try {
            byte[] salt = new byte[16]; rnd.nextBytes(salt);
            byte[] h = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(new PBEKeySpec(pw.toCharArray(), salt, 60_000, 256)).getEncoded();
            return hex(salt) + ":" + hex(h);
        } catch (Exception e) { throw new IllegalStateException(e); }
    }

    public boolean checkPassword(String pw, String stored) {
        try {
            String[] p = stored.split(":");
            byte[] h = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(new PBEKeySpec(pw.toCharArray(), HexFormat.of().parseHex(p[0]), 60_000, 256)).getEncoded();
            return java.security.MessageDigest.isEqual(h, HexFormat.of().parseHex(p[1]));
        } catch (Exception e) { return false; }
    }

    private String sign(String payload) {
        try {
            Mac m = Mac.getInstance("HmacSHA256"); m.init(new SecretKeySpec(secret, "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(m.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) { throw new IllegalStateException(e); }
    }

    public String token(String uid) {
        String json = Json.write(Map.of("uid", uid, "exp", System.currentTimeMillis() + 7L * 86400_000));
        String p = Base64.getUrlEncoder().withoutPadding().encodeToString(json.getBytes(StandardCharsets.UTF_8));
        return p + "." + sign(p);
    }

    public synchronized Map<String, Object> verify(String token) {
        try {
            String[] p = token.split("\\.");
            if (p.length != 2 || !java.security.MessageDigest.isEqual(sign(p[0]).getBytes(), p[1].getBytes())) return null;
            Map<String, Object> c = Json.obj(new String(Base64.getUrlDecoder().decode(p[0]), StandardCharsets.UTF_8));
            if (((Number) c.get("exp")).longValue() < System.currentTimeMillis()) return null;
            return users.get((String) c.get("uid"));
        } catch (Exception e) { return null; }
    }

    public Map<String, Object> newUser(String name, String email, String pw, String role) {
        Map<String, Object> u = new LinkedHashMap<>();
        u.put("id", id("u")); u.put("name", name); u.put("email", email.toLowerCase());
        u.put("hash", hashPassword(pw)); u.put("role", role); u.put("favs", new ArrayList<>());
        u.put("createdAt", System.currentTimeMillis());
        users.put((String) u.get("id"), u);
        return u;
    }

    public Map<String, Object> findByEmail(String email) {
        for (var u : users.values()) if (u.get("email").equals(email.toLowerCase())) return u;
        return null;
    }

    // ----------------------------------------------------------------- lookups
    @SuppressWarnings("unchecked")
    public Map<String, Object>[] findItem(String itemId) {
        for (var r : restaurants.values())
            for (var it : (List<Map<String, Object>>) r.get("menu"))
                if (it.get("id").equals(itemId)) return new Map[]{r, it};
        return null;
    }

    // ------------------------------------------------------------ order engine
    /** Advances orders whose elapsed time passed the next stage. Called by the background ticker. */
    public synchronized void tick() {
        long now = System.currentTimeMillis(); boolean changed = false;
        for (var o : orders.values()) {
            String st = (String) o.get("status");
            if (st.equals("DELIVERED") || st.equals("CANCELLED") || Boolean.TRUE.equals(o.get("manual"))) continue;
            long el = (now - ((Number) o.get("createdAt")).longValue()) / 1000;
            int target = 0; for (int i = 0; i < STAGE_AT.length; i++) if (el >= STAGE_AT[i]) target = i;
            if (target > STATUSES.indexOf(st)) { setStatus(o, STATUSES.get(target)); changed = true; }
        }
        if (changed) save();
    }

    @SuppressWarnings("unchecked")
    public void setStatus(Map<String, Object> o, String st) {
        o.put("status", st);
        ((List<Object>) o.computeIfAbsent("timeline", k -> new ArrayList<>())).add(Map.of("status", st, "at", System.currentTimeMillis()));
    }

    // -------------------------------------------------------------------- seed
    private Map<String, Object> item(String name, String desc, double price, String cat, boolean veg, String emoji, boolean pop) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id("m")); m.put("name", name); m.put("description", desc); m.put("price", price);
        m.put("category", cat); m.put("veg", veg); m.put("emoji", emoji); m.put("popular", pop);
        return m;
    }

    @SuppressWarnings("unchecked")
    private void rest(String name, String cuisine, String emoji, String hue, double rating, int eta, int fee, String tag, Map<String, Object>... items) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", id("r")); r.put("name", name); r.put("cuisine", cuisine); r.put("emoji", emoji); r.put("hue", hue);
        r.put("rating", rating); r.put("ratingCount", 120 + rnd.nextInt(900)); r.put("etaMinutes", eta); r.put("deliveryFee", fee);
        r.put("tag", tag); r.put("open", true); r.put("menu", new ArrayList<>(List.of(items)));
        restaurants.put((String) r.get("id"), r);
    }

    @SuppressWarnings("unchecked")
    private void seed() {
        secret = new byte[32]; rnd.nextBytes(secret);
        newUser("Admin", "admin@bytebite.dev", "Admin@123", "ADMIN");
        Map<String, Object> demo = newUser("Demo Customer", "user@bytebite.dev", "User@123", "CUSTOMER");
        rest("Spice Route", "Indian", "🍛", "28", 4.6, 28, 30, "Bestseller",
            item("Butter Chicken", "Creamy tomato gravy, charred chicken", 329, "Mains", false, "🍗", true),
            item("Paneer Tikka Masala", "Smoky paneer in rich masala", 289, "Mains", true, "🧀", true),
            item("Garlic Naan", "Tandoor-baked, brushed with butter", 59, "Breads", true, "🫓", false),
            item("Hyderabadi Biryani", "Dum-cooked basmati, saffron, raita", 349, "Rice", false, "🍚", true),
            item("Gulab Jamun", "Two warm syrup-soaked dumplings", 99, "Desserts", true, "🍮", false));
        rest("Napoli Slice", "Italian", "🍕", "8", 4.4, 32, 40, "Wood-fired",
            item("Margherita Pizza", "San Marzano, mozzarella, basil", 299, "Pizza", true, "🍕", true),
            item("Pepperoni Pizza", "Double pepperoni, chilli oil", 399, "Pizza", false, "🍕", true),
            item("Penne Arrabbiata", "Spicy tomato, garlic, parsley", 259, "Pasta", true, "🍝", false),
            item("Tiramisu", "Espresso-soaked, mascarpone", 179, "Desserts", true, "🍰", false));
        rest("Burger Forge", "American", "🍔", "38", 4.3, 22, 25, "Fast",
            item("Smash Burger", "Double patty, cheddar, pickles", 249, "Burgers", false, "🍔", true),
            item("Crispy Veg Burger", "Crunchy patty, chipotle mayo", 199, "Burgers", true, "🍔", false),
            item("Loaded Fries", "Cheese sauce, jalapeños", 149, "Sides", true, "🍟", true),
            item("Chocolate Shake", "Thick, hand-spun", 159, "Drinks", true, "🥤", false));
        rest("Tokyo Bowl", "Japanese", "🍣", "340", 4.7, 35, 45, "Top rated",
            item("Salmon Nigiri (6)", "Fresh Atlantic salmon", 449, "Sushi", false, "🍣", true),
            item("Veg Maki Roll", "Avocado, cucumber, carrot", 299, "Sushi", true, "🍙", false),
            item("Tonkotsu Ramen", "Rich pork broth, soft egg", 379, "Ramen", false, "🍜", true),
            item("Matcha Ice Cream", "Uji matcha, mochi", 169, "Desserts", true, "🍨", false));
        rest("Wok Express", "Chinese", "🥡", "130", 4.2, 26, 20, "Value",
            item("Hakka Noodles", "Wok-tossed with crunchy veg", 189, "Noodles", true, "🍜", true),
            item("Chilli Chicken", "Dry, fiery, spring onion", 269, "Starters", false, "🌶️", true),
            item("Veg Manchurian", "Crisp balls in garlic sauce", 199, "Starters", true, "🥟", false),
            item("Fried Rice", "Egg and vegetable", 179, "Rice", false, "🍚", false));
        rest("Taco Loco", "Mexican", "🌮", "50", 4.5, 24, 30, "New",
            item("Chicken Tacos (3)", "Corn tortillas, salsa verde", 279, "Tacos", false, "🌮", true),
            item("Bean Burrito", "Black beans, rice, guac", 229, "Burritos", true, "🌯", false),
            item("Nachos Supreme", "Queso, pico de gallo", 219, "Sides", true, "🧀", true));
        rest("Green Leaf", "Healthy", "🥗", "150", 4.5, 20, 20, "100% veg",
            item("Quinoa Power Bowl", "Roasted veg, chickpeas, tahini", 289, "Bowls", true, "🥗", true),
            item("Avocado Toast", "Sourdough, chilli flakes", 199, "Breakfast", true, "🥑", false),
            item("Cold-Pressed Juice", "Orange, carrot, ginger", 129, "Drinks", true, "🧃", false));
        rest("Sweet Tooth", "Desserts", "🧁", "320", 4.8, 18, 15, "Sweet",
            item("Belgian Waffle", "Nutella, strawberries", 219, "Waffles", true, "🧇", true),
            item("Red Velvet Cupcake", "Cream cheese frosting", 99, "Bakes", true, "🧁", false),
            item("Brownie Sundae", "Warm brownie, vanilla scoop", 189, "Sundaes", true, "🍨", true));
        // Back-fill two weeks of delivered orders so the admin analytics have history.
        List<Map<String, Object>> rs = new ArrayList<>(restaurants.values());
        LocalDate today = LocalDate.now(); String[] pay = {"UPI", "Card", "Cash"};
        for (int d = 13; d >= 0; d--) {
            int n = 3 + rnd.nextInt(5) + (13 - d) / 3 + (d % 7 == 0 ? 3 : 0);
            if (d == 0) n = Math.min(n, 4);
            for (int k = 0; k < n; k++) {
                var r = rs.get(rnd.nextInt(rs.size())); var menu = (List<Map<String, Object>>) r.get("menu");
                List<Object> its = new ArrayList<>(); double sub = 0;
                for (int j = 0, c = 1 + rnd.nextInt(3); j < c; j++) {
                    var it = menu.get(rnd.nextInt(menu.size())); int q = 1 + rnd.nextInt(2);
                    its.add(Map.of("itemId", it.get("id"), "name", it.get("name"), "price", it.get("price"), "qty", q, "emoji", it.get("emoji")));
                    sub += ((Number) it.get("price")).doubleValue() * q;
                }
                long ts = d == 0 ? System.currentTimeMillis() - (long) (60 + rnd.nextInt(600)) * 60_000L
                    : today.minusDays(d).atTime(11 + rnd.nextInt(11), rnd.nextInt(60)).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
                Map<String, Object> o = new LinkedHashMap<>();
                o.put("id", id("o")); o.put("userId", demo.get("id")); o.put("userName", demo.get("name"));
                o.put("restaurantId", r.get("id")); o.put("restaurantName", r.get("name")); o.put("restaurantEmoji", r.get("emoji"));
                o.put("items", its); o.put("subtotal", sub); o.put("discount", 0); o.put("deliveryFee", r.get("deliveryFee"));
                o.put("tax", Math.round(sub * 0.05)); o.put("tip", 0); o.put("total", sub + ((Number) r.get("deliveryFee")).doubleValue() + Math.round(sub * 0.05));
                o.put("address", "12 MG Road"); o.put("payment", pay[rnd.nextInt(3)]); o.put("status", "DELIVERED");
                o.put("createdAt", ts); o.put("timeline", new ArrayList<>(List.of(Map.of("status", "DELIVERED", "at", ts + 2_400_000))));
                orders.put((String) o.get("id"), o);
            }
        }
    }
}
