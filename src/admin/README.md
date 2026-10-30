# Eden Glow admin panel

The owner's admin panel lives at `/admin` (sign in at `/admin/login`). It is loaded as its
own chunk, so public visitors never download it (or the Firebase SDK), and `robots.txt` plus a
`noindex` tag keep it out of search results.

## How it is connected

| File | What it is |
| --- | --- |
| `src/lib/firebase.ts` | The one Firebase setup: reads `VITE_FIREBASE_*` from `.env.local`, optional emulators |
| `src/admin/api/index.ts` | The API contract the screens use; picks Firebase (default) or the demo mock |
| `src/admin/api/firestoreApi.ts` | Firebase backend: Auth sign-in, Firestore reads/writes, transactions |
| `src/admin/api/engine.ts` | Shared rules: validation, invoice building, dashboard/report views |
| `firestore.rules` | Who may read/write what. **This is the real protection.** |
| `src/admin/mock/` | Demo data, used only with `VITE_ADMIN_DEMO=true` (browser-only, not secure) |
| `src/lib/publicServices.ts` | Helper to read published services on public pages (not used by them yet) |

### Firestore data

| Collection | Contents | Who can read / write |
| --- | --- | --- |
| `admins/{uid}` | `{ name, email }` for the owner's Firebase Auth account | Created by hand in the Console. Nobody can write it from the site |
| `services` | `name, category, price, durationMin, image, active, published` | Public may read `published: true` only; owner writes; no deletes |
| `customers` | `name, phone, email, area, notes, status, createdAt` | Owner only; no deletes (mark inactive) |
| `appointments` | `customerId, serviceIds, date, time, staff, status, notes, invoiceId` | Owner only; no deletes (cancel) |
| `invoices` | Bill lines with the price billed, totals, `number`, `status: draft/issued`, `paid/balance` | Owner only; issued invoices can only take payments and notes; only drafts can be deleted |
| `payments` | `invoiceId, amount, method, reference, at` | Owner only; append-only, and must raise the invoice's paid total by exactly its amount |
| `expenses` | `date, category, description, amount, method` | Owner only |
| `settings/studio` | Tax, staff names, invoice footer | Owner only |
| `counters/invoices-YYYY` | Last invoice number used that year | Owner only; can only go up |
| `requestKeys/{key}` | Stops a double click creating two invoices | Owner only; create-once |

Dates are local `YYYY-MM-DD` strings; payment times are ISO strings; amounts are rupees.

Rules the backend keeps (and the rules file double-checks where it can):

- Prices on a bill come from the service list, never from the page. Saved invoices keep the
  price they were billed at, so changing a service price only affects new bills.
- A service without a price or duration stays hidden: it can't be billed or published.
- Invoice number + invoice + first payment are written in one transaction; later payments
  are a transaction too. Money above the balance is change, not kept.
- After sign-in, the admin keeps the collections in sync in memory (no on-device cache, so
  customer details don't stay on a shared computer). Fine for one studio's records; if the
  data grows to tens of thousands of documents, move the heavier reports to queries.

## First-time setup (Firebase Console)

1. **Web config:** copy `.env.example` to `.env.local` and paste the values from
   Project settings → General → Your apps. `.env.local` is ignored by Git.
2. **Authentication:** Build → Authentication → Sign-in method → enable **Email/Password**.
   Users → **Add user** with the owner's email and a strong password. Copy the new **User UID**.
3. **Owner record:** Firestore → Start collection `admins` → Document ID = that User UID →
   fields `name` (string, e.g. the owner's name) and `email` (string).
4. **Rules:** publish `firestore.rules` (Firestore → Rules, paste and Publish, or
   `npx firebase deploy --only firestore:rules`). Until this is done the database keeps
   whatever rules it was created with.
5. **Authorized domains:** Authentication → Settings → Authorized domains → add the live site's domain.
6. **Hosting env:** add the same `VITE_FIREBASE_*` variables in the host's settings (e.g. Vercel →
   Project → Settings → Environment Variables) and redeploy.
7. Sign in at `/admin/login`, open **Services**, and either add services or use
   **Import the website's treatment list** (names only; set each price and duration, then mark it Active).

Recommended later: enable **App Check** for Firestore, and set a budget alert in Google Cloud.

## Local development and tests

- `npm run emulators` runs the Auth + Firestore emulators with `firestore.rules`. Set
  `VITE_FIREBASE_USE_EMULATORS=true` in `.env.local` to point the admin at them.
- `npm test` starts the emulators, then runs the engine tests, the security-rules tests
  (`tests/rules.test.ts`) and an end-to-end test of every admin data operation
  (`tests/firestoreApi.test.ts`). Needs a JDK on the PATH (tested with JDK 21).
- `VITE_ADMIN_DEMO=true` runs the screens on the in-browser demo data with no Firebase at all.
  The demo sign-in (`admin@edenglow.demo` / `EdenGlow@demo`) protects nothing; never use it in production.

## Where things are

- `pages/` one file per screen (Login, Dashboard, CreateBill, InvoiceDetail, Invoices,
  Customers, Appointments, Services, Expenses, Reports, Settings)
- `components/` admin layout, sidebar, form controls, cards, modals
- `charts/Charts.tsx` small SVG charts (no chart library)
- `lib/` money/date formatting, bill arithmetic, invoice PDF (jsPDF, loaded on demand), website menu import
- `admin.css` all admin styles, prefixed `ad-`

Studio address, phone and email on invoices come from `src/config/business.ts`; anything left
empty there is left off the invoice rather than invented.
