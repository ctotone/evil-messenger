## 1.0.0 — Préparation de la première version publique
- Version du module portée à `1.0.0`, sans modification du moteur ni de l'interface de la version 0.4.1.
- Intégration des quatre captures de présentation dans `assets/catalog/catalog_1.webp` à `catalog_4.webp`.
- Ajout du workflow manuel `.github/workflows/foundry-catalog-release.yml`, adapté de celui d'Evilbram CoC7 Chat Card Improvements : contrôle des assets GitHub, mode `dry-run` par défaut et publication explicite dans le catalogue Foundry.
- Le workflow attend une release GitHub déjà créée et le secret `FOUNDRY_RELEASE_TOKEN` dans les paramètres du dépôt.
- Aucune action distante, release ou publication réalisée à cette étape. Traductions à faire relire humainement avant publication.

## 0.4.1 DEV — README communautaire bilingue
- README réécrit pour les MJ et joueurs, réutilisable comme description longue dans le catalogue Foundry.
- Bloc Ko-fi bilingue en ouverture, adapté à Evilbram Messenger.
- Présentation française suivie de la version anglaise : fonctions, prise en main et informations pratiques.
- Aucune modification du fonctionnement du module, du design ni des traductions.

## 0.4.0 DEV — Internationalisation et nouveau bouton d’accès
- Bouton du répertoire des acteurs remplacé par le nouveau WebP désaturé, aux mêmes dimensions et sans modification des règles CSS.
- Interface entièrement localisée : allemand (`de`), anglais (`en`), espagnol (`es`), français (`fr`), italien (`it`) et portugais brésilien (`pt-BR`).
- Ajout des six dictionnaires `lang/*.json`, déclarés dans `module.json`. Langue choisie automatiquement depuis Foundry ; repli explicite en anglais pour les langues non couvertes et les éventuelles clés absentes.
- Textes traduits dans les trois fenêtres, les menus, les aides/infobulles, les notifications, la saisie, les messages d’erreur et les commandes de jets.
- Manifeste enrichi avec les coordonnées de l’auteur, la page des problèmes et une description anglaise destinée au catalogue international.
- Aucun changement volontaire des sockets, historiques, flags, permissions ni comportements de messagerie. Les traductions proposées nécessitent une relecture humaine avant publication.

## 0.3.9 DEV — Icône dédiée aux comptes MJ
- Intégration de l'icône fournie `assets/gm-avatar.webp` pour les comptes MJ dans les contacts et les en-têtes des conversations (centre MP et popup).
- Conservation des portraits de fiche pour les joueurs ; avatar utilisateur en repli si aucun personnage n'est attribué.
- Aucun changement des messages, données persistantes, sockets, permissions ou fonctionnalités ; styles validés conservés.

## 0.3.8 DEV — Fonds harmonisés et texture à 50 %
- Opacité de la texture de l'historique et du champ de rédaction réglée à `0.50`.
- Ajout d'un dégradé anthracite très discret, de même orientation et intensité, sur la colonne des contacts, les en-têtes, les panneaux de rédaction, la notification MJ et les bulles dans les deux interfaces.
- Conservation des teintes d'origine des bulles reçues et envoyées, du fond `#111` des historiques et des textures fixes déjà validées.
- Dégradé et ses deux couleurs centralisés dans des variables CSS ; aucune modification JavaScript ni des mécanismes de messagerie.

## 0.3.7 DEV — Texture continue et limitée au champ de rédaction
- Historique principal et popup : décor déplacé sur un calque fixe derrière la zone de défilement, pour éviter la bande visible en haut lorsque l'on fait défiler les messages.
- Rédaction : texture limitée au champ de saisie, le panneau entourant le champ reste intact.
- Variables d'opacité séparées conservées : `--em-pm-texture-history-opacity` et `--em-pm-texture-composer-opacity`.
- Scroll, bulles, boutons, données, présence, accusés « Vu » et sélection automatique inchangés.

