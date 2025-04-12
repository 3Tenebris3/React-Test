## Explanation of the Solution

### 1. Effective Account Boundaries

The function **getEffectiveAccountBoundaries** is responsible for determining the numeric boundaries for the account range based on user input:

```js
/**
 * Returns the effective account boundaries based on user input.
 *
 * @param {Array} accounts - Array of account objects.
 * @param {number} startAccount - The user input for the start account.
 * @param {number} endAccount - The user input for the end account.
 * @returns {Object} An object with effectiveStartAccount and effectiveEndAccount.
 */
function getEffectiveAccountBoundaries(accounts, startAccount, endAccount) {
  const effectiveStartAccount = isNaN(startAccount)
    ? Math.min(...accounts.map(a => a.ACCOUNT))
    : startAccount;
  const effectiveEndAccount = isNaN(endAccount)
    ? Math.max(...accounts.map(a => a.ACCOUNT))
    : endAccount;

  return { effectiveStartAccount, effectiveEndAccount };
}
```

**What this does and why:**  
- It checks if the `startAccount` or `endAccount` inputs are not valid numbers (for example, if the user enters `"*"` which cannot be parsed to a number).  
- If they are not valid, the function uses the minimum or maximum account values from the complete list.  
- This ensures that even with wildcard-like input, the application covers the entire available account range.

---

### 2. Effective Date Period

The function **getEffectivePeriods** calculates the effective date range to filter the journal entries:

```js
/**
 * Returns the effective date period based on user input and journal entries.
 *
 * @param {Array} journalEntries - Array of journal entry objects.
 * @param {Date} startPeriod - The user input for the start period.
 * @param {Date} endPeriod - The user input for the end period.
 * @returns {Object} An object with effectiveStartPeriod and effectiveEndPeriod.
 */
function getEffectivePeriods(journalEntries, startPeriod, endPeriod) {
  // Extract timestamps from valid journal entries.
  const validJournalPeriods = journalEntries
    .filter(j => j.PERIOD && !isNaN(j.PERIOD.getTime()))
    .map(j => j.PERIOD.getTime());

  // Fallback to the earliest/latest available period if input is missing or invalid.
  const defaultStartTime = validJournalPeriods.length
    ? Math.min(...validJournalPeriods)
    : Date.now();
  const defaultEndTime = validJournalPeriods.length
    ? Math.max(...validJournalPeriods)
    : Date.now();

  const effectiveStartPeriod = (!startPeriod || isNaN(startPeriod.getTime()))
    ? new Date(defaultStartTime)
    : startPeriod;
  const effectiveEndPeriod = (!endPeriod || isNaN(endPeriod.getTime()))
    ? new Date(defaultEndTime)
    : endPeriod;

  return { effectiveStartPeriod, effectiveEndPeriod };
}
```

**What this does and why:**  
- It filters through all the journal entries to extract only those that have a valid date (`PERIOD`) and converts them to their corresponding timestamps.  
- If the user input for a period is missing or invalid, the function substitutes the earliest (or latest) available date from the journal entries.  
- The result is a pair of Date objects (`effectiveStartPeriod` and `effectiveEndPeriod`) that define the range for filtering journal entries.

---

### 3. Calculate Account Balances

The function **calculateAccountBalances** computes the balance for each account filtered by the numeric boundaries and then further filtered by the effective date range:

```js
/**
 * Calculates the account balances for each filtered account.
 *
 * @param {Array} filteredAccounts - Array of accounts filtered by account boundaries.
 * @param {Array} journalEntries - Array of journal entry objects.
 * @param {Date} effectiveStartPeriod - Effective start period.
 * @param {Date} effectiveEndPeriod - Effective end period.
 * @returns {Array} Array of balance objects.
 */
function calculateAccountBalances(filteredAccounts, journalEntries, effectiveStartPeriod, effectiveEndPeriod) {
  return filteredAccounts.map(account => {
    const entries = journalEntries.filter(j => {
      if (!j.PERIOD || isNaN(j.PERIOD.getTime())) return false;
      const entryTime = j.PERIOD.getTime();
      return (
        j.ACCOUNT === account.ACCOUNT &&
        entryTime >= effectiveStartPeriod.getTime() &&
        entryTime <= effectiveEndPeriod.getTime()
      );
    });

    const totalDebit = entries.reduce((acc, e) => acc + e.DEBIT, 0);
    const totalCredit = entries.reduce((acc, e) => acc + e.CREDIT, 0);

    return {
      ACCOUNT: account.ACCOUNT,
      DESCRIPTION: account.LABEL || '',
      DEBIT: totalDebit,
      CREDIT: totalCredit,
      BALANCE: totalDebit - totalCredit
    };
  });
}
```

