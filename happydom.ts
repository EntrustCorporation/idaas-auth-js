import { GlobalRegistrator } from "@happy-dom/global-registrator";

process.env.IDAAS_AUTH_JS_ALLOW_MEMORY_DPOP_KEY_STORE = "true";

GlobalRegistrator.register();
