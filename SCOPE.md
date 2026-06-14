# Project Scope: Schemas & Anomaly Detectors

This document breaks down the database schemas and details exactly how each of the 14 anomaly detectors works. It's written in plain English to show the logic behind the code.

---

## 1. Database Schemas (PostgreSQL / Sequelize)

We decided to use a relational layout with normalized tables linked by foreign keys and UUIDs. This enforces database-level integrity, supports cascading edits, and aligns with SQL best practices.

### Users Table (`User.js`)
Stores basic authentication and profile details.
- `id`: UUID (Primary Key, automatically generated).
- `name`: String (allowNull: false). Display name.
- `email`: String (allowNull: false, unique). Used for login.
- `passwordHash`: String (allowNull: false). Bcrypt hashed password.
- `createdAt`: Date. Default to current time.

### Groups Table (`Group.js`)
Represents a group of people sharing expenses.
- `id`: UUID (Primary Key).
- `name`: String (allowNull: false). e.g., "Flat 302 Expenses".
- `description`: String. A brief note about what the group is.
- `createdBy`: UUID (Foreign Key references `Users.id`).
- `createdAt`: Date. Default to current time.

### GroupMembers Table (`GroupMember.js`)
Maps users to groups (junction table). It includes an index constraint on `(groupId, userId)` to prevent double-membership.
- `id`: UUID (Primary Key).
- `groupId`: UUID (Foreign Key references `Groups.id`).
- `userId`: UUID (Foreign Key references `Users.id`).
- `joinDate`: Date (allowNull: false). When the user joined.
- `leaveDate`: Date (nullable). When the user left (e.g. Meera leaving end of March).
- `addedBy`: UUID (Foreign Key references `Users.id`). Who added the member.

### Expenses Table (`Expense.js`)
Represents an individual transaction or settlement.
- `id`: UUID (Primary Key).
- `groupId`: UUID (Foreign Key references `Groups.id`).
- `description`: String (allowNull: false). What it was for.
- `amount`: Decimal (allowNull: false). The raw amount entered.
- `currency`: Enum (`['INR', 'USD']`, default: `INR`).
- `amountInINR`: Decimal (allowNull: false). Converted amount in rupees.
- `exchangeRateUsed`: Decimal (default: 1.0). Conversion multiplier.
- `date`: Date (allowNull: false). When the expense occurred.
- `paidBy`: UUID (Foreign Key references `Users.id`). Who paid the bill.
- `splitType`: Enum (`['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES']`).
- `isSettlement`: Boolean (default: `false`). True if this is a debt payment.
- `isDeleted`: Boolean (default: `false`). Used for soft deletes.
- `importRowIndex`: Integer (nullable). CSV row index from the import file.
- `notes`: String. Any extra details.
- `createdAt`: Date. Default to current time.

### ExpenseSplits Table (`ExpenseSplit.js`)
Stores the split breakdown for expenses (1:N relationship with Expenses).
- `id`: UUID (Primary Key).
- `expenseId`: UUID (Foreign Key references `Expenses.id` with CASCADE delete).
- `userId`: UUID (Foreign Key references `Users.id`).
- `amount`: Decimal (allowNull: false). Member's absolute share in INR.

### ImportLogs Table (`ImportLog.js`)
Tracks the status of CSV file uploads and their parsed contents.
- `id`: UUID (Primary Key).
- `groupId`: UUID (Foreign Key references `Groups.id`).
- `uploadedBy`: UUID (Foreign Key references `Users.id`).
- `fileName`: String (allowNull: false). The uploaded CSV name.
- `importedAt`: Date. Default to current time.
- `totalRows`: Integer. Total lines in the CSV.
- `successCount`: Integer. Number of successfully committed rows.
- `errorCount`: Integer. Number of rows with errors.
- `skippedCount`: Integer. Number of skipped rows.
- `parsedRows`: JSONB (allowNull: true). Holds raw parsed CSV row arrays for post-review commits.
- `isConfirmed`: Boolean (default: `false`). True if the import has been finalized.

### ImportAnomalies Table (`ImportAnomaly.js`)
Stores detected CSV import anomalies (1:N relationship with ImportLogs).
- `id`: UUID (Primary Key).
- `importLogId`: UUID (Foreign Key references `ImportLogs.id` with CASCADE delete).
- `rowIndex`: Integer. The line number in the CSV.
- `issueType`: Enum (`'DUPLICATE_ROW'`, `'NEGATIVE_AMOUNT'`, etc.).
- `description`: String. Human-readable explanation.
- `rawRow`: JSONB. The parsed key-value pairs of that specific CSV row.
- `suggestedAction`: String. Default solution recommendation.
- `status`: Enum (`'pending'`, `'approved'`, `'rejected'`, default: `'pending'`). The user's action decision.

---

## 2. The 14 Anomaly Detectors

Every row in the CSV goes through these 14 checks. If a row triggers any of them, it gets flagged and stored in the `ImportLog` so the user can review and fix it in the UI.

