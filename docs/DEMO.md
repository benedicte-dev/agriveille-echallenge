# Script de démonstration live (5 minutes)

Public : la personne qui présente AgriVeille au jury. Toutes les données viennent de `prisma/seed.ts`. Lancez `pnpm db:seed` juste avant la démo pour repartir d'un état propre (comptes, PIN, verrous, annonces, quittance de démo).

Remplacez `<URL>` par l'adresse du déploiement Vercel, ou par `http://localhost:3000` en local.

| Qui | Téléphone | PIN |
|---|---|---|
| Ablawa Houénou, exploitante à Bohicon | +229 01 97 00 00 01 | 1234 |
| Carine Agossou, acheteuse | +229 01 97 00 00 10 | 1234 |
| Marcel Dossou, agent DDAEP Zou | +229 01 97 00 00 20 | 1234 |
| Administrateur | +229 01 97 00 00 99 | 9876 |

Conseil : ouvrez une fenêtre de navigation privée par rôle pour ne pas avoir à vous déconnecter entre les étapes.

## 1. Météo réelle et alerte en fon (1 min)

1. Ouvrez `<URL>/connexion` et connectez-vous en tant qu'Ablawa.
2. Dans `<URL>/app/parcelles`, ouvrez « Champ derrière la maison » (Bohicon). Les prévisions à 7 jours sont récupérées en direct chez Open-Meteo pour les coordonnées de la parcelle, puis le moteur de règles s'exécute.
3. Dans `<URL>/app/profil`, choisissez la langue fon.
4. Ouvrez `<URL>/app/alertes`, puis une alerte. Montrez le texte en fon et touchez « Écouter » pour la lecture audio.
5. Touchez « Accuser réception ».

Si la météo du jour ne déclenche aucune alerte, l'étape 3 (validation du signalement) en crée une, livrée à Ablawa.

## 2. Signalement d'un ravageur (40 s)

1. Toujours en tant qu'Ablawa, ouvrez `<URL>/app/signaler`.
2. Ajoutez une photo, choisissez la parcelle et, si besoin, le ravageur (par exemple la chenille légionnaire d'automne), puis envoyez.
3. Montrez le signalement dans `<URL>/app/signaler/mes-signalements`, au statut « en attente ».

Dites au jury que ce formulaire fonctionne aussi hors ligne : le signalement part dès que le réseau revient.

## 3. Validation par l'agent et alerte de zone (50 s)

1. Connectez-vous en tant que Marcel (agent) et ouvrez `<URL>/agent/signalements`.
2. Ouvrez le signalement d'Ablawa, gardez le rayon proposé (15 km) et confirmez.
3. Une alerte `PEST_OUTBREAK` est créée pour tous les producteurs dont une parcelle se trouve dans le rayon. Montrez-la dans `<URL>/agent/alertes`, puis le tableau de bord `<URL>/agent` (carte et taux d'accusés).

## 4. Marché : vente et offre (40 s)

1. En tant qu'Ablawa, montrez `<URL>/app/marche`, puis publiez une annonce depuis `<URL>/app/marche/nouvelle`.
2. Connectez-vous en tant que Carine (acheteuse), ouvrez `<URL>/acheteur` et faites une offre sur l'annonce.
3. De retour chez Ablawa, acceptez l'offre dans `<URL>/app/marche`.

Les prix de référence publics se trouvent sur `<URL>/marche`.

## 5. Redevance, quittance QR et vérification publique (50 s)

1. En tant qu'Ablawa, ouvrez `<URL>/app/redevances` et déclarez une vente. Précisez que le montant est calculé par le serveur.
2. Ouvrez la quittance : elle comporte un numéro `AV-2026-…` et un QR. Le bouton « Payer (démo) » est étiqueté comme une simulation.
3. Dans une fenêtre non connectée, ouvrez `<URL>/verifier/DEMOAV2026QR`. C'est la quittance de démo `AV-2026-000001`, vérifiable par n'importe qui sans compte.

## 6. USSD simulé (30 s)

1. En tant que Marcel, ouvrez `<URL>/agent/sms`.
2. Dans le simulateur USSD `*229*1#`, tapez les chiffres du menu. Montrez aussi la boîte d'envoi SMS simulée, où arrivent les alertes. Tout est étiqueté DÉMO : aucun SMS réel n'est envoyé.

## 7. CMS administrateur (30 s)

1. Connectez-vous en tant qu'administrateur et ouvrez `<URL>/admin`.
2. Modifiez une culture (`/admin/cultures`) ou une fiche réglementaire (`/admin/reglementation`), puis montrez le résultat sur `<URL>/reglementation`.
3. Terminez sur `<URL>/admin/audit` : chaque action de l'agent pendant la démo y figure.

Si le temps le permet, montrez les diagrammes UML dans le dépôt (`docs/uml/README.md`).
