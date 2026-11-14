package com.bytebite;

import java.util.*;

/** Minimal JSON parser/serializer: Map, List, String, Double/Long, Boolean, null. */
public final class Json {
    private final String s; private int i;
    private Json(String s) { this.s = s; }

    public static Object parse(String text) {
        Json p = new Json(text); p.ws();
        Object v = p.value(); p.ws();
        if (p.i != text.length()) throw new IllegalArgumentException("Trailing JSON");
        return v;
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> obj(String text) {
        return (Map<String, Object>) parse(text == null || text.isBlank() ? "{}" : text);
    }

    private void ws() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }
    private char peek() { return s.charAt(i); }
    private void expect(char c) { if (s.charAt(i++) != c) throw new IllegalArgumentException("Expected " + c + " at " + (i - 1)); }

    private Object value() {
        ws();
        char c = peek();
        return switch (c) {
            case '{' -> object();
            case '[' -> array();
            case '"' -> string();
            case 't' -> { i += 4; yield Boolean.TRUE; }
            case 'f' -> { i += 5; yield Boolean.FALSE; }
            case 'n' -> { i += 4; yield null; }
            default -> number();
        };
    }

    private Map<String, Object> object() {
        Map<String, Object> m = new LinkedHashMap<>();
        expect('{'); ws();
        if (peek() == '}') { i++; return m; }
        while (true) {
            ws(); String k = string(); ws(); expect(':');
            m.put(k, value()); ws();
            if (peek() == ',') { i++; continue; }
            expect('}'); return m;
        }
    }

    private List<Object> array() {
        List<Object> l = new ArrayList<>();
        expect('['); ws();
        if (peek() == ']') { i++; return l; }
        while (true) {
            l.add(value()); ws();
            if (peek() == ',') { i++; continue; }
            expect(']'); return l;
        }
    }

    private String string() {
        expect('"');
        StringBuilder b = new StringBuilder();
        while (true) {
            char c = s.charAt(i++);
            if (c == '"') return b.toString();
            if (c == '\\') {
                char e = s.charAt(i++);
                switch (e) {
                    case 'n' -> b.append('\n'); case 't' -> b.append('\t'); case 'r' -> b.append('\r');
                    case 'b' -> b.append('\b'); case 'f' -> b.append('\f');
                    case 'u' -> { b.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; }
                    default -> b.append(e);
                }
            } else b.append(c);
        }
    }

    private Number number() {
        int st = i;
        while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
        String t = s.substring(st, i);
        if (t.isEmpty()) throw new IllegalArgumentException("Bad JSON at " + st);
        if (t.contains(".") || t.contains("e") || t.contains("E")) return Double.parseDouble(t);
        return Long.parseLong(t);
    }

    public static String write(Object o) { StringBuilder b = new StringBuilder(); w(b, o); return b.toString(); }

    private static void w(StringBuilder b, Object o) {
        switch (o) {
            case null -> b.append("null");
            case String t -> {
                b.append('"');
                for (char c : t.toCharArray()) {
                    switch (c) {
                        case '"' -> b.append("\\\""); case '\\' -> b.append("\\\\");
                        case '\n' -> b.append("\\n"); case '\r' -> b.append("\\r"); case '\t' -> b.append("\\t");
                        default -> { if (c < 32) b.append(String.format("\\u%04x", (int) c)); else b.append(c); }
                    }
                }
                b.append('"');
            }
            case Double d -> b.append(d.isNaN() || d.isInfinite() ? "0" : (d == Math.rint(d) && Math.abs(d) < 1e15 ? String.valueOf(d.longValue()) : d.toString()));
            case Number n -> b.append(n);
            case Boolean x -> b.append(x);
            case Map<?, ?> m -> {
                b.append('{'); boolean f = true;
                for (var e : m.entrySet()) { if (!f) b.append(','); f = false; w(b, String.valueOf(e.getKey())); b.append(':'); w(b, e.getValue()); }
                b.append('}');
            }
            case Collection<?> c -> {
                b.append('['); boolean f = true;
                for (Object x : c) { if (!f) b.append(','); f = false; w(b, x); }
                b.append(']');
            }
            default -> w(b, o.toString());
        }
    }
}
