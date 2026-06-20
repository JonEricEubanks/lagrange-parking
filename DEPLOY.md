# Deployment

The repo builds **two independent static apps** from one codebase (permit + public),
each hosted on its own **Azure Static Web App (Free plan)**. They're plain static
SPAs with **hash routing**, so no server or SPA-fallback rewrite rules are needed.

## Live sites

| App | Profile / build mode | Azure SWA resource | URL |
|-----|----------------------|--------------------|-----|
| **Permit** (residents · commuters & LT students · employees) | `lagrange-permit` (`--mode permit`) | `lagrange-parking-permit` | https://mango-cliff-087d26410.7.azurestaticapps.net |
| **Public** (visitor / time-based) | `lagrange-public` (`--mode public`) | `lagrange-parking-public` | https://ashy-mud-0b906db10.7.azurestaticapps.net |

## Azure resources

| | |
|---|---|
| Tenant | **Spark by MGP** (`Community-Essentials.com`, `ce08ca1a-3a87-472b-affa-217b4d4793ce`) |
| Subscription | **Microsoft Azure Sponsorship** (`b8f90e47-b8ee-45f1-9442-d3b4f8fd0695`) |
| Resource group | `rg-lagrange-parking` (region `centralus`) |
| SWA SKU | **Free** ($0 — 100 GB egress/mo, free managed TLS, custom domains) |

Recreate from scratch (idempotent):

```bash
az login --tenant Community-Essentials.com
az account set --subscription "Microsoft Azure Sponsorship"
az group create -n rg-lagrange-parking -l centralus
az staticwebapp create -n lagrange-parking-permit -g rg-lagrange-parking -l centralus --sku Free
az staticwebapp create -n lagrange-parking-public  -g rg-lagrange-parking -l centralus --sku Free
```

## Build

```bash
npm ci
npm run build        # → dist/permit and dist/public (both built with base "/")
```

Per-app build config lives in `.env.permit` / `.env.public` (`VITE_PROFILE`,
`VITE_BASE=/`, `VITE_OUTDIR`). `vite.config.ts` reads them per `--mode`.

> **`VITE_ARCGIS_API_KEY`** is read from `.env` (gitignored) and **baked into the
> bundle at build time**. It's a public client key (safe to ship) but should be
> **referrer-restricted** to the deploy domains in the ArcGIS developer dashboard.
> In CI it comes from the `VITE_ARCGIS_API_KEY` GitHub secret.

## Deploy (manual)

Each SWA has a deployment token. Fetch it and push the matching `dist/` folder with
the SWA CLI — the token is a secret, so don't paste or commit it:

```bash
# Permit
TOKEN=$(az staticwebapp secrets list -n lagrange-parking-permit -g rg-lagrange-parking \
          --query "properties.apiKey" -o tsv)
npx -y @azure/static-web-apps-cli deploy ./dist/permit --deployment-token "$TOKEN" --env production

# Public
TOKEN=$(az staticwebapp secrets list -n lagrange-parking-public -g rg-lagrange-parking \
          --query "properties.apiKey" -o tsv)
npx -y @azure/static-web-apps-cli deploy ./dist/public --deployment-token "$TOKEN" --env production
```

## Deploy (CI — optional, not yet wired)

`.github/workflows/deploy.yml` currently builds both apps and uploads `dist` as an
artifact (no deploy step). To make push-to-`main` auto-deploy, store each token as a
GitHub secret and add an `Azure/static-web-apps-deploy@v1` step per app:

```bash
gh secret set AZURE_SWA_TOKEN_PERMIT --body "$(az staticwebapp secrets list -n lagrange-parking-permit -g rg-lagrange-parking --query 'properties.apiKey' -o tsv)"
gh secret set AZURE_SWA_TOKEN_PUBLIC --body "$(az staticwebapp secrets list -n lagrange-parking-public -g rg-lagrange-parking --query 'properties.apiKey' -o tsv)"
```

Then each deploy step uses `azure_static_web_apps_api_token`, `app_location: dist/<app>`,
`skip_app_build: true` (the workflow already runs `npm run build`).

## Custom domains

When the Village provides hostnames:

```bash
az staticwebapp hostname set -n lagrange-parking-permit -g rg-lagrange-parking --hostname parking.villageoflagrange.com
```

Add the shown CNAME/TXT record at the DNS provider; Azure issues a free managed cert.
Then update the ArcGIS key's referrer allow-list to include the new domain.

## Prerequisites / gotchas

- **AGOL data must be shared publicly.** The hosted `LaGrange_Parking_Permits`
  feature service (and the `LaGrangeImportantPlaces_ParkingContext_` layer) must be
  shared **Public** in AGOL, or anonymous visitors get no data. See `README.md`.
- **Geolocation ("Locate me") needs a secure context** — works on the `https://`
  SWA URLs and `localhost`, but not over plain-HTTP IPs (e.g. a LAN/Tailscale dev URL).
- **GISC dynamic basemap** (`ags.gisconsortium.org`) and the AGOL feature services
  must remain reachable/public for the basemap, boundary/mask, road labels, and
  Important Places to render.