## 0.3.6 DEV — Texture du chat et sélection initiale
- Ajout de la texture transparente fournie `assets/chat-texture.webp` dans l'historique et la zone de rédaction, au centre des MP comme dans la popup de réponse.
- Opacités indépendantes via `--em-pm-texture-history-opacity` et `--em-pm-texture-composer-opacity` ; seules les textures sont affectées, pas les bulles ou les textes.
- Zone de saisie légèrement translucide pour révéler la texture derrière le champ, réglable via `--em-pm-texture-input-background`.
- À l'ouverture d'une fenêtre, le contact actif sélectionné est déjà coché ; si une fenêtre déjà affichée est rouverte sans aucun destinataire coché, ce contact est automatiquement rétabli sans écraser une sélection multiple existante.
- Aucun changement du stockage, des permissions, des sockets ou d'Evil Toolbox.

## 0.3.5 DEV — Espacement de l'indicateur de saisie
- Réserve 14 px ajustables via `--em-pm-typing-clearance` sous la dernière bulle dans l'historique, pour distinguer clairement le message de l'indicateur « écrit… ».
- Les bulles ne se compressent plus dans les conteneurs flex quand l'historique défile (`flex-shrink: 0`).
- Quand l'indicateur apparaît, l'historique reste aligné sur le dernier message uniquement si l'utilisateur lisait déjà le bas de la conversation ; aucun défilement forcé pendant la lecture des anciens MP.
- Même comportement pour le centre de messagerie et la popup de réponse. Aucun changement des sockets, messages, permissions, données ou graphisme validé.

## 0.3.4 DEV — Canal de saisie multijoueur
- Déclaration `"socket": true` dans `module.json` pour activer le canal natif `module.evil-messenger` auprès du serveur Foundry.
- Correction ciblée de la cause identifiée de l’absence de l’indicateur « écrit… » entre comptes. Nécessite un redémarrage du monde après installation.
- Résolution des noms/portraits conservée : personnage explicitement attribué au compte (`user.character`), sans sélection arbitraire parmi les acteurs possédés.
- Sous-titres simplifiés dans les listes de contacts, l’en-tête de conversation et la popup : seul le pseudo du compte s’affiche lorsqu’un personnage est attribué (sans « Joueur · » ni « MJ · »). Sans personnage attribué, pas de sous-titre redondant.
- Aucun changement de JavaScript, de CSS, de permissions ni de stockage ; modification limitée au manifeste et aux templates.

## 0.3.3 DEV — Bulles compactes, portraits de fiche et sélection des contacts
- Réglages validés pour les positions de l'heure (1px / 20px), de la coche (2px / 1px) et ses dimensions (17 × 8 px), sans modifier le mécanisme de lecture.
- Bulles du centre MP et de la popup : largeur minimale 60 px, largeur maximale 78 %, padding latéral 14 px et vertical haut 4 px ; espace inférieur de 18 px pour l'horodatage et la coche, tous deux en position absolue.
- La pastille de connexion sur les avatars utilise désormais `--em-color-status-avatar-online: #1e8432`, distincte des autres indicateurs de statut.
- Source des portraits rendue explicite : image de la fiche du personnage attribué (`Actor.img`), et avatar de compte en repli si aucun personnage n'est attribué, y compris pour la notification MJ. La version précédente utilisait déjà `user.character.img`.
- Changement de conversation : un seul destinataire actif est automatiquement coché ; les anciens sont décochés. Les coches manuelles multiples restent possibles jusqu'au prochain changement de conversation. Un contact hors ligne reste consultable mais non cochable.
- Les signaux de saisie sont actualisés en cas de changement de destinataire pendant la rédaction.
- Aucun changement des flags, permissions, messages ni données persistées. Tests réels Foundry multijoueur encore nécessaires.

## 0.3.2 DEV — Double coche en image
- Remplacement de la double coche de lecture (icône Font Awesome) par une image dédiée `assets/pm-read-indicator.webp`.
- L’indicateur « Vu » est utilisé dans la fenêtre principale et dans la popup de réponse.
- Ajout des variables `--em-pm-read-width` et `--em-pm-read-height` pour ajuster facilement la taille via le CSS, en complément des variables de position déjà présentes.
- Le positionnement absolu est conservé : déplacer l’heure ou la coche n’augmente pas la hauteur automatique des bulles.

