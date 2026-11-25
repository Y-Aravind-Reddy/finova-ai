# Wire Transfer Approval Controls

Apex Global Bank - Payments and Treasury Operations
Document ID: POL-PAY-007 | Version 2.4 | Owner: Head of Payments
Illustrative policy for the Finova demo workspace. Not legal or regulatory advice.

## 1. Purpose

This policy defines approval limits and dual-authorisation (maker-checker) controls for outgoing wire transfers, including RTGS, NEFT, IMPS and SWIFT cross-border payments.

## 2. Approval Limits

| Amount (INR equivalent) | Required approval |
|---|---|
| Up to 5,00,000 | Single maker; system checks only |
| 5,00,001 to 50,00,000 | Maker plus one checker (dual authorisation) |
| 50,00,001 to 5,00,00,000 | Maker plus checker plus Branch or Desk Manager |
| Above 5,00,00,000 | Maker plus checker plus Head of Payments and Treasury |

## 3. Dual-Authorisation Rules

1. The maker and checker must be two different employees. The system blocks the same user from approving their own transfer.
2. The checker must independently verify the beneficiary name, account number, IFSC or SWIFT BIC, amount and purpose code against the original instruction.
3. Any change to the beneficiary details after creation resets all approvals.
4. Approvals expire if the transfer is not released within 4 hours.

## 4. Cross-Border (SWIFT) Payments

- All SWIFT payments are screened against sanctions lists before release.
- Payments to high-risk jurisdictions require Compliance sign-off regardless of amount.
- Purpose code and supporting invoice or contract are mandatory for amounts above USD 25,000 equivalent.

## 5. Callback Verification

For any new beneficiary or any change of beneficiary bank details on an existing payee, the bank performs a callback to the customer's registered phone number before release. Instructions received only by email are never executed without a callback.

## 6. Cut-Off Times

- RTGS: 9:00 to 17:30 IST on working days.
- NEFT and IMPS: 24x7.
- SWIFT: instructions received after 15:00 IST are processed the next business day.

## 7. Exceptions

Exceptions to these limits require written approval from the Head of Payments and must be logged in the exception register within 24 hours.
