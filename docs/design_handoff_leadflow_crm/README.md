# Handoff: Leadflow — Mini CRM Modernization

## Overview
Leadflow is a modern, SaaS-style redesign of a mini CRM for handling inbound **legal leads** (lead masuk via WhatsApp, Instagram, Email, Webchat, LINE → AI mengumpulkan info → diserahkan ke tim legal). It replaces a bare HTML table + plain chat page with a unified, friendly three-pane workspace inspired by Mekari Qontak.

Two main views:
1. **Inbox** — icon rail · lead list · conversation/chat · lead detail panel.
2. **Lead Detail (full page)** — a rich profile page for a single lead.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing the intended look, layout, and behavior. They are **not production code to copy directly**.

The prototype is authored as a "Design Component" (`.dc.html`) that uses a custom streaming runtime (`support.js`) with `<sc-for>` / `<sc-if>` template directives and a `class Component extends DCLogic` logic class. **Do not port this runtime.** Instead, **recreate the designs in the target codebase's existing environment** (React, Vue, etc.) using its established component patterns, state management, and styling approach. If no frontend environment exists yet, React + a utility CSS or CSS-modules setup is a good fit for this layout.

All styling in the prototype is inline. Treat the **Design Tokens** section below as the source of truth and map it to the target app's design system.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, radii, and interactions are intentional. Recreate the UI faithfully using the codebase's existing libraries and patterns. Exact hex values, sizes, and copy are documented below.

---

## Design Tokens

### Colors
| Token | Hex | Usage |
|---|---|---|
| Primary blue | `#2A6BFF` | Brand, active nav, links, primary actions |
| Primary blue (grad end) | `#3D7BFF` | Gradient pair for header/buttons |
| Primary deep | `#1B4DDB` | User avatar |
| Primary tint | `#EAF1FF` | Active nav bg, info chips, secondary button bg |
| Page bg | `#EEF1F8` | App background |
| Chat pane bg | `#F4F6FC` | Conversation area |
| Surface white | `#FFFFFF` | Cards, panels, bars |
| Tinted surface | `#F7F9FD` | Inset conversation box on detail page |
| Control bg | `#F1F4FB` | Segmented control track, composer icon buttons |
| Border | `#E6EAF3` | Pane dividers |
| Border (card) | `#ECEFF6` | Card borders |
| Border (input) | `#E3E8F3` | Inputs, selects, outline buttons |
| Divider (subtle) | `#EFF2F8` / `#EEF1F8` | In-panel section dividers, progress track |
| Text strong | `#16203A` | Headings |
| Text primary | `#1B2741` | Body/values |
| Text secondary | `#41506E` | Controls, labels |
| Text muted | `#5C6A88` / `#7C89A8` | Sub-labels |
| Text faint | `#97A2BC` / `#A6B0C8` | Timestamps, captions |

### Status colors (badge bg / text)
| Status key | Label (ID) | bg | text |
|---|---|---|---|
| `new` | Baru | `#EAF1FF` | `#2A6BFF` |
| `qualifying` | Kualifikasi | `#FFF3E0` | `#E8870B` |
| `ready_for_handover` | Siap Handover | `#E9F7EF` | `#16A45E` |
| `handover` | Diserahkan | `#F0EBFF` | `#7B52E0` |
| `closed` | Selesai | `#EEF1F8` | `#7C89A8` |

### Channel colors (presence dot)
| Channel | Label | Color |
|---|---|---|
| `whatsapp` | WhatsApp | `#25D366` |
| `instagram` | Instagram | `#E1306C` |
| `email` | Email | `#EA4335` |
| `webchat` | Webchat | `#2A6BFF` |
| `line` | LINE | `#06C755` |

### Avatar palette (cycled by lead index)
`#2A6BFF`, `#7B52E0`, `#E8870B`, `#16A45E`, `#E1306C`, `#0EA5C4`, `#EC4899`

### Confidence meter color thresholds
- `conf >= 0.75` → green `#16A45E`
- `0.55 <= conf < 0.75` → amber `#E8870B`
- `conf < 0.55` → red `#E15050`

### Typography
- Font family: **Plus Jakarta Sans** (Google Fonts), weights 400/500/600/700/800; fallback `system-ui, sans-serif`.
- `-webkit-font-smoothing: antialiased`.
- Scale used: page/section titles 18–22px/800; card headers 14–15px/800; lead name 13.5px/700; values 13–13.5px/700; body/messages 13.5px/500; labels 11–12.5px/600; captions/timestamps 10–11px/600. Heading letter-spacing −.3 to −.4px.

### Spacing / radius / shadow
- Radii: inputs/buttons 9–11px; chips 7px; pills 20px; cards 18px; avatars 12–26px (rounded squares), user avatar 50%.
- Card shadow: `0 6px 22px rgba(28,44,90,.05)`; header bar `0 2px 12px rgba(42,107,255,.25)`; primary button `0 3px 10px rgba(42,107,255,.3)`.
- Common gaps: 8–12px within rows, 20px between cards, 18–22px card padding.

---

## Screens / Views

### Global chrome (persistent on both views)

