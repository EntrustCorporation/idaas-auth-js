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

## Security

- **[Security Best Practices](./security-best-practices.md)** - Comprehensive security guidance for production deployments
  - Threat model and attack vectors
  - XSS, CSRF, MITM protection
  - Token security and storage

## Integration Guides

- **[AWS API Gateway Integration](./aws-api-gateway.md)** - Complete guide for securing AWS REST APIs with IDaaS authentication
  - Frontend SPA setup with SDK
  - Lambda Authorizer deployment and configuration
  - Step-up authentication for sensitive operations
  - Security best practices for AWS deployments
  - Complete React examples and troubleshooting

## Technical Deep Dives

- **[JWT IDaaS Grant Type](./jwt-idaas-grant.md)** - Understand the custom `jwt_idaas` OAuth grant type
  - How the JWT grant flow works
  - Token exchange process
  - Security considerations
  - PKCE implementation details

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