## 0.3.1 DEV — Horodatage et coche de lecture ajustables
- Heure placée à la limite basse droite de la bulle, sans réserver de hauteur supplémentaire.
- Double coche verte (`#038520`) à cheval sur le coin inférieur droit de la bulle, uniquement après consultation.
- Positionnement indépendant et ajustable avec quatre variables CSS (`--em-pm-time-bottom`, `--em-pm-time-right`, `--em-pm-read-bottom`, `--em-pm-read-right`) centralisées en haut de fichier.
- Même présentation dans le centre MP et la popup, sans modification du moteur de lecture ou des messages.

## 0.3.0 DEV — Accusés de lecture, saisie en direct et bulles simplifiées
- Accusés « Vu » persistants : chaque lecteur enregistre par contact le dernier MP reçu lorsqu'il affiche réellement la conversation, dans son propre flag User `evil-messenger.readThrough` ; le chat classique et la notification seule ne déclenchent aucune lecture.
- Double coche discrète après l'heure, uniquement sur les messages émis déjà consultés ; statut actualisé entre clients via `updateUser`.
- Indicateur de saisie animé dans le centre MP et la popup, synchronisé sur `module.evil-messenger` ; aucun texte transmis ni état sauvegardé, renouvellement limité et expiration automatique.
- Saisie multi-destinataires prise en charge à partir des cases cochées ; les messages restent indépendants pour chaque destinataire.
- Suppression des noms redondants au-dessus des bulles, et déplacement de l'heure dans leur coin inférieur droit sur les deux interfaces.
- La notification MJ conserve son fonctionnement ; ses boutons et le design validé ne sont pas modifiés.
- Nouvelle fonctionnalité non testée en session Foundry multijoueur : tests MJ↔joueur et joueur↔joueur nécessaires avant publication.

## 0.2.14 DEV — Notification MJ harmonisée
- Popup de notification MJ : l’icône enveloppe est remplacée par le portrait du personnage/joueur expéditeur, avec repli sur l’icône si aucune image n’est disponible.
- Boutons de notification : fond rouge sombre identique aux boutons d’envoi, hover rouge plus vif, padding 6 × 11 px, hauteur minimale 34 px, rayon 7 px, police 13 px et graisse 100.
- Le bouton « Voir le message » conserve sa bordure principale, tandis que « Ignorer » garde la bordure secondaire.
- Aucun changement des permissions, du stockage ou des comportements de messagerie.

## 0.2.13 DEV — Boutons d’envoi rouge sombre harmonisés
- Centre des MP : les boutons « Envoi classique » et « Envoi Popup » utilisent un fond `#39000096` et `#530202` au survol ; les bordures distinctes sont préservées.
- Popup de réponse : même fond et même état au survol, sans changer dimensions, typographie, padding, ombres ni comportement.
- Centralisation des deux teintes dans `--em-color-background-send` et `--em-color-background-send-hover`.
- Les boutons de notification MJ, qui ne sont pas des actions d’envoi, sont inchangés.
- Aucun changement du JavaScript, des données, des permissions ni des fonctionnalités.

## 0.2.12 DEV
- Fenêtre popup de réponse aux MP : dimensions initiales 670 × 600 px (redimensionnement manuel conservé).
- Bouton d’envoi dans la popup : min-height 35 px, padding 7 × 14 px, border-radius 7 px, bordure et couleurs de palette inchangées, font-size 13 px et font-weight 100, selon la règle fournie.

## 0.2.11 DEV
- Suppression de `font-weight: 700` sur les boutons `.evil-messenger-pm-send`, conformément à la règle CSS demandée.

## 0.2.10 DEV — Dimensions des boutons d’envoi

- Boutons d’envoi du centre MP : largeur minimale 170 px, hauteur minimale 35 px et police 13 px.
- Conservation du rayon 7 px, bordure et couleurs de palette, padding 7 × 12 px, graisse 700.
- Aucune modification du JS ni des autres styles.

## 0.2.9 DEV — Contacts sans titres de statut

