# Design Decisions: How & Why I Built It This Way

When building SplitLedger, I had to make a few architecture and design choices. Here are the 6 main ones, explained simply.

---

## 1. Relational Database Structure (PostgreSQL & Sequelize)

### The Decision
SplitLedger was built using a relational database (PostgreSQL hosted on Neon) paired with Sequelize ORM to satisfy requirement #5 ("Use relational DBs only"). The schema is split into separate normalized tables: `Users`, `Groups`, `GroupMembers`, `Expenses`, `ExpenseSplits`, `ImportLogs`, and `ImportAnomalies`.

### Why?
- **Relational Integrity**: Using real FOREIGN KEYs and Cascading Deletes guarantees data consistency (e.g. you cannot have a member in a group that doesn't exist, and deleting an expense automatically drops its splits).
- **Separation of Concerns for Arrays**: Rather than embedding splits and anomalies in arrays, they reside in dedicated SQL tables with foreign key pointers. This scales beautifully and allows indexing on individual splits and anomaly items.
- **Native JSONB Support**: PostgreSQL's native `JSONB` support is leveraged in `ImportLog` to store raw, uncommitted parsed CSV rows during the review step. This gives us document-like flexibility for logs while keeping the core schema fully relational.
- **Join/Leave Date Logic**: Tracking when someone joins or leaves a group is perfectly suited for SQL query filters. We can query the `GroupMembers` table with simple date comparisons to determine active members at any point in time.

---

## 2. Fixed Exchange Rate for USD to INR (83.50)

### The Decision
I chose a hardcoded exchange rate of `83.50` (stored in `.env` as `USD_TO_INR_RATE` but defaulted in the service) instead of calling a live currency exchange API during CSV imports.

### Why?
- **Consistency**: If a live API is used, importing the exact same CSV on Monday might result in different balances than importing it on Friday because exchange rates fluctuate. A fixed rate ensures imports are completely reproducible.
- **Simplicity**: No external API keys to manage, no rate limits to worry about, and no chance of imports failing because an external service went down.

---

## 3. Pre-Calculating and Storing Split Amounts

### The Decision
When an expense is created, the server immediately calculates the exact rupee share for each person based on the split type (EQUAL, EXACT, PERCENTAGE, SHARES) and stores the resulting absolute amounts in a `splits` array (`{ userId, amount }`) in the database.

### Why?
- **Database Simplification**: The balance calculator doesn't have to understand split rules. It just runs a simple sum of the `splits.amount` field.
- **Immutability**: If a group's membership changes later (e.g., someone leaves), historical expenses split equally don't get recalculated. Storing the hard numbers locks in the split exactly as it was when the expense was logged.

---

## 4. Two-Step CSV Import Flow (Review & Confirm)

### The Decision
Instead of importing the CSV directly and letting the backend guess the corrections, I built a two-step flow:
1. Upload and Parse: Backend flags all anomalies and returns them.
2. Review and Confirm: The UI shows every single issue with a default correction, letting the user approve, reject, or edit the values before committing them to the database.

### Why?
- **User Control**: Messy spreadsheets are unpredictable. Auto-correcting things like "Meera's name spelled as Mera" or "settlements logged as expenses" without user consent is a recipe for wrong balances.
- **No Double Commits**: Users can review what the import *will* look like before a single expense is actually created.

---

## 5. Soft Deletes for Expenses (`isDeleted: true`)

### The Decision
When a user deletes an expense in the UI, we don't run a hard delete or `destroy()` in PostgreSQL/Sequelize. Instead, we toggle an `isDeleted` boolean to `true`.

### Why?
- **Audit Trails**: If we delete rows permanently, we lose the connection to the original CSV import logs. Keeping the records allows us to see exactly which imported rows were kept and which were later deleted.
- **Easy Undo**: We can easily implement an "Undo Delete" feature in the future if a user makes a mistake.

---

## 6. Greedy Settlement Optimizer

### The Decision
To settle up the group's debts, I implemented a greedy algorithm that matches the person with the largest positive balance (creditor) with the person with the largest negative balance (debtor).

### Why?
- **Fewer Transactions**: Instead of everyone sending multiple small payments to each other, this algorithm minimizes the total number of transactions needed to clear all debts.
- **Ease of Implementation**: It's highly performant and works perfectly once all currency balances have been pre-converted into a single unit (INR).
