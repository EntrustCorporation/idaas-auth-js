[**@entrustcorp/idaas-auth-js**](../../README.md)

---

[@entrustcorp/idaas-auth-js](../../README.md) / [index](../README.md) / FaceChallenge

# Type Alias: FaceChallenge

> **FaceChallenge** = `object`

Parameters returned to initialize a Face Biometric authenticator.

## Properties

### device?

> `optional` **device**: `"WEB"` \| `"MOBILE"`

Which device to use for registration and authentication.

---

### id?

> `optional` **id**: `string`

The ID of the Face Biometric to get.

---

### qrCode?

> `optional` **qrCode**: `string`

QR Code to use to launch the mobile flow.

---

### sdkToken?

> `optional` **sdkToken**: `string`

The SDK token generated for the user.

---

### workflowRunId?

> `optional` **workflowRunId**: `string`

Workflow run ID to use for the user.
