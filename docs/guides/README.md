# Authentication Guides

This section contains comprehensive guides for implementing authentication with the IDaaS Auth JS SDK.

## Getting Started

- **[Quickstart](../quickstart.md)** - Get up and running quickly with basic SDK configuration and your first authentication flow

## Core Concepts

- **[Choosing an Authentication Approach](./choosing-an-approach.md)** - Understand when to use OIDC, RBA, or convenience methods for your application

## Authentication Flows

### Hosted Authentication

- **[OIDC Guide](./oidc.md)** - Implement hosted login and logout flows using IDaaS-managed UI
  - Redirect-based login
  - Popup-based login
  - Session management
  - Logout flows

### Self-Hosted Authentication

- **[Risk-Based Authentication (RBA) Guide](./rba.md)** - Build custom authentication UI with risk-based challenge evaluation
  - Challenge request lifecycle
  - Risk evaluation and Resource Rules
  - Multi-factor authentication flows
  - Transaction details for risk assessment
  - Polling and cancellation

- **[Convenience Auth Guide](./auth.md)** - Use simplified helper methods for common authentication scenarios
  - Password authentication
  - Passwordless (Passkey, Magic Link)
  - Multi-factor methods (OTP, Soft Token, Smart Credential)
  - Biometric authentication (Face)
  - Knowledge-based authentication (Grid, KBA)

- **[Step-Up Authentication Guide](./step-up.md)** - Handle API `WWW-Authenticate` step-up challenges and satisfy them with `parseResponse` plus `requestChallenge`
  - Parse RFC 9470 and RFC 6750 challenge responses
  - Re-run authentication with required token constraints
  - Retry protected API operations with upgraded tokens

- **[DPoP Protected Resource Requests](./dpop.md)** - Call APIs that enforce RFC 9449 proof-of-possession access tokens
  - Request DPoP-bound access tokens
  - Create DPoP request headers with `getDpopHeaders()`
  - Understand protected resource verification requirements

## Security

- **[Security Best Practices](./security-best-practices.md)** - Comprehensive security guidance for production deployments
  - Threat model and attack vectors
  - XSS, CSRF, MITM protection
  - Token security and storage

## Integration Guides

- **[AWS API Gateway Integration](./aws-api-gateway.md)** - Protect AWS HTTP API endpoints using API Gateway built-in JWT authorizer and route scopes
  - Frontend SPA setup with SDK
  - API Gateway JWT authorizer configuration (issuer + audience)
  - Route-level scope enforcement (`authorizationScopes`)
  - Optional step-up integration for sensitive operations
  - Security best practices for AWS deployments
  - Troubleshooting token audience and scope mismatch issues

## Technical Deep Dives

- **[JWT IDaaS Grant Type](./jwt-idaas-grant.md)** - Understand the custom `jwt_idaas` OAuth grant type
  - How the JWT grant flow works
  - Token exchange process
  - Security considerations
  - PKCE implementation details

## Migration Notes

- **[Upgrade Guide](./upgrade-guide.md)** - canonical landing page for breaking changes
  - Add future breaking changes here as new versions are released
  - Before/after examples for API changes

## Code Examples

- **[Self-Hosted UI Examples](../self-hosted.md)** - Complete code examples for building custom authentication experiences
  - OTP (SMS/Email/TOTP)
  - Passkey (WebAuthn/FIDO2)
  - Soft Token with push notifications
  - Grid card authentication
  - Knowledge-based authentication (KBA)
  - Temporary access codes
  - Magic links
  - Smart Credential push
  - Face biometrics (Onfido)

## Additional Resources

- **[API Reference](../api/README.md)** - Complete API documentation for all SDK methods
- **[Troubleshooting](../troubleshooting.md)** - Solutions to common issues and error messages
- **[Overview](../index.md)** - High-level architecture and SDK design principles
