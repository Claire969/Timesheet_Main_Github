# Timesheet App

Application Timesheet minimaliste avec authentification Supabase via Microsoft Azure OAuth.

## Stack Technique

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **Authentification**: Supabase Auth avec Microsoft Azure (OAuth PKCE)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## Prérequis

- Node.js 18+ et npm
- Un projet Supabase configuré
- Une application Azure AD configurée pour OAuth

## Configuration Supabase

### 1. Configuration Azure AD

Dans le portail Azure:
1. Créez une application Azure AD
2. Notez l'Application (client) ID et le Directory (tenant) ID
3. Créez un secret client
4. Ajoutez l'URL de redirection: `https://daily.clearcomputing.be/supabase/auth/v1/callback`

### 2. Configuration Supabase

Dans votre projet Supabase:
1. Allez dans Authentication > Providers
2. Activez le provider "Azure"
3. Entrez:
   - **Azure Tenant ID**: votre tenant ID
   - **Azure Client ID**: votre application ID
   - **Azure Secret**: votre secret client
4. L'URL de redirection sera automatiquement configurée

## Installation

1. **Cloner et installer les dépendances**

```bash
npm install
```

2. **Configurer les variables d'environnement**

Le fichier `.env` contient déjà les variables nécessaires:

```env
VITE_SUPABASE_URL=https://daily.clearcomputing.be/supabase
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Assurez-vous que `VITE_SUPABASE_ANON_KEY` contient votre clé publique Supabase.

## Développement

```bash
npm run dev
```

L'application sera accessible sur `http://localhost:5173`

## Production

### Build

```bash
npm run build
```

### Preview

```bash
npm preview
```

## Structure du Projet

```
src/
├── lib/
│   └── supabaseClient.ts      # Client Supabase avec PKCE
├── contexts/
│   └── AuthContext.tsx         # Contexte d'authentification
├── components/
│   └── RequireAuth.tsx         # Garde de route
├── pages/
│   ├── Login.tsx               # Page de connexion
│   ├── AuthCallback.tsx        # Page de callback OAuth
│   └── Home.tsx                # Page d'accueil protégée
├── App.tsx                     # Configuration des routes
└── main.tsx                    # Point d'entrée
```

## Flux d'Authentification

1. **Page Login** (`/login`)
   - Affiche un bouton "Se connecter avec Microsoft"
   - Redirige vers Microsoft pour l'authentification OAuth
   - Utilise le flow PKCE pour plus de sécurité

2. **Page Callback** (`/auth/callback`)
   - Reçoit le code d'autorisation de Microsoft
   - Échange le code contre une session via `exchangeCodeForSession()`
   - Gère les erreurs éventuelles
   - Redirige vers la page d'accueil

3. **Page Home** (`/`)
   - Protégée par le composant `RequireAuth`
   - Affiche les informations de l'utilisateur connecté
   - Permet la déconnexion

## Sécurité

- **PKCE Flow**: Protection contre les attaques d'interception de code
- **Auto Refresh**: Les tokens sont automatiquement rafraîchis
- **Session Persistence**: La session est sauvegardée dans localStorage
- **Protected Routes**: Les routes sont protégées par le guard `RequireAuth`

## Configuration Proxy

L'application est conçue pour fonctionner derrière un reverse-proxy HTTPS.
L'URL Supabase pointe vers `https://daily.clearcomputing.be/supabase` qui proxie vers votre instance Supabase.

## Déploiement

L'application peut être déployée sur n'importe quelle plateforme supportant les applications statiques:

- Vercel
- Netlify
- Cloudflare Pages
- AWS S3 + CloudFront

Assurez-vous de:
1. Configurer les variables d'environnement
2. Configurer les redirections pour le routing côté client
3. Ajouter les URLs de callback dans la configuration Azure AD et Supabase

## Dépannage

### L'authentification ne fonctionne pas

1. Vérifiez que l'URL de callback est correctement configurée dans Azure AD
2. Vérifiez que le provider Azure est activé dans Supabase
3. Vérifiez les credentials Azure (client ID, tenant ID, secret)
4. Consultez la console du navigateur pour les erreurs

### Erreur CORS

Si vous rencontrez des erreurs CORS, vérifiez:
1. Que l'URL Supabase dans `.env` est correcte
2. Que le proxy reverse est correctement configuré
3. Que les headers CORS sont configurés dans Supabase

## Scripts Disponibles

- `npm run dev` - Démarre le serveur de développement
- `npm run build` - Build l'application pour la production
- `npm run preview` - Preview du build de production
- `npm run lint` - Linter le code
- `npm run typecheck` - Vérifier les types TypeScript

## Support

Pour toute question ou problème, consultez:
- [Documentation Supabase Auth](https://supabase.com/docs/guides/auth)
- [Documentation Azure AD](https://docs.microsoft.com/azure/active-directory/)
- [Documentation React Router](https://reactrouter.com/)
