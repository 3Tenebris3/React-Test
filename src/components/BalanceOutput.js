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

export default connect(state => {

  const accounts = state.accounts;
  const journalEntries = state.journalEntries;
  const { startAccount, endAccount, startPeriod, endPeriod } = state.userInput;

  if (!state.userInput.format) {
    return {
      balance: [],
      totalDebit: 0,
      totalCredit: 0,
      userInput: state.userInput
    };
  }

  const effectiveStartAccount = isNaN(startAccount)
    ? Math.min(...accounts.map(a => a.ACCOUNT))
    : startAccount;
  const effectiveEndAccount = isNaN(endAccount)
    ? Math.max(...accounts.map(a => a.ACCOUNT))
    : endAccount;

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

  console.log('Effective Start Period:', effectiveStartPeriod);
  console.log('Effective End Period:', effectiveEndPeriod);

  const filteredAccounts = accounts
    .filter(account =>
      account.ACCOUNT >= effectiveStartAccount &&
      account.ACCOUNT <= effectiveEndAccount
    )
    .sort((a, b) => a.ACCOUNT - b.ACCOUNT);

  const balance = filteredAccounts.map(account => {
    const entries = journalEntries.filter(j => {
      if (!j.PERIOD || isNaN(j.PERIOD.getTime())) return false;
      const entryTime = j.PERIOD.getTime();
      return (
        j.ACCOUNT === account.ACCOUNT &&
        entryTime >= effectiveStartPeriod.getTime() &&
        entryTime <= effectiveEndPeriod.getTime()
      );
    });

    const totalDebitForAccount = entries.reduce((acc, entry) => acc + entry.DEBIT, 0);
    const totalCreditForAccount = entries.reduce((acc, entry) => acc + entry.CREDIT, 0);

    return {
      ACCOUNT: account.ACCOUNT,
      DESCRIPTION: account.LABEL || '',
      DEBIT: totalDebitForAccount,
      CREDIT: totalCreditForAccount,
      BALANCE: totalDebitForAccount - totalCreditForAccount
    };
  });

  const totalCredit = balance.reduce((acc, entry) => acc + entry.CREDIT, 0);
  const totalDebit = balance.reduce((acc, entry) => acc + entry.DEBIT, 0);

  return {
    balance,
    totalCredit,
    totalDebit,
    userInput: state.userInput
  };
})(BalanceOutput);

