# Rove

Rove is a personal wardrobe app. You photograph your clothes, Rove cuts each garment out in the browser, and then you browse your closet, build outfits on a canvas, and plan looks on a calendar.

It's a Next.js App Router app running on [vinext](https://github.com/cloudflare/vinext) as a Cloudflare Worker:

- **D1** (`DB`) stores pieces, imports, looks and plans. The Drizzle schema is in `db/schema.ts`, and the migrations are in `drizzle/`.
- **R2** (`BUCKET`) stores the uploaded photos and the garment cut-outs.
- **Cloudflare Access** handles sign-in. `lib/auth.ts` verifies the Access JWT on every API request, and the user's Access `sub` is the key for their data.
- Garment segmentation runs on-device with `@huggingface/transformers` (`Xenova/segformer_b2_clothes`, about 29 MB once). The browser downloads the model through the Worker on first use.

## Local development

You need Node.js 22.13 or newer.

```sh
npm ci
npm run build             # once, so Wrangler can find the generated config
npm run db:migrate:local  # creates the tables in .wrangler/state
npm run dev               # http://localhost:5173
```

In `npm run dev`, Access isn't configured, so every request is treated as a single local user (`you@localhost`, or `DEV_USER_EMAIL` in `.dev.vars`). Production builds never take that path. If `ACCESS_TEAM_DOMAIN` or `ACCESS_AUD` is missing, the API refuses requests.

The other scripts:

- `npm run typecheck`, `npm run lint` and `npm test`: run the checks.
- `npm run test:e2e`: click through the main flows (closet search, building and saving a look, planning it) in Chromium on a desktop and a phone screen. It starts `npm run dev` for you and seeds its own pieces. Run `npx playwright install chromium` once first.
- `npm run preview`: serve the production build locally through Wrangler.
- `npm run db:generate`: create a new migration after you change `db/schema.ts`.

## Deploying to Cloudflare

You only need to do this once.

1. **Create the storage.** In the Cloudflare dashboard, create a D1 database named `rove` and an R2 bucket named `rove-closet`. Or run `npx wrangler d1 create rove` and `npx wrangler r2 bucket create rove-closet`. Put the D1 database ID in `database_id` in `wrangler.jsonc`.
2. **Connect the repo.** Go to Workers & Pages > Create > Import a repository and pick this repo. Use these settings:
   - Build command: `npm run build`
   - Deploy command: `npm run deploy` (it applies pending D1 migrations, then runs `wrangler deploy`)

   After this, every push to `main` deploys.

3. **Turn on sign-in.** On the deployed Worker, go to Settings > Domains & Routes and enable **Cloudflare Access** for the `workers.dev` route. Then go to Zero Trust > Access > Applications, open that application, and set its policy to allow only your email address. Copy the application's **AUD tag** and your **team domain** (`<team>.cloudflareaccess.com`) into `ACCESS_AUD` and `ACCESS_TEAM_DOMAIN` in `wrangler.jsonc`, then push. If you add a custom domain later, protect it with the same Access application.

Until step 3 is done, the deployed app loads but its API answers "Sign-in is not configured".

## Branch previews

Every push to a branch other than `main` builds a [Worker Preview](https://developers.cloudflare.com/workers/previews/) of `rove` with its own URL. Previews never use the production settings: the `previews` block in `wrangler.jsonc` binds them to a separate D1 database (`rove-preview`) and R2 bucket (`rove-closet-preview`), so nothing you do on a preview touches your real closet.

- When a branch adds a migration, apply it to the preview database with `npm run db:migrate:preview` before trying that branch's preview.
- To sign in on previews, protect the Worker's Preview URLs with the same Cloudflare Access application as the main app.

The `preview` environment in `wrangler.jsonc` (a standalone `rove-preview` Worker, deployed with `npm run deploy:preview`) uses the same database and bucket, if you'd rather try a branch on a fixed URL.

## Restoring the database

D1 keeps 30 days of history (Time Travel). If a bad change or a deploy damages the closet, restore the `rove` database to an earlier moment:

```sh
# See where you'd restore to
npx wrangler d1 time-travel info rove --timestamp "2026-10-05T12:00:00Z"
# Restore (the command prints a bookmark you can use to undo the restore)
npx wrangler d1 time-travel restore rove --timestamp "2026-10-05T12:00:00Z"
```

Photos live in the `rove-closet` R2 bucket, which has no history, so a restore brings back rows whose files were since deleted only if those files still exist. For a full copy of your closet, use **Export backup** in the side menu. It downloads a ZIP of every piece, look, plan and photo.