**Top bar** — height 60px, full-width gradient `linear-gradient(90deg,#2A6BFF,#3D7BFF)`, shadow `0 2px 12px rgba(42,107,255,.25)`.
- Left: logo mark (34px rounded square, `rgba(255,255,255,.18)` bg, document/list SVG) + wordmark "Leadflow" (17px/800 white).
- Center-left: global search input, max-width 420px, 38px tall, `rgba(255,255,255,.16)` bg, search icon, placeholder "Cari lead, perusahaan, atau percakapan…", white text.
- Right: white "Lead Baru" button (blue text, plus icon) + user avatar (36px circle, `#1B4DDB`, initial "N", 2px translucent ring).

**Icon rail** — width 76px, white, right border `#E6EAF3`, vertical stack, 14px padding.
- Items (icon 22px + 10px/600 label, 60px wide, 12px radius): **Inbox** (active: `#EAF1FF` bg / `#2A6BFF`), **Leads**, **Laporan**. Inactive color `#8A97B4`.
- Pinned to bottom: **Atur** (settings gear).
- NOTE: a "Broadcast" item was intentionally removed — do not add it back.

---

### View 1 — Inbox

Layout: `flex` row filling viewport below top bar → [icon rail 76px] · [lead list 360px] · [chat flex:1] · [detail panel 320px].

**A. Lead list pane** (360px, white, right border):
- Header: title "Leads" (18px/800) + count "{n} percakapan" (right, muted).
- Segmented tabs in a `#F1F4FB` track (4px padding, 11px radius): **Semua**, **Aktif**, **Baru**. Active tab = white pill, `#2A6BFF` text, shadow `0 1px 4px rgba(28,44,90,.12)`, with a count pill.
  - "Aktif" = status not `closed` and not `handover`. "Baru" = status `new`.
- Two filter `<select>`s (36px, `#E3E8F3` border, 9px radius, custom chevron): **Industry** (Semua industry / Manufaktur / Retail / Konstruksi / Properti) and **Status** (Semua status / Baru / Kualifikasi / Siap Handover / Diserahkan / Selesai).
- Scrollable list of lead rows. Each row (12px padding, 14px radius, clickable):
  - Avatar 46px rounded-square (palette color, white initial) with a channel presence dot (16px, channel color, 2.5px white border) bottom-right.
  - Name (13.5px/700, ellipsis) + time (right, 11px/600 faint).
  - Company (12px/600 `#5C6A88`).
  - Message preview (12px `#8592AC`, ellipsis).
  - Status badge (20px, 7px radius, status colors) + industry label.
  - Selected row: bg `#F0F5FF` + inset left bar `inset 3px 0 0 #2A6BFF`.

**B. Chat pane** (flex, bg `#F4F6FC`):
- Header (64px, white, bottom border): lead avatar 42px, name (15.5px/800) + status badge, sub-line "{channel dot} {channel} · {company}". Right: green "Tandai Selesai" button (`#E9F7EF`/`#16A45E`, check icon) + 38px outline "more" (3-dot) button.
- Messages area (scroll, 22px/26px padding): centered "Hari ini" date chip (`#E7ECF7` pill). Bubbles:
  - **Them** (incoming): left-aligned, white bg, 1px `#ECEFF6` border, radius `16px 16px 16px 4px`, text `#27324C`.
  - **Us** (outgoing): right-aligned, `linear-gradient(135deg,#2A6BFF,#3D7BFF)`, white text, radius `16px 16px 4px 16px`.
  - Max-width 74%, 13.5px/500, shadow `0 2px 8px rgba(28,44,90,.06)`, time line under text (10px/600). Entry animation `lfpop` (opacity + 6px translateY, .25s).
- Composer (white card, 16px radius, 1px border): 2-row `<textarea>` placeholder "Tulis balasan…  Tekan Enter untuk kirim"; toolbar row with emoji / attach / Template buttons (34px, `#F1F4FB`) and a gradient **Kirim** button (send icon).

**C. Lead detail panel** (320px, white, left border, scroll):
- Centered header: avatar 72px (rounded 22px), name (16px/800), company. Two buttons: outline "Telepon" + filled-tint "**Lihat Profil Lengkap**" (`#EAF1FF`/`#2A6BFF`) → **navigates to View 2**.
- "Skor Keyakinan AI": label + colored % + 8px progress bar (`#EEF1F8` track, gradient fill at conf%, color by threshold).
- "Informasi Lead": four rows (icon tile 32px + label/value): Industry, Kebutuhan Hukum, Kanal Masuk, Status.
- "Tag": pill chips (each `{color}1A` bg / `{color}` text, 20px radius) + dashed "+ Tambah".
- "Catatan": yellow note box (`#FFF9EC` bg, `#FBE4BC` border, `#7A6322` text).
- "Agen Penanggung Jawab": 36px circle avatar "N" + "Nadia (Anda)" + green "● Online".

---

### View 2 — Lead Detail (full page)

Replaces the [list · chat · detail] panes (icon rail stays). Scroll container, page bg `#EEF1F8`.

