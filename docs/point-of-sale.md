# Point of sale

Farm owners can open **Menu → Sales & purchasing → Point of sale**.

## Set up products

1. Open **Products & prices → Add product**.
2. Enter a product name (milk, tea, butter, yogurt, etc.), selling unit, selling
   price, opening stock, and stock cost per unit.
3. Save the product. It is also available in **Feed & inventory**.
4. Existing inventory items can be enabled using **Edit price / status**.
5. Add subsequent stock through **Manage stock → Stock movements**. Quantities
   use the selling unit: for example, 20 cups of prepared tea or 10 kg of yogurt.

This version tracks finished products. Making tea or yogurt from ingredients
is not an automatic production/recipe conversion. Milk production records do
not automatically replenish POS inventory.

## Make a sale

1. Open **New sale** and click products to add them to the cart.
2. Adjust quantities (up to three decimal places). **Walk-in customer** is the
   default; existing buyers can be selected instead.
3. **Cash** is selected by default. Enter cash received to calculate change,
   or leave it blank for the exact amount. Alternatively select **Online transfer**
   and optionally enter the bank transaction reference after confirming payment.
4. Click **Complete sale**. The sale, stock movements, audit entry and balanced
   sales/cash journal entries are saved in one database transaction.
5. Click **Print receipt**, choose **58 mm** or **80 mm**, and select the thermal
   printer in the browser print dialog. Use matching paper size and disable
   browser headers/footers. A connected printer and its OS driver are required.

Online transfer records a payment confirmed by the operator; it does not initiate
or verify a bank transfer. Sales are fully paid; POS credit and split payments
are not included.

## Prices and receipts

- Change default prices through **Products & prices → Edit price / status**.
- Prices are checked again at checkout. Refresh and review the cart if a price
  has changed elsewhere.
- **Receipts** shows the latest 100 completed sales. Open any receipt to reprint.
- Receipts retain the product name, unit, price, customer and farm details from
  the time of sale. Reprinting never changes stock.
- If a checkout response is lost, use **Retry checkout**. The pending request
  survives a reload in the same browser tab and cannot create a duplicate sale.
- Only farm owners can use the POS in this version. Refunds/voids are not included.

## Implementation and validation

Migration `022_point_of_sale.sql` adds inventory sale flags/prices and immutable
POS sale and line-item records. No existing inventory is automatically enabled
or repriced. All products and receipts are scoped to the current farm.

`backend/scripts/verify-pos.ts` checks defaults, fractional quantities, stock
changes, cash/change, transfers, customer selection, balanced journal entries,
price snapshots, stale prices, duplicate retries, concurrent stock contention,
rollback, tenant isolation, disabled products and owner authorization. It requires
explicit `POS_TEST_API_URL`, `POS_TEST_ORIGIN`, and `POS_TEST_DATABASE_URL` values
pointing to a disposable test instance.

`frontend/tests/pos.spec.ts` covers product setup, cash and transfer checkouts,
stock quantities, price history, thermal print content, responsive layout and
recovery after a lost checkout response.

## Deployment verification — 2026-10-11

Deployed at `http://192.168.2.213:3000/dashboard?tab=pos`.

- Backend unit tests: 4 passed; frontend/backend type checks and production builds passed.
- POS API integration suite passed against a disposable database.
- Seven browser checks passed across the POS, foundation, team, and workflow suites.
  The existing foundation test's password selector was updated to match the current
  form; its registration/login/logout/tenant-isolation check then passed.
- Desktop/mobile POS layouts and browser-generated 58 mm receipt content checked.
  Physical thermal-printer output has not been tested on this machine.
- Live POS migration, HTTP pages, API authentication, build identity, backend routing,
  and enabled/running services verified. Existing inventory quantities are unchanged.
- A private pre-migration data snapshot is retained in ignored `backend/backups/`;
  previous build artifacts are retained under `/tmp/dairyfarm-pre-pos-build-aso7gh44`.
