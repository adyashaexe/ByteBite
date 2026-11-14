
<div align="center">

# 🍽️ ByteBite

### A full-featured food delivery platform written in pure Java 25

<a href="https://bytebite-6ga1.onrender.com"><img src="https://img.shields.io/badge/🚀_Live_Demo-Open_ByteBite-2ea44f?style=for-the-badge" alt="Open ByteBite Live Demo" /></a>

**Browse restaurants · build a cart · place orders · track the courier live · run the business from an animated admin dashboard**

![Java](https://img.shields.io/badge/Java-25%20LTS%20(runs%20on%2025%2B)-orange?style=flat-square&logo=openjdk)
![Dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen?style=flat-square)
![Build](https://img.shields.io/badge/build-javac%20only-blue?style=flat-square)
![Frontend](https://img.shields.io/badge/frontend-vanilla%20JS-yellow?style=flat-square)
![License](https://img.shields.io/badge/license-Unlicense-lightgrey?style=flat-square)

[Quick Start](#-quick-start) · [Features](#-features) · [How It Works](#-how-it-works) · [API Reference](#-api-reference) · [Troubleshooting](#-troubleshooting)

</div>

---

## 📖 Table of Contents

1. [Overview](#-overview)
2. [Quick Start](#-quick-start)
3. [Requirements](#-requirements)
4. [Demo Accounts](#-demo-accounts)
5. [Features](#-features)
6. [How It Works](#-how-it-works)
7. [Pricing, Promos & Fees](#-pricing-promos--fees)
8. [Order Lifecycle](#-order-lifecycle)
9. [Admin Dashboard](#-admin-dashboard)
10. [Project Structure](#-project-structure)
11. [Configuration](#-configuration)
12. [API Reference](#-api-reference)
13. [Data & Persistence](#-data--persistence)
14. [Security](#-security)
15. [Trying the API with curl](#-trying-the-api-with-curl)
16. [Troubleshooting](#-troubleshooting)
17. [Limitations](#-limitations)
18. [License](#-license)

---

## 🌟 Overview

ByteBite is a complete online food delivery application. Customers can discover restaurants, search by name, cuisine or dish, add items to a cart, apply promo codes, pay with their preferred method, and watch their order move from the kitchen to their door on a live, animated tracker. Administrators get a real-time analytics dashboard and full control over restaurants, menus and orders.

The project is deliberately **dependency-free**:

| Concern | Solution |
| --- | --- |
| Language | Java 25 (LTS), compiled with `--release 25` so it also runs on newer JDKs |
| Web server | The JDK's built-in `com.sun.net.httpserver` with a virtual-thread-per-request executor |
| JSON | A small built-in parser/serializer (`Json.java`) |
| Auth | PBKDF2 password hashing + HMAC-SHA256 signed tokens (all from `javax.crypto`) |
| Storage | In-memory store with atomic JSON-file snapshots |
| Frontend | Plain HTML, CSS and JavaScript, no framework, no build step, no CDN |
| Build | `javac` (no Maven, Gradle, Node or npm) |

There is **nothing to download** besides a JDK. One command compiles and starts both the API and the website on a single port.

---

## 🚀 Quick Start

### macOS (recommended path)

```bash
# 1. Install a JDK once (skip if `javac -version` already shows 25 or newer)
brew install --cask temurin@25

# 2. Go to the project folder
cd ByteBite

# 3. Build and run (also opens your browser)
./run.sh
```

The app starts at **http://localhost:8080**.

If macOS reports *permission denied*, make the script executable first:

```bash
chmod +x run.sh
```

### Linux

```bash
cd ByteBite
./run.sh
```

### Windows

Double-click `run.bat`, or from a terminal:

```bat
run.bat
```

### Run manually without the script

```bash
cd ByteBite
mkdir -p out
javac --release 25 -d out backend/src/com/bytebite/*.java
java -Dstdout.encoding=UTF-8 -cp out com.bytebite.Main
```

> ⚠️ Always start the server **from the project root** (the folder containing `frontend/` and `backend/`). The server reads `frontend/` and writes `data/` relative to the current directory.

### What `run.sh` does

1. Locates a JDK: uses `JAVA_HOME` if set, otherwise asks macOS (`/usr/libexec/java_home`) for JDK 26 or 25, otherwise uses `javac` from your `PATH`.
2. Picks the `java` binary that belongs to the **same JDK** as `javac`, which prevents "class file version" mismatches when several Java versions are installed.
3. Verifies the JDK is version **25 or newer** and prints install instructions if not.
4. Compiles all sources with `--release 25` into `out/`.
5. Opens `http://localhost:8080` in your browser on macOS and starts the server.

---

## 📋 Requirements

| Requirement | Details |
| --- | --- |
| **JDK** | Version **25 or newer** (a full JDK with `javac`, not only a JRE). Tested approach: compile with `--release 25`; runs on 25 LTS, 26 and later. |
| **OS** | macOS, Linux or Windows |
| **Browser** | Any modern browser (Chrome, Safari, Firefox, Edge) |
| **Network** | Not required at runtime. The app makes no external requests. |
| **Disk** | A few MB. Data is stored in `data/bytebite.json`. |

Check your version:

```bash
javac -version     # e.g. javac 26.0.2.1  → fine
java -version
```

Installing a JDK:

```bash
brew install --cask temurin@25      # Homebrew (macOS)
sdk install java 25-tem             # SDKMAN (macOS / Linux)
```

---

## 🔐 Demo Accounts

Created automatically the first time the server starts.

| Role | Email | Password |
| --- | --- | --- |
| 🛠 **Admin** | `admin@bytebite.dev` | `Admin@123` |
| 🙋 **Customer** | `user@bytebite.dev` | `User@123` |

The login page also has one-click **Customer** and **Admin** demo buttons.

You can create your own customer account with **Sign up**. New accounts always get the `CUSTOMER` role.

---

## ✨ Features

### 🙋 For customers

**Discovery**
- Hero search bar with debounced live search across restaurant names, cuisines **and dish names**
- Cuisine filter chips generated from the available restaurants
- **Pure-veg** toggle (restaurants whose entire menu is vegetarian)
- Sorting by **top rated**, **fastest delivery**, **lowest delivery fee** or **A–Z**
- Favourite restaurants with an animated heart
- Closed restaurants are visibly greyed out and cannot be ordered from
- Clickable promo-code pills that copy the code to your clipboard

**Menus**
- Items grouped by category with quick-jump category chips
- Veg / non-veg markers (green dot / red triangle) and "🔥 Popular" tags
- Add-to-cart button that turns into a quantity stepper
- Fly-to-cart animation: the dish emoji arcs across the screen into the cart icon

**Cart & checkout**
- Slide-in cart drawer with quantity steppers and per-line totals
- One restaurant per cart (with a "start a new cart?" confirmation when switching)
- Promo codes with live validation messages (e.g. *"Add ₹40 more to use BITE20"*)
- Courier tip selector (None / ₹20 / ₹50 / ₹100)
- Delivery address (remembered between visits) and payment method: **UPI**, **Card** or **Cash**
- Full price breakdown: subtotal, discount, delivery, 5% tax, tip, total
- Clear-cart action with confirmation

**Orders**
- **Live tracking page** with an animated courier travelling between the restaurant and your home, a four-step timeline with timestamps, and status updates every two seconds
- Cancel an order while it is still in the *Placed* stage
- Leave a **1–5 star review** with a comment after delivery; ratings update the restaurant's average
- Full order history with status badges
- **One-click reorder**: rebuilds your cart from a previous order

**Experience**
- Dark and light themes (remembered between visits)
- Confetti when an order is placed and when it arrives
- Toast notifications, modals, keyboard support (<kbd>Esc</kbd> closes drawers and dialogs)

### 🛠 For administrators

- **Analytics dashboard** with animated KPI counters, a 14-day revenue chart, an order-status donut, top restaurants and best sellers
- **Live orders table** that refreshes every 3 seconds and highlights changed rows
- Advance an order to its next status or cancel it with one click
- **Restaurant management**: create restaurants, open/close them with a toggle, delete them
- **Menu editor**: add and delete menu items (name, price, category, emoji, description, veg flag)

### 🎨 Design & motion

- Animated aurora background, glass-morphism surfaces and gradient accents
- Staggered entrance animations on every list and grid
- 3D tilt and spotlight effect on restaurant cards that follows the cursor
- Rotating hero headline (pizza → biryani → sushi → …) with a matching floating emoji
- Skeleton loaders while data loads
- Animated number count-ups, a draw-on line chart, growing bar charts and a sweeping donut
- Pulsing "current step" indicator and a bobbing courier on the tracker
- Respects the operating system's **reduced-motion** setting

### 📱 Responsive

- Fluid grids that reflow from large desktops to small phones
- Top navigation on desktop, a floating **bottom tab bar** on mobile
- Safe-area aware layout (notched iPhones), horizontally scrolling chip rows and tables
- Touch-friendly controls

---

## 🧠 How It Works

### Architecture

```
┌──────────────────────────┐        HTTP / JSON         ┌────────────────────────────────────┐
│   Browser (SPA)          │  ───────────────────────▶  │  com.sun.net.httpserver            │
│   index.html             │  ◀───────────────────────  │  virtual-thread executor           │
│   style.css  app.js      │       Bearer token         │                                    │
└──────────────────────────┘                            │  /api/*  → Main.route()            │
                                                        │  /*      → static files (frontend) │
                                                        │                                    │
                                                        │  Store (in-memory, one lock)       │
                                                        │   ├─ users, restaurants (+menus)   │
                                                        │   ├─ carts, orders                 │
                                                        │   ├─ auth (PBKDF2 + HMAC tokens)   │
                                                        │   └─ order engine (2 s ticker)     │
                                                        │             │                      │
                                                        │             ▼                      │
                                                        │      data/bytebite.json            │
                                                        └────────────────────────────────────┘
```

- **One process, one port.** The same server handles `/api/...` calls and serves the web app.
- **Virtual threads.** Every request runs on its own virtual thread, so the server stays lightweight under load.
- **Single-lock store.** All state changes happen under one lock, which keeps the logic simple and race-free.
- **Background ticker.** A virtual thread wakes every two seconds and advances orders through their lifecycle.
- **Single-page app.** The frontend uses hash routing (`#/…`), so refreshing any page works without server-side routing.

### Frontend routes

| Route | Page | Access |
| --- | --- | --- |
| `#/` | Discover restaurants | Public |
| `#/r/{restaurantId}` | Restaurant & menu | Public (login required to add items) |
| `#/login` | Log in / Sign up | Public |
| `#/orders` | Order history | Customer / Admin |
| `#/track/{orderId}` | Live order tracking | Order owner / Admin |
| `#/admin` | Admin dashboard | Admin only |

Visiting a protected route while logged out sends you to the login page and returns you to where you were afterwards.

### Seed data

On first start the server creates:

- 2 users (admin and customer)
- **8 restaurants** with **30 menu items** across Indian, Italian, American, Japanese, Chinese, Mexican, Healthy and Dessert cuisines: *Spice Route, Napoli Slice, Burger Forge, Tokyo Bowl, Wok Express, Taco Loco, Green Leaf, Sweet Tooth*
- **About two weeks of historical delivered orders**, so the dashboard charts have meaningful data immediately

All prices are in Indian Rupees (₹).

---

## 💰 Pricing, Promos & Fees

All totals are calculated **on the server**. The browser only displays them.

```
total = subtotal − discount + delivery fee + tax + tip
```

| Component | Rule |
| --- | --- |
| **Subtotal** | Sum of `price × quantity` for each cart line |
| **Delivery fee** | Set per restaurant (₹15–₹45 in the demo data). Free if `FREESHIP` applies. |
| **Tax** | 5% of the subtotal, rounded to the nearest rupee |
| **Tip** | Chosen by the customer, clamped between ₹0 and ₹500 by the server |
| **Discount** | From the active promo code (see below) |

### Promo codes

| Code | Benefit | Minimum subtotal |
| --- | --- | --- |
| `BITE20` | 20% off, capped at **₹150** | ₹200 |
| `WELCOME50` | Flat **₹50** off | ₹300 |
| `FREESHIP` | **Free delivery** | ₹150 |

If the subtotal is below a code's minimum, the code stays attached to the cart but gives no discount, and the cart shows how much more to add.

### Cart rules

- A cart holds items from **one restaurant** only. Adding from another restaurant returns a conflict (HTTP 409) and the UI asks whether to replace the cart.
- Maximum **20** of any single item.
- Items removed from a menu by an admin disappear from carts automatically.
- Closed restaurants cannot be added to or ordered from.

---

## 🛵 Order Lifecycle

```
PLACED ──► PREPARING ──► OUT_FOR_DELIVERY ──► DELIVERED
   │
   └──► CANCELLED   (customer: only while PLACED · admin: any time before delivery)
```

### Automatic progression (demo speed)

A background ticker runs every 2 seconds and moves each active order forward based on the time since it was placed:

| Elapsed time | Status |
| --- | --- |
| 0 s | `PLACED` |
| 12 s | `PREPARING` |
| 30 s | `OUT_FOR_DELIVERY` |
| 55 s | `DELIVERED` |

The tracker animates the courier smoothly along the route during the delivery stage.

### Manual control

When an admin changes an order's status manually, the order is flagged as manually managed and **automatic progression stops** for that order. This lets you walk an order through each stage at your own pace during a demo.

### Reviews

- Allowed only after an order is `DELIVERED`, and only once per order
- Rating must be 1–5; the comment is optional
- The restaurant's rating becomes the running average of all ratings, rounded to one decimal

To use realistic delivery times, change the `STAGE_AT` array in `Store.java` (values are seconds), for example `{0, 300, 900, 1800}`, and adjust the "55 seconds" figures used by the tracker text in `app.js`.

---

## 📊 Admin Dashboard

Sign in as the admin and open **Dashboard**.

| Section | What it shows |
| --- | --- |
| **KPI cards** | Total revenue, total orders, active orders, customers, average order value, with animated counters |
| **Revenue chart** | Smooth area/line chart of the last 14 days with hover tooltips (date, revenue, order count) |
| **Order status donut** | Distribution of orders across Placed, Preparing, On the way, Delivered and Cancelled |
| **Top restaurants** | Revenue per restaurant as animated bars |
| **Best sellers** | Most-ordered dishes by quantity |
| **Live orders** | The latest orders with customer, restaurant, total, status and quick actions |
| **Restaurants** | Open/close toggle, menu editor and delete for every restaurant, plus **Add restaurant** |

The dashboard refreshes itself every 3 seconds. KPI numbers count up to their new values, changed rows flash, and the charts redraw when new orders arrive. Cancelled orders are excluded from revenue and order totals.

---

## 📁 Project Structure

```
ByteBite/
├── backend/
│   └── src/com/bytebite/
│       ├── Main.java      # HTTP server, routing, validation, cart/order/admin logic, analytics
│       ├── Store.java     # In-memory data, seed data, persistence, auth helpers, order engine
│       └── Json.java      # Minimal JSON parser and serializer
├── frontend/
│   ├── index.html         # App shell
│   ├── style.css          # Theme, layout, animations, responsive rules
│   └── app.js             # Router, views, cart drawer, tracker, charts, effects
├── data/                  # Created at runtime (bytebite.json)
├── out/                   # Compiled classes (created by run.sh)
├── run.sh                 # macOS / Linux launcher
├── run.bat                # Windows launcher
├── .gitignore
└── README.md
```

### File responsibilities

| File | Responsibility |
| --- | --- |
| `Main.java` | Starts the server and ticker, serves static files, authenticates each request, routes `METHOD path` keys to handlers, calculates cart totals, places orders, computes dashboard statistics |
| `Store.java` | Holds all collections, loads/saves the JSON snapshot atomically, hashes passwords, signs and verifies tokens, seeds demo data, runs the order status engine |
| `Json.java` | Parses JSON into `Map`/`List`/`String`/`Number`/`Boolean` and writes them back |
| `app.js` | Hash router, API client, home/restaurant/orders/tracking/auth/admin views, cart drawer, confetti, fly-to-cart, charts |
| `style.css` | CSS variables for dark/light themes, glass surfaces, keyframe animations, mobile layout |

---

## ⚙️ Configuration

| Setting | How | Default |
| --- | --- | --- |
| **Port** | `PORT` environment variable | `8080` |
| **Data file** | Fixed at `data/bytebite.json` (edit `Main.java` to change) | — |
| **Delivery speed** | `STAGE_AT` in `Store.java` | `0, 12, 30, 55` seconds |
| **Promo codes** | `PROMOS` map in `Store.java` | `BITE20`, `WELCOME50`, `FREESHIP` |
| **Tax rate** | `0.05` in `Main.cartView` and the seed in `Store.java` | 5% |
| **Token lifetime** | `7L * 86400_000` in `Store.token()` | 7 days |

Examples:

```bash
PORT=9000 ./run.sh                 # use another port
```

### Resetting the data

Stop the server, delete the `data/` folder and start again. Fresh demo data is generated.

```bash
rm -rf data
./run.sh
```

---

## 🔌 API Reference

- **Base path:** `/api`
- **Format:** JSON requests and responses (`Content-Type: application/json`)
- **Auth:** send `Authorization: Bearer <token>` on protected routes
- **Errors:** always `{ "error": "message" }` with an appropriate HTTP status

| Status | Meaning |
| --- | --- |
| `200` | Success |
| `400` | Invalid input or rule violation |
| `401` | Missing, invalid or expired token |
| `403` | Not allowed (wrong role or someone else's order) |
| `404` | Not found |
| `409` | Conflict (email already registered, cart from another restaurant) |
| `500` | Unexpected server error |

### Authentication

| Method | Endpoint | Auth | Body | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | Public | `{ name, email, password }` | Create a customer account. Name ≥ 2 characters, valid email, password ≥ 6 characters. Returns `{ token, user }`. |
| `POST` | `/api/auth/login` | Public | `{ email, password }` | Log in. Returns `{ token, user }`. |
| `GET` | `/api/auth/me` | Token | — | Current user profile (including `favs`). |

### Restaurants & promos

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/restaurants` | Public | List restaurants. Query: `q` (text), `cuisine`, `veg=1` (pure-veg only), `sort` = `rating` \| `eta` \| `fee` \| `name`. |
| `GET` | `/api/restaurants/{id}` | Public | Restaurant details **with full menu**. |
| `POST` | `/api/restaurants/{id}/favorite` | Token | Toggle favourite. Returns `{ favs }`. |
| `GET` | `/api/promos` | Public | Available promo codes and their rules. |

### Cart

| Method | Endpoint | Auth | Body | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/api/cart` | Token | — | Current cart with computed totals. |
| `POST` | `/api/cart/add` | Token | `{ itemId, qty?, replace? }` | Add an item. Returns `409` if the cart holds another restaurant's items, unless `replace: true`. |
| `PUT` | `/api/cart/items/{itemId}` | Token | `{ qty }` | Set quantity (`0` removes the item). |
| `DELETE` | `/api/cart/items/{itemId}` | Token | — | Remove one item. |
| `DELETE` | `/api/cart` | Token | — | Empty the cart. |
| `POST` | `/api/cart/promo` | Token | `{ code }` | Apply a promo code (empty string clears it). |
| `POST` | `/api/cart/tip` | Token | `{ tip }` | Set the courier tip (₹0–₹500). |

The cart response looks like:

```json
{
  "restaurant": { "id": "r140", "name": "Sweet Tooth", "emoji": "🧁", "eta": 18 },
  "items": [ { "itemId": "m137", "name": "Belgian Waffle", "price": 219, "qty": 2, "emoji": "🧇", "veg": true } ],
  "count": 2, "subtotal": 438, "discount": 87, "deliveryFee": 15,
  "tax": 22, "tip": 0, "promo": "BITE20", "promoNote": null, "total": 388
}
```

### Orders

| Method | Endpoint | Auth | Body | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/api/order/place` | Token | `{ address, payment, note? }` | Place an order from the cart. Address ≥ 5 characters; payment is `UPI`, `Card` or `Cash`. |
| `GET` | `/api/order/my` | Token | — | Your orders, newest first. |
| `GET` | `/api/order/{id}` | Token | — | One order (owner or admin). Includes `timeline`. |
| `POST` | `/api/order/{id}/cancel` | Token | — | Cancel (only while `PLACED`). |
| `POST` | `/api/order/{id}/review` | Token | `{ rating, comment? }` | Review a delivered order (once). |

### Admin (role `ADMIN` required)

| Method | Endpoint | Body | Description |
| --- | --- | --- | --- |
| `GET` | `/api/admin/stats` | — | Dashboard statistics (revenue, orders, active, customers, average order, 14-day series, status counts, top items, top restaurants). |
| `GET` | `/api/admin/orders` | — | All orders, newest first (up to 200). |
| `PUT` | `/api/admin/orders/{id}/status` | `{ status }` | Set `PLACED`, `PREPARING`, `OUT_FOR_DELIVERY`, `DELIVERED` or `CANCELLED`. Stops automatic progression for that order. |
| `POST` | `/api/admin/restaurants` | `{ name, cuisine?, emoji?, etaMinutes?, deliveryFee?, tag? }` | Create a restaurant. |
| `PUT` | `/api/admin/restaurants/{id}` | any of `name, cuisine, emoji, tag, etaMinutes, deliveryFee, open` | Update a restaurant. |
| `DELETE` | `/api/admin/restaurants/{id}` | — | Delete a restaurant and its menu. |
| `POST` | `/api/admin/restaurants/{id}/menu` | `{ name, price, category?, emoji?, description?, veg? }` | Add a menu item. |
| `PUT` | `/api/admin/menu/{itemId}` | any of `name, description, category, emoji, price, veg` | Update a menu item. |
| `DELETE` | `/api/admin/menu/{itemId}` | — | Delete a menu item. |

### Order object

```json
{
  "id": "o235",
  "userId": "u101", "userName": "Demo Customer",
  "restaurantId": "r140", "restaurantName": "Sweet Tooth", "restaurantEmoji": "🧁",
  "items": [ { "itemId": "m137", "name": "Belgian Waffle", "price": 219, "qty": 1, "emoji": "🧇", "veg": true } ],
  "subtotal": 318, "discount": 0, "deliveryFee": 15, "tax": 16, "tip": 0, "total": 349, "promo": null,
  "address": "12 Ring Road, Cuttack", "payment": "UPI",
  "status": "PREPARING", "createdAt": 1763100000000,
  "timeline": [ { "status": "PLACED", "at": 1763100000000 }, { "status": "PREPARING", "at": 1763100012000 } ],
  "review": null
}
```

---

## 💾 Data & Persistence

- All data lives in memory for speed and is **saved to `data/bytebite.json`** after every change that matters (orders, cart, favourites, admin edits, status progression).
- Saves are **atomic**: the file is written to a temporary file and then moved into place, so a crash cannot leave a half-written database.
- On startup the file is loaded; if it does not exist, demo data is generated and saved.
- The file also stores the **token signing secret** and the ID counter, so logins survive restarts.
- To back up your data, copy `data/bytebite.json`. To reset, delete the `data/` folder.

---

## 🛡 Security

| Area | Implementation |
| --- | --- |
| **Passwords** | PBKDF2-HMAC-SHA256, 60,000 iterations, random 16-byte salt per user, constant-time comparison |
| **Sessions** | Compact signed tokens (`payload.signature`) using HMAC-SHA256 with a random 256-bit secret; 7-day expiry; verified on every request |
| **Authorization** | Role checks for `/api/admin/*`; order access limited to the owner or an admin |
| **Input validation** | Server-side checks for names, emails, passwords, addresses, payment methods, quantities, tips and ratings |
| **Output safety** | The frontend escapes all user-provided text before rendering |
| **Path safety** | Static file serving normalizes paths and refuses anything outside `frontend/` |
| **Pricing** | All amounts are computed server-side; the client cannot set prices or discounts |

> This project is designed for local use, demos and learning. See [Limitations](#-limitations) before exposing it to the internet.

---

## 🧪 Trying the API with curl

```bash
# Log in and capture a token
TOKEN=$(curl -s -X POST localhost:8080/api/auth/login \
  -d '{"email":"user@bytebite.dev","password":"User@123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# Search restaurants for "biryani"
curl -s "localhost:8080/api/restaurants?q=biryani"

# Pick a menu item, add two to the cart, apply a promo
curl -s -X POST localhost:8080/api/cart/add   -H "Authorization: Bearer $TOKEN" -d '{"itemId":"m103","qty":2}'
curl -s -X POST localhost:8080/api/cart/promo -H "Authorization: Bearer $TOKEN" -d '{"code":"BITE20"}'

# Place the order
curl -s -X POST localhost:8080/api/order/place -H "Authorization: Bearer $TOKEN" \
  -d '{"address":"221B Baker Street","payment":"UPI"}'

# Watch it progress
curl -s localhost:8080/api/order/my -H "Authorization: Bearer $TOKEN"
```

> Item and restaurant IDs are generated when the data is first created. Fetch `GET /api/restaurants/{id}` to see real menu item IDs for your database.

---

## 🩺 Troubleshooting

| Problem | Fix |
| --- | --- |
| `./run.sh: Permission denied` | Run `chmod +x run.sh`, then `./run.sh` again. |
| `No JDK found` | Install one: `brew install --cask temurin@25`, then open a new terminal. |
| `Found JDK 21, but ByteBite needs JDK 25 or newer` | Install JDK 25+. If several JDKs are installed, set one explicitly: `export JAVA_HOME=$(/usr/libexec/java_home -v 25)` |
| `javac: command not found` but `java` works | You have a JRE only. Install a full JDK. |
| `UnsupportedClassVersionError` | The `java` runtime is older than the `javac` that compiled the code. Use `./run.sh` (it matches them) or set `JAVA_HOME`. |
| `Address already in use` | Another program uses port 8080. Run `PORT=9000 ./run.sh`, or stop the other program. |
| Page shows *"Frontend not found. Run from the project root."* | Start the server from the `ByteBite` folder (the one containing `frontend/`). |
| Browser doesn't open automatically | Open **http://localhost:8080** manually. |
| Emoji show as `??` in the terminal | Cosmetic only. The launcher already sets UTF-8; some terminals still can't display emoji. The website is unaffected. |
| Logged out unexpectedly | Tokens expire after 7 days, and deleting `data/` creates a new signing secret. Log in again. |
| Orders don't advance | Orders changed manually by an admin stop auto-advancing. Use **Advance ▶** on the dashboard. |
| Want a clean slate | `rm -rf data` and restart. |
| Windows script closes immediately | Open a terminal and run `run.bat` there to read the message. Make sure `javac` is on your `PATH`. |

---

## ⚠️ Limitations

ByteBite is built for learning, demos and local use. Before using it in production you would want to add:

- **HTTPS** (the built-in server speaks plain HTTP; put it behind a reverse proxy such as Caddy or nginx)
- **Rate limiting and brute-force protection** on login
- **A real database** (the in-memory store with a JSON snapshot suits small data sets and a single instance)
- **A real payment provider** (payment methods are recorded but no money moves)
- **Real couriers and maps** (tracking is simulated from elapsed time)
- Email/SMS notifications and password reset

---

## 📄 License

Released into the public domain under the [Unlicense](https://unlicense.org/). Use it, change it, and ship it however you like.

---

<div align="center">

Built with ☕ and Java 25

</div>
