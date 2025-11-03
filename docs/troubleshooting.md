# Troubleshooting

## Common issues

### Login popup blocked

Enable popups or use redirect flow.

### Access token missing

Ensure `oidc.login` completed and storage type supports current context.

### Invalid redirect URI

Verify the redirect URL is registered with the IDaaS tenant.

## Browser support

- Modern Chromium, Firefox, Safari.
- For older browsers, polyfill `fetch` and `Promise`.