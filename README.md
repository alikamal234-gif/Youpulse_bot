# 🤖 YouPulse — Bot Discord de Relais Bidirectionnel Sécurisé

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/discord.js-v14-blue.svg)](https://discord.js.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Code Quality](https://img.shields.io/badge/Linter-ESLint_v9-purple.svg)](https://eslint.org/)

YouPulse est un bot Discord professionnel développé en **Node.js (ES Modules)** avec **discord.js v14**. Il offre un système de **relais bidirectionnel étanche et sécurisé** entre les messages privés (MP) du propriétaire du bot et un salon Discord configurable, tout en fournissant une suite de commandes slash administratives et un serveur de surveillance de santé.

---

## 📑 Table des Matières

1. [Fonctionnalités Principales](#-fonctionnalités-principales)
2. [Architecture du Projet](#-architecture-du-projet)
3. [Prérequis](#-prérequis)
4. [Configuration du Discord Developer Portal](#-configuration-du-discord-developer-portal)
5. [Installation et Configuration Locale](#-installation-et-configuration-locale)
6. [Enregistrement des Commandes Slash](#-enregistrement-des-commandes-slash)
7. [Lancement du Bot](#-lancement-du-bot)
8. [Commandes Slash Disponibles](#-commandes-slash-disponibles)
9. [Tests et Qualité de Code](#-tests-et-qualité-de-code)
10. [Guide de Test Manuel des Fonctionnalités](#-guide-de-test-manuel-des-fonctionnalités)
11. [Publication sur GitHub](#-publication-sur-github)
12. [Hébergement Gratuit (Processus Persistant 24/7)](#-hébergement-gratuit-processus-persistant-247)
13. [Résolution des Pannes (Troubleshooting)](#-résolution-des-pannes-troubleshooting)
14. [Sécurité et Bonnes Pratiques](#-sécurité-et-bonnes-pratiques)

---

## ✨ Fonctionnalités Principales

### 🔄 1. Relais MP Propriétaire ➔ Salon Discord
- **Filtrage strict** : Seul l'identifiant Discord configuré en tant que propriétaire (`DISCORD_OWNER_ID`) peut déclencher la transmission.
- **Support multimédia** : Retransmission fidèle du texte, des emojis Unicode, des émojis personnalisés Discord et des pièces jointes (images, PDF, archives, jusqu'à 25 Mo).
- **Accusé de réception privé** : Le bot confirme instantanément au propriétaire en MP la bonne livraison du message dans le salon cible avec un lien direct vers le message publié.
- **Gestion des cas limites** : Rejet des messages vides, détection des fichiers trop volumineux et messages d'erreur détaillés en cas de permissions de salon insuffisantes.

### 📬 2. Relais Salon Discord ➔ MP Propriétaire
- **Surveillance ciblée** : Écoute exclusivement les messages provenant du salon configuré.
- **Protection anti-boucle** : Ignore automatiquement les messages postés par le bot lui-même et filtre les messages d'autres bots pour éviter les tempêtes de notifications.
- **Embed de notification riche** : Indique l'auteur (pseudo + avatar), le salon d'origine, le message formaté, la prévisualisation des images et un lien direct pour sauter au message.
- **Résilience** : Capture propre des refus de DM Discord (erreur API `50007`) sans faire planter le processus du bot.

### 🛡️ 3. Sécurité Avancée
- Secrets externalisés dans `.env` et strictement ignorés dans Git (`.gitignore`).
- Filtre assainisseur automatique dans le système de logs (`logger.js`) masquant les tokens Discord pour parer à toute fuite accidentelle.
- Arrêt gracieux (`SIGINT` / `SIGTERM`) avec fermeture propre de la Gateway Discord et des serveurs HTTP.

---

## 📁 Architecture du Projet

```text
Youpulse_bot/
├── src/
│   ├── index.js                  # Point d'entrée principal (Client, Intents, Health Server, Arrêt gracieux)
│   ├── config.js                 # Validation stricte des variables d'environnement (Snowflakes, Token)
│   ├── commands/                 # Définitions et logique des commandes slash
│   │   ├── index.js              # Registre centralisé et collection Map des commandes
│   │   ├── ping.js               # Mesure de latence WebSocket et API roundtrip
│   │   ├── help.js               # Menu d'aide contextuel (Public vs Propriétaire)
│   │   ├── setchannel.js         # Configuration dynamique du salon de destination
│   │   ├── status.js             # Diagnostic complet (Salon actif, Uptime, RAM, Gateway)
│   │   ├── testdm.js             # Test de connectivité des messages privés vers le propriétaire
│   │   ├── send.js               # Envoi direct dans le salon avec pièces jointes
│   │   └── uptime.js             # Temps d'activité formaté du processus
│   ├── events/                   # Gestionnaires d'événements Discord Gateway
│   │   ├── ready.js              # Initialisation, log de présence et configuration salon
│   │   ├── messageCreate.js      # Aiguillage des messages (DM vs Serveur)
│   │   └── interactionCreate.js  # Traitement et contrôle d'accès des commandes slash
│   ├── services/
│   │   ├── messageRelay.js       # Logique métier de relais bidirectionnel et embeds
│   │   └── channelStore.js       # Persistance locale (JSON) du salon actif
│   └── utils/
│       └── logger.js             # Logger horodaté avec assainissement des tokens
├── scripts/
│   └── deploy-commands.js        # Déploiement REST des commandes slash (Global ou Guilde)
├── tests/                        # Tests unitaires natifs Node.js (node:test)
│   ├── auth.test.js              # Tests d'authentification du propriétaire
│   ├── config.test.js            # Tests de validation des identifiants snowflakes
│   ├── relay.test.js             # Tests de taille de pièces jointes et construction d'embed
│   └── uptime.test.js            # Tests du formateur d'uptime
├── data/
│   ├── .gitkeep
│   └── channel-config.json       # Sauvegarde automatique du salon configuré à chaud
├── .env.example                  # Modèle d'environnement avec placeholders
├── .gitignore                    # Exclusion de node_modules, .env et fichiers sensibles
├── eslint.config.js              # Configuration ESLint v9 Flat Config
├── package.json                  # Dépendances et scripts de démarrage
└── LICENSE                       # Licence MIT
```

---

## 🛠️ Prérequis

- **Node.js** : Version 18.0.0 ou supérieure (recommandé : Node.js 20 ou 22 LTS).
- **npm** : Gestionnaire de paquets Node.js (inclus avec Node.js).
- Un compte Discord avec les droits d'administration sur le serveur Discord de destination.

---

## 🎮 Configuration du Discord Developer Portal

Suivez ces étapes précises pour créer votre application et obtenir vos identifiants :

### Étape 1 : Créer l'Application
1. Rendez-vous sur le [Discord Developer Portal](https://discord.com/developers/applications).
2. Cliquez sur **New Application** en haut à droite.
3. Nommez votre application (ex: `YouPulse`) et acceptez les conditions.
4. Dans l'onglet **General Information**, copiez l'**Application ID** : il s'agit de votre `DISCORD_CLIENT_ID`.

### Étape 2 : Créer le Bot et Activer les Intents Privilégiés (CRUCIAL)
1. Dans le menu de gauche, rendez-vous dans la section **Bot**.
2. Cliquez sur **Reset Token** pour générer un jeton secret et copiez-le : il s'agit de votre `DISCORD_TOKEN`.
3. Faites défiler la page vers le bas jusqu'à la section **Privileged Gateway Intents**.
4. **Activez impérativement la case `Message Content Intent`** (cette option est indispensable pour que le bot puisse lire le contenu des messages à relayer).
5. Cliquez sur **Save Changes** en bas de l'écran.

### Étape 3 : Inviter le Bot sur votre Serveur
1. Dans le menu de gauche, allez dans **OAuth2** ➔ **URL Generator**.
2. Dans **Scopes**, cochez :
   - `bot`
   - `applications.commands`
3. Dans **Bot Permissions**, cochez les permissions minimales requises :
   - `View Channels` (Voir les salons)
   - `Send Messages` (Envoyer des messages)
   - `Embed Links` (Intégrer des liens)
   - `Attach Files` (Joindre des fichiers)
   - `Read Message History` (Voir les anciens messages)
4. Copiez l'URL générée en bas et collez-la dans votre navigateur pour ajouter le bot à votre serveur.

### Étape 4 : Récupérer votre Discord User ID et l'ID du Salon
1. Dans les paramètres de votre application Discord (sur PC ou Mobile) :
   - Rendez-vous dans **Paramètres utilisateur** ➔ **Avancés**.
   - Cochez **Mode Développeur**.
2. Faites un clic droit sur votre propre profil / avatar dans la liste des membres ➔ **Copier l'identifiant** : il s'agit de votre `DISCORD_OWNER_ID`.
3. Faites un clic droit sur le salon textuel de destination ➔ **Copier l'identifiant** : il s'agit de votre `DISCORD_CHANNEL_ID` (optionnel au départ).

---

## 🚀 Installation et Configuration Locale

### 1. Cloner ou ouvrir le projet
Ouvrez votre terminal dans le répertoire du projet :
```bash
cd Youpulse_bot
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configurer les variables d'environnement
Créez votre fichier `.env` à partir du fichier d'exemple :
```bash
cp .env.example .env
```
*(Sous Windows PowerShell : `Copy-Item .env.example .env`)*

Éditez le fichier `.env` avec vos vraies valeurs :
```ini
# Jeton secret du bot
DISCORD_TOKEN=votre_token_secret_discord

# Identifiant client de l'application (Application ID)
DISCORD_CLIENT_ID=votre_client_id

# Votre identifiant Discord personnel (User ID du propriétaire)
DISCORD_OWNER_ID=votre_user_id

# (Optionnel) Identifiant du salon Discord de destination par défaut
DISCORD_CHANNEL_ID=

# (Optionnel) ID du serveur pour tester immédiatement les commandes slash en dev
DISCORD_GUILD_ID=

# Port pour le serveur HTTP de santé (Health-check Cloud)
PORT=3000

# Niveau de logs (info, debug, warn, error)
LOG_LEVEL=info
```

---

## ⚡ Enregistrement des Commandes Slash

Les commandes slash doivent être enregistrées auprès de l'API REST de Discord avant de pouvoir apparaître dans votre interface.

Exécutez le script dédié :
```bash
npm run deploy-commands
```

- **Si `DISCORD_GUILD_ID` est renseigné dans `.env`** : L'enregistrement est instantané sur votre serveur de test (idéal pour le développement).
- **Si `DISCORD_GUILD_ID` est vide** : Les commandes sont enregistrées au niveau **global** (elles deviennent accessibles sur tous les serveurs et en message privé, sous 1 à 5 minutes selon la réplication Discord).

---

## 🖥️ Lancement du Bot

### Mode Production
```bash
npm start
```

### Mode Développement (rechargement automatique)
```bash
npm run dev
```

Une fois démarré, vous devriez observer un affichage similaire à :
```text
[INFO] [ChannelStore] Salon chargé...
[INFO] Démarrage de YouPulse Bot...
[INFO] 7 commande(s) slash chargée(s) en mémoire.
[INFO] Serveur HTTP de santé en écoute sur le port 3000 (Endpoint /health)
[INFO] 🤖 Connecté avec succès en tant que : YouPulse#1234
[INFO] 🚀 YouPulse Bot est prêt et à l'écoute des événements !
```

---

## 📋 Commandes Slash Disponibles

| Commande | Accès | Description |
| :--- | :--- | :--- |
| `/ping` | 🌐 Tout le monde | Mesure la latence WebSocket et le temps de réponse API. |
| `/help` | 🌐 Tout le monde | Affiche le manuel d'utilisation et les privilèges. |
| `/uptime` | 🌐 Tout le monde | Affiche le temps de fonctionnement du bot et sa date de démarrage. |
| `/setchannel` | 🔒 Propriétaire | Configure le salon actif de publication et de notifications. |
| `/unsetchannel` | 🔒 Propriétaire | Supprime le salon configuré (désactive le relais vers/depuis le salon). |
| `/send` | 🔒 Propriétaire | Publie un message et/ou une pièce jointe dans le salon configuré. |
| `/status` | 🔒 Propriétaire | Diagnostics complets : salon actif, mémoire RAM, latence, ID propriétaire. |
| `/testdm` | 🔒 Propriétaire | Envoie un message privé de test pour vérifier la réception des alertes. |

> **Sécurité** : Si un membre quelconque tente d'exécuter une commande réservée au propriétaire, il reçoit une réponse éphémère d'accès refusé (`⛔ Accès refusé`) et l'incident est consigné dans les logs.

---

## 🧪 Tests et Qualité de Code

Le projet utilise le exécuteur de tests natif de Node.js (`node:test`) sans dépendances externes lourdes :

### Lancer la suite de tests automatisés :
```bash
npm test
```
*Vérifie 23 assertions unitaires couvrant l'autorisation du propriétaire, la validation des identifiants snowflakes, la limitation de taille des pièces jointes, la protection des emojis et le formatage d'uptime.*

### Vérifier la qualité du code (ESLint) :
```bash
npm run lint
```

---

## 🔍 Guide de Test Manuel des Fonctionnalités

Pour valider le fonctionnement complet en conditions réelles avec votre propre serveur Discord :

### Test 1 : Définition du Salon Actif
1. Sur votre serveur Discord, tapez `/setchannel` et sélectionnez un salon textuel (ex: `#relais-youpulse`).
2. Le bot répond par un message éphémère confirmant que le salon est configuré et sauvegardé dans `data/channel-config.json`.

### Test 2 : Relais Privé (MP) ➔ Salon
1. Ouvrez une conversation privée en MP direct avec votre bot.
2. Envoyez un message texte avec des emojis Unicode et personnalisés (ex: `Bonjour ! 🔥🚀 <a:hype:123456>`).
3. Joignez une image ou un document (inférieur à 25 Mo).
4. **Résultat attendu** :
   - Le message et l'image apparaissent immédiatement dans le salon configuré.
   - Le bot vous répond en MP avec une coche verte : `✅ Message et 1 pièce(s) jointe(s) transmis dans #relais-youpulse ! (Lien)`.

### Test 3 : Relais Salon ➔ Privé (MP)
1. Demandez à un autre membre du serveur de poster un message ou une image dans `#relais-youpulse` (ou écrivez depuis un compte secondaire).
2. **Résultat attendu** :
   - Vous recevez instantanément un message privé du bot contenant un Embed soigné avec le pseudo de l'auteur, sa photo de profil, le contenu du message, l'image prévisualisée et un lien vers le message d'origine.

### Test 4 : Vérification des Permissions et de la Latence
1. Tapez `/status` pour voir l'état des ressources et le salon actuel.
2. Tapez `/testdm` pour tester l'envoi de messages privés et s'assurer que vos paramètres de confidentialité autorisent bien les MP du bot.

---

## 🐙 Publication sur GitHub

Pour versionner et publier votre code en toute sécurité sur GitHub **sans jamais risquer de publier vos clés privées** :

### 1. Initialiser le dépôt local
```bash
git init
git add .
git commit -m "feat: initial commit - YouPulse Discord Bot"
```

### 2. Vérifier que `.env` n'est PAS traqué
Exécutez :
```bash
git status
```
Assurez-vous que le fichier `.env` n'apparaît **jamais** dans les fichiers indexés. Seul `.env.example` doit être versionné.

### 3. Créer le dépôt sur GitHub et pousser le code
Créez un nouveau dépôt vide sur votre compte GitHub (ex: `Youpulse_bot`), puis liez et poussez :
```bash
git remote add origin https://github.com/VOTRE_PSEUDO/Youpulse_bot.git
git branch -M main
git push -u origin main
```

---

## ☁️ Hébergement Gratuit (Processus Persistant 24/7)

### ⚠️ Ce qu'il faut savoir sur les bots Discord et le Cloud
Un bot Discord nécessite une **connexion WebSocket persistante continue (Heartbeat Gateway)**.
- **Vercel / Netlify** : **Ne fonctionnent pas** pour un bot Discord car ils sont strictement conçus pour du serverless HTTP (processus tués après quelques secondes).
- **Render / Koyeb (Services Web gratuits)** : La plupart des tiers gratuits mettent les conteneurs en veille après 15 minutes s'il n'y a aucun trafic HTTP entrant, ce qui coupe la connexion du bot.

### Comparatif des Solutions Gratuites Vérifiées pour Processus Persistants :

| Plateforme | Type | Persistance 24/7 | Limitations Tiers Gratuit | Recommandation |
| :--- | :--- | :--- | :--- | :--- |
| **Oracle Cloud (OCI) Always Free** | Serveur VPS (Ubuntu) | ✅ **100% 24/7 Illimité** | Carte bancaire requise à l'inscription pour vérification d'identité | 🥇 **Meilleur choix ultime** |
| **Bot-Hosting.net / Discloud** | Panel Pterodactyl pour Bots | ✅ **24/7 continu** | Renouvellement manuel hebdomadaire gratuit ou pièces de présence | 🥈 **Le plus simple sans CB** |
| **Koyeb (Eco Free Instance)** | Conteneur Docker/Node.js | ⚠️ Nécessite un port HTTP | Nécessite que le serveur HTTP intégré `/health` soit actif | 🥉 **Bonne alternative Git** |
| **VPS / Raspberry Pi Local (PM2)** | Auto-hébergement | ✅ **100% 24/7 Illimité** | Nécessite que votre machine reste allumée | 💡 **Idéal en local** |

---

### Option A : Déploiement sur un VPS Gratuit (Oracle Cloud ou Linux avec PM2) — *Recommandé*

1. Connectez-vous en SSH à votre serveur :
   ```bash
   ssh ubuntu@ip-du-serveur
   ```
2. Installez Node.js 20+ et Git :
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   ```
3. Installez **PM2** (gestionnaire de processus persistant) :
   ```bash
   sudo npm install -g pm2
   ```
4. Clonez votre dépôt et installez les dépendances :
   ```bash
   git clone https://github.com/VOTRE_PSEUDO/Youpulse_bot.git
   cd Youpulse_bot
   npm install --omit=dev
   ```
5. Créez votre fichier `.env` sur le serveur :
   ```bash
   nano .env
   # Collez vos identifiants réels puis quittez avec Ctrl+O, Entrée, Ctrl+X
   ```
6. Déployez les commandes slash :
   ```bash
   npm run deploy-commands
   ```
7. Démarrez le bot avec PM2 pour qu'il tourne en permanence et redémarre automatiquement en cas de crash :
   ```bash
   pm2 start src/index.js --name "youpulse-bot"
   pm2 save
   pm2 startup
   ```
8. Consulter les logs à tout moment :
   ```bash
   pm2 logs youpulse-bot
   ```

---

### Option B : Déploiement sur Bot-Hosting.net (Spécialisé Discord Bots)

1. Créez un compte sur [bot-hosting.net](https://bot-hosting.net/).
2. Créez un serveur gratuit **Node.js**.
3. Dans l'onglet **Startup**, vérifiez que le fichier de démarrage est `src/index.js`.
4. Dans l'onglet **Environment Variables**, définissez vos variables :
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_OWNER_ID`
5. Uploadez vos fichiers (ou connectez votre dépôt GitHub).
6. Lancez le conteneur : le bot reste en ligne 24h/24 sans mise en veille HTTP.

---

### Option C : Déploiement sur Koyeb (via GitHub)

YouPulse intègre un serveur HTTP natif de contrôle de santé (`src/index.js`) qui écoute sur la variable `PORT` (par exemple port 3000) et répond `200 OK` sur `/health`.

1. Créez un compte sur [Koyeb](https://www.koyeb.com/).
2. Créez un **New App** ➔ Choisissez **GitHub**.
3. Sélectionnez votre dépôt `Youpulse_bot`.
4. Configurez :
   - **Build Command** : `npm install`
   - **Run Command** : `node scripts/deploy-commands.js && node src/index.js`
5. Dans la section **Environment Variables**, renseignez :
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_OWNER_ID`
   - `PORT` = `3000`
6. Cliquez sur **Deploy**.

---

## 🛠️ Résolution des Pannes (Troubleshooting)

### 1. `Échec de connexion : Used disallowed intents`
- **Cause** : Vous avez oublié d'activer les intents privilégiés dans le Discord Developer Portal.
- **Solution** :
  1. Rendez-vous sur `https://discord.com/developers/applications/VOTRE_CLIENT_ID/bot`.
  2. Descendez jusqu'à **Privileged Gateway Intents**.
  3. Cochez **Message Content Intent**.
  4. Sauvegardez et relancez le bot.

### 2. `Erreur 50007 : Cannot send messages to this user`
- **Cause** : Le bot tente de vous envoyer un message privé, mais vos paramètres de confidentialité Discord bloquent les MP provenant des membres du serveur.
- **Solution** :
  1. Clic droit sur l'icône du serveur Discord en commun avec le bot.
  2. Ouvrez **Paramètres de confidentialité**.
  3. Activez **Messages privés** provenant des membres du serveur.
  4. Testez avec `/testdm`.

### 3. `Les commandes slash n'apparaissent pas sur Discord`
- **Cause** : Les commandes globales prennent jusqu'à 5-10 minutes à se propager sur Discord, ou le script de déploiement n'a pas été lancé.
- **Solution** :
  - Renseignez temporairement `DISCORD_GUILD_ID=ID_DE_VOTRE_SERVEUR` dans votre `.env` et lancez `npm run deploy-commands` pour une apparition immédiate.

### 4. `Missing Permissions / Erreur d'accès au salon`
- **Cause** : Le bot n'a pas les droits pour lire ou écrire dans le salon sélectionné.
- **Solution** : Dans les permissions du salon Discord, assurez-vous que le rôle du bot possède :
  - *Voir le salon*
  - *Envoyer des messages*
  - *Intégrer des liens*
  - *Joindre des fichiers*

---

## 🔒 Sécurité et Bonnes Pratiques

1. **Ne partagez JAMAIS votre token** : Votre jeton donne le contrôle total sur votre bot. Si vous le divulguez par erreur, régénérez-le immédiatement sur le Discord Developer Portal.
2. **Vérification d'identité systématique** : Toutes les commandes sensibles (`/setchannel`, `/send`, `/status`, `/testdm`) et le relais MP vérifient strictement que l'ID de l'auteur correspond à `config.ownerId`.
3. **Protection contre les attaques par déni de service (DDoS)** : Les fichiers joints sont limités à 25 Mo pour respecter les quotas de l'API Discord et éviter de saturer la bande passante.
4. **Logs assainis** : Le module `logger.js` filtre automatiquement les patterns de jetons Discord pour empêcher toute fuite dans les journaux d'exécution du serveur.

---

## 📄 Licence

Ce projet est sous licence libre **MIT**. Consultez le fichier [LICENSE](LICENSE) pour plus de détails.