- **Sub-header** (white, sticky, 14px/28px padding): "Kembali" outline button (chevron-left) → back to Inbox; breadcrumb "Leads / {name}".
- Content wrapper: `max-width: 1080px`, centered, 24px/28px padding.

- **Hero card** (white, 18px radius, 24px padding, flex): avatar 88px (rounded 26px, 34px initial); name (22px/800) + status badge; company (14px/600); meta row "{channel dot} {channel}" · "Masuk {created}". Right actions: outline "Buka Chat" (→ back to Inbox) + gradient "Serahkan ke Tim".

- **Two-column grid** below: `grid-template-columns: 1fr 340px; gap: 20px; align-items: start`.

  **Left column** (stacked cards, 20px gap):
  - **Informasi Lead** — 2-col grid (`1fr 1fr`, 20px/18px gap) of 6 fields, each = 40px icon tile (status/category colored) + label/value: Industry, Kebutuhan Hukum, Status, Kanal Masuk, Tanggal Masuk, Sumber Lead.
  - **Riwayat Percakapan** — header + "Buka di Inbox →" link; inset box (`#F7F9FD` bg, `#EEF1F8` border, 14px radius, max-height 300px scroll) rendering the same message bubbles as the chat pane.
  - **Riwayat Aktivitas** — vertical timeline. Each item: a colored dot (11px, 3px white border + `{color}55` ring) with a 2px `#E6EAF3` connector line, then title (13.5px/700) + desc (12.5px `#7C89A8`) + time (11px/600 faint). Generated steps: "Lead masuk (Melalui {channel})" → "AI mengumpulkan info" → "Skor keyakinan {pct}" → "Status: {label}".

  **Right column** (stacked cards, 20px gap):
  - **Skor Keyakinan AI** — large % (22px/800, threshold color) + 10px progress bar + caption "Estimasi kualitas lead berdasarkan kelengkapan data & sinyal percakapan."
  - **Kontak** — four rows (36px neutral icon tile `#F1F4FB`/`#5C6A88` + label/value): Nomor Telepon, Email, Lokasi, Website.
  - **Tag** — same chips as detail panel + "+ Tambah".
  - **Catatan** — yellow note box.
  - **Agen Penanggung Jawab** — 38px avatar + name + online status.

---

## Interactions & Behavior
- **Open detail**: "Lihat Profil Lengkap" (inbox detail panel) sets `view = 'detail'`.
- **Back to inbox**: "Kembali", "Buka Chat", "Buka di Inbox →" set `view = 'inbox'`. Inbox/Leads rail items also return to inbox.
- **Select lead**: clicking a list row sets `selectedId`; chat, detail panel, and full detail page all derive from the selected lead.
- **Tabs**: filter the list by activity (`all` / `open` / `unassigned`).
- **Filters**: industry + status `<select>`s further narrow the list (combined with the active tab).
- **Send message**: trims the composer draft, appends an outgoing message (`who:'us'`, time "Sekarang") to the selected lead's thread, clears the input. (Prototype keeps appended messages in component state per lead id; in production, persist via API.)
- **Animations**: message bubbles use the `lfpop` keyframe on mount. Buttons are static; add hover states per the app's conventions (suggested: slight bg darken on primary, `#F7F9FD` on outline).
- **Responsive**: prototype targets desktop (fixed pane widths). For narrower viewports, collapse the right detail panel first, then the lead list into a drawer; the full detail page two-column grid should stack to one column under ~900px.

## State Management
- `view`: `'inbox' | 'detail'`.
- `selectedId`: id of the active lead.
- `tab`: `'all' | 'open' | 'unassigned'`.
- `industryFilter`: industry string or `'Semua industry'`.
- `statusFilter`: status key or `'all'`.
- `draft`: composer text.
- `extraMsgs`: map of `leadId → [appended messages]` (prototype-only; replace with real message persistence).
- Derived per lead (computed, not stored): status label/badge style, channel label/color, confidence %/color/bar, avatar styles, contact info, timeline, profile fields. See the `decorate()` method in the HTML for the exact derivation logic.

### Data model (per lead)
`id, name, company, industry, need, status, conf (0–1), channel, time, preview, note, tags:[{t,c}], messages:[{who:'them'|'us', text, time}]`. Contact/timeline/profile fields are generated in `decorate()` — in production these come from the backend.

## Assets
- **Icons**: all inline SVG (stroke-based, 22/18/16/14px). No icon library required; map to the app's existing icon set (Lucide/Heroicons are close matches: inbox, users, bar-chart, settings, phone, mail, map-pin, globe, calendar, shield, scale, message, flag, send, paperclip, smile, check, chevrons).
- **Font**: Plus Jakarta Sans via Google Fonts.
- **No raster images / no brand logos** — the "Leadflow" mark is an inline SVG placeholder; swap for the real product logo.
- Avatars are initial-based color blocks (no photos).

## Files
- `Leadflow CRM.dc.html` — the full prototype (both views). The `<script type="text/x-dc">` block at the bottom holds the logic class (`leads()` sample data, `decorate()` derivations, `renderVals()` view model). The template above it holds the markup. **Reference for exact values; do not ship as-is.**
- `support.js` — the prototype runtime. **For local preview only — do not port to production.**
