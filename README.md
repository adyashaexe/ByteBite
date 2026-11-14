# 🍽️ ByteBite — Food Delivery Platform (Java 25)

A rebuilt, zero-dependency version of ByteBite. **No Maven, no Node, no npm, no Docker.** Just a JDK 25+.
The backend uses only the JDK (built-in HTTP server, virtual threads, records/pattern switches), and the frontend is a
dependency-free single-page app with heavy animation, served by the same process.

## Run it (macOS)

```bash
brew install --cask temurin@25      # once, if you don't have JDK 25
cd ByteBite
./run.sh                            # builds, starts, and opens http://localhost:8080
```

Works with **any JDK 25 or newer** (25 LTS, 26, …). The code is compiled with `--release 25`, so it targets the stable LTS Java API even when your JDK is newer.

If macOS blocks the script: `chmod +x run.sh`. Use another port with `PORT=9000 ./run.sh`.
Data is stored in `data/bytebite.json` (delete the folder to reset to fresh demo data).

## Demo logins
| Role | Email | Password |
|---|---|---|
| Admin | admin@bytebite.dev | Admin@123 |
| Customer | user@bytebite.dev | User@123 |

## Features
**Customers** — signup/login (PBKDF2 + signed tokens) · search by restaurant/cuisine/dish · cuisine chips, pure-veg filter, sort by rating/ETA/fee ·
favourites ❤️ · menus with categories, veg/non-veg marks, popular tags · fly-to-cart animation · cart drawer with quantity steppers ·
**promo codes** (BITE20, WELCOME50, FREESHIP) · courier tips · UPI/Card/Cash · **live order tracking** (animated courier, step timeline, auto-progress every few seconds) ·
cancel while placed · star reviews that update restaurant ratings · order history with one-click **reorder** · dark/light theme · confetti 🎉

**Admin dashboard** — animated KPI counters · 14-day revenue chart with hover tooltips · animated status donut · top restaurants & best sellers ·
**live orders table** (auto-refreshes, flashes changes, advance/cancel) · open/close restaurants · add/delete restaurants · full menu editor

**Responsive** — desktop nav, mobile bottom tab bar, safe-area aware, `prefers-reduced-motion` respected.

## Project layout
```
backend/src/com/bytebite/
  Main.java    HTTP server, routing, cart/order/admin logic
  Store.java   data, seeding, persistence, auth, order lifecycle engine
  Json.java    tiny JSON parser/writer
frontend/      index.html · style.css · app.js
run.sh / run.bat
```

## API (all under /api, JSON, `Authorization: Bearer <token>`)
`POST auth/signup|login` · `GET auth/me` · `GET promos` · `GET restaurants?q&cuisine&veg&sort` · `GET restaurants/{id}` · `POST restaurants/{id}/favorite` ·
`GET|DELETE cart` · `POST cart/add|promo|tip` · `PUT|DELETE cart/items/{id}` · `POST order/place` · `GET order/my` · `GET order/{id}` · `POST order/{id}/cancel|review` ·
admin: `GET admin/stats|orders` · `PUT admin/orders/{id}/status` · `POST|PUT|DELETE admin/restaurants[/{id}]` · `POST admin/restaurants/{id}/menu` · `PUT|DELETE admin/menu/{id}`

> Order statuses advance automatically (demo speed ≈ 55 s from placed to delivered). Admins can override manually.