**What this does and why:**  
- For each account (filtered by their numerical range), it finds the corresponding journal entries whose dates fall within the effective date range.  
- It sums up the debits and credits from those journal entries and computes a balance (debit minus credit).  
- Each account’s balance is returned as an object containing the account number, description (using the `LABEL` property), debit, credit, and overall balance.

---

### 4. The Final Connect Function

Finally, these helper functions are used in the Redux selector to combine all the logic and pass the necessary props to the `BalanceOutput` component:

```js
export default connect(state => {
  const accounts = state.accounts;
  const journalEntries = state.journalEntries;
  const { startAccount, endAccount, startPeriod, endPeriod } = state.userInput;

  // If no output format is defined, return an empty object.
  if (!state.userInput.format) {
    return {
      balance: [],
      totalDebit: 0,
      totalCredit: 0,
      userInput: state.userInput
    };
  }

  // Compute effective account boundaries.
  const { effectiveStartAccount, effectiveEndAccount } =
    getEffectiveAccountBoundaries(accounts, startAccount, endAccount);

  // Compute effective date periods.
  const { effectiveStartPeriod, effectiveEndPeriod } =
    getEffectivePeriods(journalEntries, startPeriod, endPeriod);

  // Filter accounts according to the numeric boundaries and sort them.
  const filteredAccounts = accounts
    .filter(account =>
      account.ACCOUNT >= effectiveStartAccount &&
      account.ACCOUNT <= effectiveEndAccount
    )
    .sort((a, b) => a.ACCOUNT - b.ACCOUNT);

  // Calculate each account's balance based on journal entries within the effective date range.
  const allBalances = calculateAccountBalances(filteredAccounts, journalEntries, effectiveStartPeriod, effectiveEndPeriod);

  // Exclude accounts with zero transactions in the period.
  const balance = allBalances.filter(row => row.DEBIT !== 0 || row.CREDIT !== 0);

  // Compute overall totals.
  const totalDebit = balance.reduce((acc, entry) => acc + entry.DEBIT, 0);
  const totalCredit = balance.reduce((acc, entry) => acc + entry.CREDIT, 0);

  return {
    balance,
    totalCredit,
    totalDebit,
    userInput: state.userInput
  };
})(BalanceOutput);
```

**Summary of the Logic:**  
- **Input Parsing:** The code starts by reading account and journal data along with user input (which includes the account range and date range).  
- **Boundary Calculation:** It then uses helper functions to determine:
  - The numeric range for accounts (e.g., from 1000 to 5000).
  - The effective date range by combining user input with actual journal data (defaulting to the earliest/latest available dates if needed).
- **Account Filtering:** Only accounts within the specified numeric range are selected and sorted.
- **Balance Computation:** For each account, the function sums the debit and credit amounts of journal entries that fall within the effective date range, calculates the balance, and assembles an array of result objects.
- **Zero-Transaction Filtering:** Finally, any account with no transactions (both debit and credit equal to zero) is filtered out, and overall totals are computed.  
- **Output:** The processed data is returned as props to the `BalanceOutput` component.

---

## Code Challenge Description

Below is the challenge description that was provided for the assignment:

---

# Coding Challenge

Your task is to finish the Redux `mapStateToProps` function to a program to help an accountant to get balances from accounting journals.

## Getting started

Install modules by running `npm install` in the command line, then `npm run start`.

## Inputs & Outputs

Journal and Accounts input fields are already parsed and stored in the app's
Redux store.

User input has the following form:

    AAAA BBBB CCC-YY DDD-YY EEE

- AAAA is the starting account (* means first account of source file)
- BBBB is the ending account(* means last account of source file)
- CCC-YY is the first period (* means first period of source file)
- DDD-YY is the last period (* means last period of source file)
- EEE is output format (values can be HTML or CSV).

Examples of user inputs:

    1000 5000 MAR-16 JUL-16 HTML

This user request must output all accounts from acounts starting with "1000" to accounts starting with "5000", from period MAR-16 to JUL-16. Output should be formatted as an HTML table.

![1000 5000 MAR-16 JUL-16 HTML](/example-1.png)

    2000 * * MAY-16 CSV

This user request must output all accounts from accounts starting with "2000" to last account from source file, from first period of file to MAY-16. Output should be formatted as CSV.

![2000 * * MAY-16 CSV](/example-2.png)

## Challenge

Parsing input fields and storing in Redux has already been implemented; it's up to you to filter the journals and accounts to create the balance data set. This code should go into the selector function at the bottom of the BalanceOutput component. The BalanceOutput component expects balance to be an array of objects with the keys: ACCOUNT, DESCRIPTION, DEBIT, CREDIT, and BALANCE.

## Post challenge

After you're done, commit your changes, push to your GitHub and send us a link.
