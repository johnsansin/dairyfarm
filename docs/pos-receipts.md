# POS discounts and customer receipts

Open **Point of sale → New sale**. Search a product and press **Enter** to add the exact match, or the first displayed match. Search clears after adding so the next product can be entered. Products cannot be added beyond available stock.

Choose a **Percentage (%)** or **Amount** discount. Subtotal, total discount and net total update immediately. Percentage discounts are rounded to the nearest cent after summing rounded line totals. The discount must leave a positive sale total. Cash/change, bank transfers and balanced accounting entries use the net amount; inventory still deducts the full sold quantity.

Customer name and WhatsApp number are optional. An empty name uses the selected buyer or **Walk-in customer**. Enter an international number with country code; Pakistani `03xxxxxxxxx` numbers are converted to `+923xxxxxxxxx`. Completing a sale saves the name and normalized number to that farm’s POS contacts. Select a saved number from the phone field’s suggestions to reuse the name. Names without a phone remain saved on the receipt.

Completing a sale with a phone number also queues a plain-text, itemized WhatsApp receipt containing the dairy farm name, receipt number, customer, items, subtotal, discount, net payment, change and thank-you message. The message uses the farm’s own linked Baileys session. Link it under **Settings → WhatsApp**. A number left blank does not request a message.

The receipt dialog shows queued/sending/sent or failure status and offers **Print receipt** for 58 mm or 80 mm thermal paper. Both printed and WhatsApp receipts contain the discount. Recent receipts remain available under **Receipts → View / print**.

## Reliability

Migration `024_pos_discounts_receipts.sql` adds sale snapshots, per-farm contacts and a durable receipt outbox. The receipt request is committed with the sale, stock and journal entries. Repeating the same checkout cannot create another sale or message. Offline farms keep pending messages; the dispatcher checks every five seconds and drains up to 20 messages per connected farm per pass. Unconnected farms do not block other farms.

Sending checks that the linking owner and farm remain active. Only the owning backend process can use its farm’s socket. A conditional database update claims each message before sending. A sent status records Baileys submission, not customer delivery/read confirmation. A send error or interrupted submission is marked unconfirmed and is not automatically retried, to avoid duplicate customer messages. Check the customer chat in that case; the sale remains completed and printable. A number not registered with WhatsApp is marked failed. No general-purpose or bulk messaging endpoint is provided.

## Verification

Backend unit tests cover phone normalization and receipt content. The disposable integration suite covers both discount modes, cent rounding, net journal amounts, invalid input rollback, contact isolation, one outbox record per checkout, offline queueing, concurrent dispatcher claims and uncertain-send duplicate prevention. Injected Baileys socket tests verify the correct farm/recipient and suspended-farm rejection. Browser tests cover Enter-to-add, discounts, saved customer reuse, printed receipt content, mobile layout and recovery after a lost checkout response. No real customer messages are sent by tests.

## Deployment

Deployed on 2026-10-12 to `http://192.168.2.213:3000` after a protected database snapshot. Migration 024 applied successfully. Unit tests, both frontend/backend type checks, disposable integration checks and both POS browser tests passed. The production POS page and backend health returned HTTP 200; unauthenticated contact access returned HTTP 401. All three application/database services are active and enabled. Actual receipt delivery to a real customer remains unverified; outbound transport was simulated during testing.
