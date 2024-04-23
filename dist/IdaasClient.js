export class IdaasClient {
    issuerUrl;
    config = null;
    getCrypto = () => {
        return window.crypto;
    };
    openPopup = (url) => {
        const width = 400;
        const height = 600;
        const left = window.screenX + (window.innerWidth - width) / 2;
        const top = window.screenY + (window.innerHeight - height) / 2;
        return window.open(url, '', `left=${left},top=${top},width=${width},height=${height},resizable,scrollbars=yes,status=1`);
    };
    sha256 = async (s) => {
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        const digestOp = this.getCrypto().subtle.digest({ name: 'SHA-256' }, new TextEncoder().encode(s));
        return await digestOp;
    };
    urlEncodeB64 = (input) => {
        const b64Chars = { '+': '-', '/': '_', '=': '' };
        return input.replace(/[+/=]/g, (m) => b64Chars[m]);
    };
    createRandomString = () => {
        const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_~.';
        let random = '';
        const randomValues = Array.from(this.getCrypto().getRandomValues(new Uint8Array(43)));
        // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
        // biome-ignore lint/complexity/noForEach: <explanation>
        randomValues.forEach(v => (random += charset[v % charset.length]));
        return random;
    };
    bufferToBase64UrlEncoded = (input) => {
        const ie11SafeInput = new Uint8Array(input);
        return this.urlEncodeB64(window.btoa(String.fromCharCode(...Array.from(ie11SafeInput))));
    };
    encode = (value) => btoa(value);
    constructor(issuerUrl) {
        this.issuerUrl = issuerUrl;
    }
    async loadConfiguration() {
        const wellKnownUrl = `${this.issuerUrl}/.well-known/openid-configuration`;
        try {
            const response = await fetch(wellKnownUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch OIDC configuration: ${response.statusText}`);
            }
            this.config = await response.json();
            console.log("OIDC Configuration loaded:", this.config);
        }
        catch (error) {
            throw new Error(`Failed to load OIDC configuration: ${error}`);
        }
    }
    async authenticate(redirectUri, clientId, scope = "openid profile email", responseType = "code") {
        if (!this.config) {
            throw new Error("OIDC Configuration is not loaded.");
        }
        const state = this.encode(this.createRandomString());
        const nonce = this.encode(this.createRandomString());
        const code_verifier = this.createRandomString();
        const code_challengeBuffer = await this.sha256(code_verifier);
        const code_challenge = this.bufferToBase64UrlEncoded(code_challengeBuffer);
        const url = new URL(this.config.authorization_endpoint);
        url.searchParams.append('response_type', responseType);
        url.searchParams.append('client_id', clientId);
        url.searchParams.append('redirect_uri', redirectUri);
        url.searchParams.append('scope', scope);
        url.searchParams.append('state', state);
        url.searchParams.append('nonce', nonce);
        // url.searchParams.append('audience', "https://ca.dev.entrustsecure-dev.com/");
        url.searchParams.append('response_mode', 'query');
        url.searchParams.append('code_challenge', code_challenge);
        url.searchParams.append('code_challenge_method', 'S256');
        window.location.href = url.toString();
        // this.openPopup(url.toString());
    }
}
//# sourceMappingURL=IdaasClient.js.map