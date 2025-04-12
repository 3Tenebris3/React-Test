import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import * as utils from '../utils';

class BalanceOutput extends Component {
  render() {
    if (!this.props.userInput.format) {
      return null;
    }

    return (
      <div className='output'>
        <p>
          Total Debit: {this.props.totalDebit} Total Credit: {this.props.totalCredit}
          <br />
          Balance from account {this.props.userInput.startAccount || '*'}
          {' '}
          to {this.props.userInput.endAccount || '*'}
          {' '}
          from period {utils.dateToString(this.props.userInput.startPeriod)}
          {' '}
          to {utils.dateToString(this.props.userInput.endPeriod)}
        </p>
        {this.props.userInput.format === 'CSV' ? (
          <pre>{utils.toCSV(this.props.balance)}</pre>
        ) : null}
        {this.props.userInput.format === 'HTML' ? (
          <table className="table">
            <thead>
              <tr>
                <th>ACCOUNT</th>
                <th>DESCRIPTION</th>
                <th>DEBIT</th>
                <th>CREDIT</th>
                <th>BALANCE</th>
              </tr>
            </thead>
            <tbody>
              {this.props.balance.map((entry, i) => (
                <tr key={i}>
                  <th scope="row">{entry.ACCOUNT}</th>
                  <td>{entry.DESCRIPTION}</td>
                  <td>{entry.DEBIT}</td>
                  <td>{entry.CREDIT}</td>
                  <td>{entry.BALANCE}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    );
  }
}

BalanceOutput.propTypes = {
  balance: PropTypes.arrayOf(
    PropTypes.shape({
      ACCOUNT: PropTypes.number.isRequired,
      DESCRIPTION: PropTypes.string.isRequired,
      DEBIT: PropTypes.number.isRequired,
      CREDIT: PropTypes.number.isRequired,
      BALANCE: PropTypes.number.isRequired
    })
  ).isRequired,
  totalCredit: PropTypes.number.isRequired,
  totalDebit: PropTypes.number.isRequired,
  userInput: PropTypes.shape({
    startAccount: PropTypes.number,
    endAccount: PropTypes.number,
    startPeriod: PropTypes.date,
    endPeriod: PropTypes.date,
    format: PropTypes.string
  }).isRequired
};

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

/**
 * Returns the effective date period based on user input and journal entries.
 *
 * @param {Array} journalEntries - Array of journal entry objects.
 * @param {Date} startPeriod - The user input for the start period.
 * @param {Date} endPeriod - The user input for the end period.
 * @returns {Object} An object with effectiveStartPeriod and effectiveEndPeriod.
 */
function getEffectivePeriods(journalEntries, startPeriod, endPeriod) {
  const validJournalPeriods = journalEntries
    .filter(j => j.PERIOD && !isNaN(j.PERIOD.getTime()))
    .map(j => j.PERIOD.getTime());

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

export default connect(state => {
  const accounts = state.accounts;
  const journalEntries = state.journalEntries;
  const { startAccount, endAccount, startPeriod, endPeriod } = state.userInput;

  // If no format is set, return empty output.
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

  // Filter accounts within numeric boundaries and sort them.
  const filteredAccounts = accounts
    .filter(account =>
      account.ACCOUNT >= effectiveStartAccount &&
      account.ACCOUNT <= effectiveEndAccount
    )
    .sort((a, b) => a.ACCOUNT - b.ACCOUNT);

  // Calculate each account’s balance based on journal entries within the effective date range.
  const allBalances = calculateAccountBalances(filteredAccounts, journalEntries, effectiveStartPeriod, effectiveEndPeriod);

  // Filter out accounts that have zero transactions in the period.
  const balance = allBalances.filter(row => row.DEBIT !== 0 || row.CREDIT !== 0);

  // Re-compute totals.
  const totalDebit = balance.reduce((acc, entry) => acc + entry.DEBIT, 0);
  const totalCredit = balance.reduce((acc, entry) => acc + entry.CREDIT, 0);

  return {
    balance,
    totalCredit,
    totalDebit,
    userInput: state.userInput
  };
})(BalanceOutput);

