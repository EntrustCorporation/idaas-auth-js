[**@entrustcorp/idaas-auth-js**](../../README.md)

---

[@entrustcorp/idaas-auth-js](../../README.md) / [index](../README.md) / GridChallenge

# Type Alias: GridChallenge

> **GridChallenge** = `object`

If the authentication challenge is of type grid, the GridChallenge object will contain the grid challenge that the end user must answer.

## Properties

### challenge

> **challenge**: `GridChallengeCell`[]

The grid challenge specifies a list of grid cells that the user must answer in their challenge.

---

### gridInfo

> **gridInfo**: `GridInfo`[]

The grid details.

---

### numCharsPerCell

> **numCharsPerCell**: `number`

The numCharsPerCell value specifies the number of characters expected in the response for each cell as defined by current settings.
