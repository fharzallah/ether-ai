# ETHER — Guide de déploiement

## 1. GitHub Releases (Auto-updater)

### Créer le repo
```bash
cd /Users/hichemharzallah/Desktop/Claude\ Code/ether-app
git init
git add -A
git commit -m "ETHER v1.0.0"
gh repo create ether-ai --private --source=. --push
```

### Configurer les variables
Dans `package.json`, remplacer `OWNER` par ton username GitHub dans :
- `repository.url`
- `build.publish[0].owner`

### Publier une release
```bash
# Creer un token GitHub : https://github.com/settings/tokens
export GH_TOKEN=ton_token_github

# Build + publish
npm run release
```

L'auto-updater vérifiera automatiquement les nouvelles releases toutes les 4 heures.

## 2. Cloudflare Workers (Backend API)

### Créer le compte
1. https://dash.cloudflare.com/sign-up
2. Installer wrangler: `npm install -g wrangler`
3. Se connecter: `npx wrangler login`

### Déployer
```bash
cd worker/
npx wrangler deploy
```

### Configurer les secrets
```bash
npx wrangler secret put GROQ_KEY
npx wrangler secret put GEMINI_KEY
npx wrangler secret put CEREBRAS_KEY
npx wrangler secret put JWT_SECRET
npx wrangler secret put STRIPE_SECRET      # quand Stripe est prêt
npx wrangler secret put STRIPE_PRICE_ID    # ID du prix Pro
```

## 3. Stripe (Paiement Pro)

### Créer le compte
1. https://dashboard.stripe.com/register
2. Créer un produit "ETHER Pro" à 9.99€/mois
3. Copier le `price_id` (format: `price_xxx`)
4. Copier la clé secrète API (format: `sk_live_xxx`)

### Configurer le webhook
1. Stripe Dashboard > Developers > Webhooks
2. URL: `https://ether-api.ton-compte.workers.dev/api/stripe/webhook`
3. Events: `checkout.session.completed`, `customer.subscription.deleted`
