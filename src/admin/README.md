# Eden Glow admin panel

The owner's admin panel lives at `/admin` (sign in at `/admin/login`). It is loaded as its
own chunk, so public visitors never download it, and `robots.txt` plus a `noindex` tag keep
it out of search results.

## Frontend only, for now

There is no backend yet. Every screen talks to **one module**, `src/admin/api/index.js`,
which today hands each call to the in-browser mock in `src/admin/mock/`:

| Folder | What it is |
| --- | --- |
| `src/admin/mock/seed.js` | All demo data (customers, appointments, invoices, payments, expenses, services, demo sign-in) |
| `src/admin/mock/mockApi.js` | A fake server: validates input, recomputes totals, numbers invoices, blocks double submits, builds reports. Data is kept in this browser's `localStorage`. |
| `src/admin/api/index.js` | The API contract the screens use, and the single switch between mock and real backend |

The demo sign-in (`admin@edenglow.demo` / `EdenGlow@demo`) is checked in the browser and
**protects nothing**. The header shows a "Demo data" badge while the mock is in use, and
Settings → Demo Data can reset the sample records.

## Connecting the real backend

1. Write an HTTP client with the same functions listed at the top of `api/index.js`
   (send requests with `credentials: 'include'` so the session cookie travels).
2. Point `export const api` at it, and set `USING_MOCK = false` and `DEMO_LOGIN = null`.
3. Delete `src/admin/mock/`.

Rules the server must own (the mock already behaves this way, so the screens expect it):

- Authentication: one owner account, hashed password, secure HTTP-only session cookie
  with expiry, logout, and sign-in rate limiting. A `401` response sends the screen back to login.
- Billing: prices come from the service list, never from the browser; totals, discounts and
  tax are recomputed on the server; invoice numbers are assigned on generate; invoice +
  first payment are saved in one transaction; an `idempotencyKey` stops duplicate invoices
  and payments; saved invoices keep the price they were billed at; an invoice is "paid"
  only when the full amount has been received.
- Errors come back as `{ status, message, fields? }` so forms can highlight fields.

## Where things are

- `pages/` one file per screen (Login, Dashboard, CreateBill, InvoiceDetail, Invoices,
  Customers, Appointments, Services, Expenses, Reports, Settings)
- `components/` admin layout, sidebar, form controls, cards, modals
- `charts/Charts.jsx` small SVG charts (no chart library)
- `lib/` money/date formatting, bill arithmetic, invoice PDF (jsPDF, loaded on demand)
- `admin.css` all admin styles, prefixed `ad-`

Studio address, phone and email on invoices come from `src/config/business.js`; anything left
empty there is left off the invoice rather than invented.
