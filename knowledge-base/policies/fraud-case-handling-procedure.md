# Fraud Case Handling Procedure

Apex Global Bank - Fraud Risk Management
Document ID: PRC-FRD-003 | Version 3.0 | Owner: Head of Fraud Operations
Illustrative policy for the Finova demo workspace. Not legal or regulatory advice.

## 1. Purpose

This procedure explains how fraud alerts raised by the surveillance engine or reported by customers are triaged, investigated and resolved.

## 2. Case Statuses

- Flagged: raised by a surveillance rule; awaiting triage.
- In Review: assigned to an investigator.
- Frozen Escrow: funds held because the risk score is 80 or above, or an investigator ordered a hold.
- Cleared: investigated and confirmed legitimate; any hold is released.
- Confirmed Fraud: fraud established; recovery and reporting begin.

## 3. Risk Tiers

- Critical (risk score 80 to 100): auto-freeze debits, triage within 1 hour.
- High (risk score 50 to 79): triage within 4 hours.
- Nominal (below 50): triage within 24 hours; may be batch-reviewed.

## 4. Investigation Steps

1. Review the triggering rule, transaction pattern, device and location data.
2. Contact the customer through the registered phone number only, never through contact details in the suspicious transaction.
3. Decide Cleared or Confirmed Fraud and record the rationale.
4. For Confirmed Fraud: block the card or channel, raise a recall request with the beneficiary bank, and file a police complaint where the loss is INR 1,00,000 or more.

## 5. Customer-Reported Fraud

- A customer reporting an unauthorised transaction within 3 working days bears zero liability once the claim is validated.
- Reports made between 4 and 7 working days: customer liability is capped at INR 25,000.
- The bank credits the disputed amount (shadow credit) within 10 working days of the report while the investigation continues.
- Final resolution must be completed within 90 days.

## 6. Escalation to AML

Any fraud case that also shows money-laundering indicators (structuring, mule accounts, rapid pass-through) is referred to AML Investigations under POL-AML-002.

## 7. Roles and Responsibilities

- Finance Analyst: triage and investigation.
- Support Executive: records customer reports and gives status updates without disclosing investigation details.
- Admin: monitors queue SLAs and approves freezes longer than 7 days.