- Suppression des libellés « En ligne » et « Hors ligne » dans la liste des contacts.
- Maintien de la séparation visuelle entre les contacts connectés et déconnectés.
- Nom des contacts en 15 px et informations secondaires en 12 px, conformément aux valeurs souhaitées.
- Aucun changement de logique de messagerie ni de présence.

## 0.2.8 DEV — Scrollbars de la messagerie

- Curseur de défilement gris `#303030` pour les contacts et les historiques de MP (fenêtre principale et popup).
- Priorité CSS sur les thèmes de systèmes, sans effet sur les barres de défilement extérieures au module.
- Couleurs de scrollbar centralisées dans la palette CSS.

## 0.2.7 DEV — Orthographe et séparateurs uniformisés

- Activation explicite de `spellcheck="true"` dans les deux zones de rédaction : centre de messagerie et popup de réponse.
- Bordures des champs et séparateurs structurels unifiés sur `#49494978` via `--em-color-border-input` et `--em-color-border-divider`.
- Aucun changement du JavaScript ni des comportements de messagerie.

## 0.2.6 DEV — Centralisation de la palette CSS

- Toutes les couleurs CSS (y compris dégradés, transparences, bordures, états et ombres) sont définies dans un bloc `:root` unique au début de `styles/private-messages.css`.
- Remplacement des couleurs dispersées par des variables `--em-color-*` explicites.
- Suppression des anciennes déclarations de palette répétées par fenêtre.
- Aucune modification fonctionnelle ni changement intentionnel du rendu.

## 0.2.5 DEV — Contacts allégés

- Suppression des encadrements et du relief des lignes de contact, y compris pour le contact sélectionné.
- Sélection et survol conservés via un fond très discret ; cases, statuts et fonctionnements inchangés.
- Aucune modification des scripts, permissions ou données.

## 0.2.4 DEV — Alignement et relief subtil

- Hauteur identique (66 px) pour le bandeau Contacts et le bandeau de conversation sur écran large (65 px en disposition étroite).
- Ombres douces sur les bulles de messages et les boutons d’envoi, avec effets hover/active discrets.
- Même relief appliqué aux boutons et bulles de la popup et aux boutons de notification MJ.
- Aucun changement de logique JavaScript, de permissions ou de stockage.

## 0.2.3 DEV — Fonds sombres Foundry

- Fonds principaux des trois fenêtres alignés sur #111.
- Surfaces secondaires neutralisées (gris anthracite), sans dominante bleu-noir.
- Contrastes et bordures conservés pour distinguer les conversations et les contrôles.
- Aucun changement fonctionnel.

## 0.2.2 DEV — Simplification visuelle

- Suppression des titres redondants, compteurs de contacts et sous-titres explicatifs dans le tableau de bord.
- Conservation des sections dynamiques En ligne / Hors ligne et de la différenciation visuelle des contacts déconnectés.
- État vide discret et zone de rédaction recentrée sur les actions essentielles.
- Popup et notification MJ épurées, avec la même identité visuelle que la messagerie principale.
- Aucun changement de logique JavaScript, permissions, historique, sockets, stockage ou visuel du bouton d'accès.

## 0.2.1 DEV — Bouton d’accès aux MP

- Remplacement du visuel du bouton par la nouvelle version 2048 × 362 px.
- Mise à jour du ratio CSS sans déformation de l’enveloppe.
- Ajustement de l’alignement vertical du libellé dans le bouton plus fin.
- Aucun changement du fonctionnement de la messagerie.

## 0.2.0 DEV — Interface unifiée

- Nouvelle identité visuelle neutre et élégante pour la messagerie principale, la popup de réponse et la notification MJ.
- Contacts groupés en ligne / hors ligne, mise à jour automatique à la connexion et déconnexion.
- Contacts hors ligne visuellement atténués, historique accessible, envoi désactivé.
- Nom affiché : Evilbram Messenger (ID technique inchangé).

# Changelog

## 0.1.0 — Prototype

- Extraction autonome de la messagerie Evil Toolbox 1.5.0.
- Identifiants, templates, CSS, flags et API dédiés au module evil-messenger.
- Aucun accès ni modification du code ou des flags Evil Toolbox.
