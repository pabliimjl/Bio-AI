# Bio-AI

Frontend estatico para GitHub Pages con backend proxy en Cloudflare Workers (para ocultar API keys de OCR y LLM).

## 1) Desplegar backend proxy (Cloudflare Worker)

1. Instala Wrangler:
   - `npm install -g wrangler`
2. Autenticacion en Cloudflare:
   - `wrangler login`
3. Entra a la carpeta del worker:
   - `cd backend/cloudflare-worker`
4. Configura secretos (no se suben a Git):
   - `wrangler secret put OCR_SPACE_API_KEY`
   - `wrangler secret put LLM_API_KEY`
5. (Opcional) Ajusta `LLM_PROVIDER`/`LLM_MODEL` en `wrangler.toml`.
6. Despliega:
   - `wrangler deploy`
7. Guarda la URL publicada, por ejemplo:
   - `https://bio-ai-proxy.<tu-subdominio>.workers.dev`

## 2) Conectar frontend con el proxy

1. Abre `scripts/script.js`.
2. En `APP_CONFIG`, reemplaza `proxyBaseUrl` por la URL del Worker:
   - `proxyBaseUrl: "https://bio-ai-proxy.<tu-subdominio>.workers.dev"`
3. Haz commit y push.

## 3) GitHub Pages

1. En GitHub: Settings -> Pages.
2. Source: Deploy from a branch.
3. Branch: `main` y carpeta `/ (root)`.
4. Guarda y espera el deploy.

## 4) CORS recomendado

Para limitar quien consume tu proxy:

1. Edita `backend/cloudflare-worker/wrangler.toml`.
2. Descomenta `ALLOWED_ORIGIN` y pon tu dominio de Pages:
   - `ALLOWED_ORIGIN = "https://TU_USUARIO.github.io"`
3. Vuelve a desplegar con `wrangler deploy`.

## Nota importante

Aunque el backend oculta las keys en el repositorio, un proxy publico puede ser abusado si no se limita por origen y/o autenticacion.