### 1. `DUPLICATE_ROW`
- **What it checks**: If a row looks exactly like another row in the same CSV file.
- **Trigger**: We generate a hash using `Date + Description + Amount + PaidBy`. If we see this exact hash twice in the same upload, it's flagged.
- **Default Action**: Skip the duplicate row, keeping only the first instance.

### 2. `NEGATIVE_AMOUNT`
- **What it checks**: If the amount is less than 0.
- **Trigger**: `amount < 0`.
- **Default Action**: Flag it. Usually, negative amounts are refunds or settlements, so we suggest treating it as a settlement or reversing it.

### 3. `SETTLEMENT_AS_EXPENSE`
- **What it checks**: If someone logged a "pay back" or "settlement" as a regular expense, which ruins the balance calculations.
- **Trigger**: A regex match on the Description column for keywords like `settle`, `paid back`, `reimburse`, `settlement`, `returned`.
- **Default Action**: Suggest changing `isSettlement` to `true` and setting the split type to `EXACT` with the receiver as the sole split target.

### 4. `CURRENCY_MISMATCH`
- **What it checks**: If the amount column has a dollar sign (`$`) but the Currency column says `USD`, or vice-versa, or if we have to do an implicit conversion.
- **Trigger**: Amount starts with `$` AND Currency is explicitly `USD`.
- **Default Action**: Strip the `$` sign and auto-convert to INR using the fixed exchange rate of `83.50`.

### 5. `DOLLAR_AS_RUPEE`
- **What it checks**: A critical issue where a dollar sign (`$`) is written in the amount column, but the Currency column says `INR` or is left empty.
- **Trigger**: Amount starts with `$` but the Currency column is blank or explicitly says `INR`.
- **Default Action**: Flag for manual review. If they confirm it, we treat it as USD and convert it using the `83.50` rate.

### 6. `MEMBER_NOT_IN_GROUP`
- **What it checks**: If the person who paid (or someone mentioned in the split details) is not registered in the group.
- **Trigger**: We normalize the name and compare it to the group's current members. If no match is found, it triggers.
- **Default Action**: Flag and offer to create a new user profile and add them to the group automatically.

### 7. `EXPENSE_AFTER_LEAVE`
- **What it checks**: If a member is included in a split (or listed as payer) for an expense dated *after* their official leave date.
- **Trigger**: `expenseDate > member.leaveDate`. (e.g. Meera left end of March, but was charged for an April expense).
- **Default Action**: Remove this member from the split calculation and recalculate the shares among the remaining active members.

### 8. `EXPENSE_BEFORE_JOIN`
- **What it checks**: If a member is included in a split (or listed as payer) for an expense dated *before* they joined.
- **Trigger**: `expenseDate < member.joinDate`. (e.g. Sam joined mid-April, but is charged for a February expense).
- **Default Action**: Exclude them from the split list and recalculate among the active members.

### 9. `MISSING_FIELDS`
- **What it checks**: If critical fields like Date, Description, Amount, or PaidBy are missing.
- **Trigger**: Any of these columns are empty or contain only whitespace.
- **Default Action**: High-priority flag. The row is blocked from import until the user enters the missing info in the review table.

### 10. `INVALID_DATE`
- **What it checks**: If the date column has a garbled or un-parseable string.
- **Trigger**: `isNaN(Date.parse(row.Date))`.
- **Default Action**: Flag and ask the user to correct the date string (e.g., convert "yesterday" or "Jan 35th" to a proper YYYY-MM-DD date).

### 11. `PERCENTAGE_NOT_100`
- **What it checks**: For percentage-based splits, if the sum of all percentages doesn't equal 100%.
- **Trigger**: `SplitType === 'PERCENTAGE'` and the sum of percentages parsed from SplitDetails is not exactly 100.
- **Default Action**: Flag and suggest adjusting the percentages proportionally so they sum to 100%.

### 12. `EXACT_MISMATCH`
- **What it checks**: For exact-amount splits, if the sum of individual shares doesn't add up to the total expense amount.
- **Trigger**: `SplitType === 'EXACT'` and the sum of individual amounts doesn't match the total Amount.
- **Default Action**: Flag and prompt the user to adjust the amounts or split the remainder evenly.

### 13. `ZERO_AMOUNT`
- **What it checks**: If someone logged an expense with a value of 0.
- **Trigger**: `amount === 0`.
- **Default Action**: Flag as suspicious (usually a placeholder or double-entry mistake). Suggest skipping or updating the amount.

### 14. `NAME_VARIANT`
- **What it checks**: If a name is written slightly differently (e.g., "Aisha S.", "aisha", "AISHA") but refers to an existing member.
- **Trigger**: Fuzzy name matching (lowercase, trim, stripping trailing initials) matches a group member, but isn't an exact match.
- **Default Action**: Auto-normalize the name to the canonical spelling ("Aisha") and log it as resolved.
