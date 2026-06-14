# Staff Portal Web Application

The Staff Portal is a dedicated web application designed for frontline transportation staff responsible for processing passenger wallet top-ups and managing daily shift operations. Built as a responsive React/Vite web application, it provides station-based staff with a focused, role-restricted interface for handling cash and digital recharge transactions, reconciling shift finances, and maintaining an auditable record of all activities performed during a working day.

---

## Authentication and Role Enforcement

Staff members access the portal through a secure login page backed by JSON Web Token (JWT) authentication. The portal enforces strict role-based access control at the application level: only accounts with the `staff` role are permitted to log in. Any attempt to authenticate using a passenger, driver, or administrator account is rejected with an explicit denial message before any session data is stored. Upon successful login, the access token and a refresh token are persisted locally to maintain the session. Logout immediately clears all stored tokens and revokes the server-side session in the background.

---

## Shift Management

Before any financial operation can take place, staff must open a shift. The Shift Management page is the default landing screen after login and serves as the operational anchor for the entire session. To open a shift, the staff member enters the cash amount present in the drawer at the start of the shift and selects their working station from a predefined list of locations.

Once a shift is active, a live dashboard displays four real-time counters: the number of transactions processed, the total amount recharged, the total cash collected, and the original opening cash. The shift banner shows how long the shift has been running and identifies the active station.

At the end of the working period, staff close the shift by entering the physical cash count from the drawer. The system immediately computes the discrepancy between the expected cash balance (opening cash plus all cash top-ups collected) and the reported closing amount, displaying a real-time indicator that labels the result as balanced, short, or over. Upon confirmation, a post-close summary card is generated showing the full cash reconciliation breakdown, which can be printed for physical record-keeping.

---

## Wallet Top-Up Processing

The Wallet Top-Up module is the primary operational tool. It is locked behind the shift gate — staff cannot process any top-up without an active shift open, ensuring that every transaction is tied to a specific working session and reconcilable at close.

Top-up processing follows a structured five-step flow:

### Step 1 — Find Passenger

Staff search for a passenger by name, email, phone number, or user ID using a live-search input with debounced queries. Alternatively, they can tap the **Scan QR Code** button to activate the device camera and read the passenger's unique transit QR code, which is automatically parsed to locate the correct account.

### Step 2 — Verify Identity

Before any money changes hands, the selected passenger's full profile is displayed: name, account status, wallet balance, phone number, and registration date. If the account is inactive, blocked, or suspended, the system displays a clear warning and prevents the top-up from proceeding.

### Step 3 — Recharge Details

Staff enter the top-up amount (with quick-select preset buttons for common values: $5, $10, $20, $50, $100, and $200), the payment method (Cash, Card, Mobile Transfer, Bank Transfer, Voucher, or Other), the recharge location, and a mandatory transaction reference number. Optional notes can also be added.

### Step 4 — Confirm

A final confirmation screen shows all entered details alongside the passenger's current balance and the projected new balance. An idempotency guard checks whether the same amount was submitted for the same passenger within the last 30 seconds and displays a duplicate warning if so, preventing accidental double-charging.

### Step 5 — Success and Receipt

After a successful online transaction, a digital receipt is generated displaying the receipt number, passenger details, previous and new wallet balances, payment method, station, shift reference, and the processing staff member's name. The receipt can be shared with the passenger via WhatsApp, SMS, or email, or printed directly from the browser.

---

## Offline Mode and Queue Synchronization

The portal is designed to remain operational during network outages. If the device loses internet connectivity, an offline banner is displayed across the top of the application. Top-up processing continues normally in this state: transactions are saved locally in an offline queue with a cryptographic signature and a unique queue ID, and counted toward the shift totals in memory.

The moment the device reconnects to the internet, the offline queue is automatically drained. Each pending transaction is submitted to the backend sequentially to avoid overwhelming the server. Items that sync successfully are marked as completed; failures are flagged separately. Staff can view pending offline transactions at any time within the Cash Collection Report page.

---

## Top-Up History

The My Top-Up History page provides staff with a searchable and filterable log of every top-up they have ever processed. Three summary cards at the top of the page show the total number of top-ups, the cumulative amount recharged, and a count of today's transactions.

The transaction log table lists each record with the date and time, passenger name and email, amount, payment method, location, transaction reference number, and completion status. Filters allow narrowing the view by date range, specific user ID, or station location. Clicking the Details button on any row opens a modal with the full breakdown of that transaction, including the wallet balance before and after the recharge.

---

## Shift History

The Shift History page provides a complete log of all shifts the logged-in staff member has opened and closed. Three summary cards aggregate the total number of completed shifts, the overall amount collected across all shifts, and the total transaction count.

The shift log table displays each shift with its ID, assigned station, opening and closing times, duration, transaction count, total collected, and cash discrepancy status. Discrepancies are colour-coded: green for balanced, amber for overage, and red for shortage. Clicking View on any row opens a detailed modal showing the full financial reconciliation for that shift, including opening cash, cash collected, expected closing, reported closing, and the calculated difference.

---

## Cash Collection Report

The Cash Collection Report page provides a comprehensive financial summary for the active shift or the most recently closed shift. It is structured as a printable document suitable for administrative review and physical filing.

The report header identifies the staff member, station, shift ID, and generation timestamp. Four KPI cards summarize total transactions, total amount processed, cash collected, and non-cash receipts. A full transaction log lists every top-up in the shift with time, passenger name, amount, payment method, station, and receipt number, with a running total at the foot of the table.

A payment method breakdown section groups all transactions by how they were paid, showing the count and total for each method (Cash, Card, Mobile Transfer, Bank Transfer, Voucher). The cash reconciliation section lays out the opening cash, cash top-ups collected, expected closing cash, staff-reported closing cash, and the resulting discrepancy, with colour-coded alerts for shortages and overages. If offline transactions are pending synchronization, a separate panel lists them with their queue IDs, timestamps, amounts, and cryptographic signatures. The entire report can be printed via a dedicated button that uses browser print styles to hide all navigation and display only the report content.
