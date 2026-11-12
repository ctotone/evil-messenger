/*
 * Evilbram Messenger — Messages privés
 * Foundry VTT v14
 *
 * Messagerie privée entre utilisateurs basée sur les ChatMessage whisper natifs.
 * Historique indépendant de celui d’Evil Toolbox.
 */

const EVIL_MESSENGER_PM_MODULE_ID = "evil-messenger";
const EVIL_MESSENGER_PM_FLAG_KEY = "privateMessage";
const EVIL_MESSENGER_PM_READ_FLAG_KEY = "readThrough";
const EVIL_MESSENGER_PM_SOCKET = `module.${EVIL_MESSENGER_PM_MODULE_ID}`;
const EVIL_MESSENGER_PM_TYPING_THROTTLE_MS = 1500;
const EVIL_MESSENGER_PM_TYPING_IDLE_MS = 3000;
const EVIL_MESSENGER_PM_TYPING_EXPIRY_MS = 5000;


// Repli anglais garanti lorsque Foundry utilise une langue non traduite par le module
// ou lorsqu'une clé de localisation manque. Valeurs synchronisées avec lang/en.json.
const EVIL_MESSENGER_PM_EN_FALLBACK = {
  "Window.Dashboard": "Private Messages",
  "Window.Reply": "Private Message",
  "Window.Notification": "New Private Message",
  "Dashboard.Contacts": "Contacts",
  "Dashboard.ContactsOnline": "Online contacts",
  "Dashboard.ContactsOffline": "Offline contacts",
  "Dashboard.IncludeRecipient": "Include in next message",
  "Dashboard.IncludeRecipientAria": "Include {name} in the message",
  "Dashboard.OpenConversation": "Open conversation with {name}",
  "Dashboard.OfflineRecipient": "Recipient unavailable (offline)",
  "Dashboard.OfflineRecipientAria": "{name} is offline",
  "Dashboard.OfflineConversation": "View conversation with {name} (offline)",
  "Dashboard.NoOtherUsers": "No other users available.",
  "Dashboard.NoMessages": "No messages yet.",
  "Dashboard.SelectContact": "Select a contact to view the conversation.",
  "Dashboard.PermissionWarning": "You do not have permission in Foundry to send private messages in this world.",
  "Dashboard.DraftPlaceholder": "Write a private message…",
  "Dashboard.SendClassic": "Standard Send",
  "Dashboard.SendPopup": "Popup Send",
  "Reply.DraftPlaceholder": "Write a reply…",
  "Reply.Send": "Send Reply",
  "Notification.MessageReceived": "Sent you a private message.",
  "Notification.Ignore": "Dismiss",
  "Notification.ViewMessage": "View Message",
  "Chat.Reply": "Reply",
  "Read.Seen": "Seen",
  "Typing.Writing": "{name} is typing…",
  "User.Contact": "Contact",
  "User.GM": "GM",
  "User.Player": "Player",
  "Error.RollMissingFormula": "Enter a dice formula after /r or /roll.",
  "Error.RollInvalidFormula": "Invalid dice formula: {formula}",
  "Error.RecipientNotFound": "Recipient not found.",
  "Error.PermissionDenied": "You do not have permission to send private messages in this world.",
  "Error.EnterMessage": "Write a message before sending.",
  "Error.NoOnlineRecipient": "Select at least one online recipient.",
  "Info.MessagesSentOne": "Private message sent to {count} recipient.",
  "Info.MessagesSentMany": "Private messages sent to {count} recipients.",
  "Error.SendFailed": "Could not send the private message.",
  "Error.EnterReply": "Write a reply before sending.",
  "Info.ReplySent": "Private message sent.",
  "Error.ReplyFailed": "Could not send the reply."
};
const EVIL_MESSENGER_PM_SUPPORTED_LOCALES = new Set(["de", "en", "es", "fr", "it", "pt-BR"]);
function emLocale() {
  const code = String(game?.i18n?.lang || "en").replaceAll("_", "-");
  return EVIL_MESSENGER_PM_SUPPORTED_LOCALES.has(code) ? code : "en";
}
function emT(key, data = {}) {
  const fullKey = `EVILMESSENGER.${key}`;
  const local = emLocale() === "en" && game?.i18n?.lang !== "en"
    ? null
    : game?.i18n?.localize?.(fullKey);
  let output = local && local !== fullKey ? local : (EVIL_MESSENGER_PM_EN_FALLBACK[key] ?? fullKey);
  for (const [name, value] of Object.entries(data ?? {})) {
    output = output.replaceAll(`{${name}}`, String(value ?? ""));
  }
  return output;
}
// Chaque template utilise la même fonction, pour garantir le même repli qu'en JS.
Hooks.once("init", () => {
  Handlebars.registerHelper("evilMessengerT", (key, options) => emT(key, options?.hash));
});

let evilMessengerPmDashboardApp = null;
let evilMessengerPmReplyApp = null;
let evilMessengerPmReplyBackdrop = null;
let evilMessengerPmNotificationApp = null;
const evilMessengerPmUnreadByUser = new Map();
const evilMessengerPmTypingByPeer = new Map();
const evilMessengerPmLocalTypingSources = new Map();
const evilMessengerPmLastTypingPulse = new Map();
let evilMessengerPmReadWriteQueue = Promise.resolve();

function escapeHtmlPm(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textToChatHtml(value) {
  return `<div class="evil-messenger-pm-message-text">${escapeHtmlPm(value).replace(/\r?\n/g, "<br>")}</div>`;
}

function parsePmRollCommand(value) {
  const clean = String(value ?? "").trim();
  const match = clean.match(/^\/(?:r|roll)\s+([\s\S]+)$/i);
  if (!match) return null;

  const body = String(match[1] ?? "").trim();
  const hashIndex = body.indexOf("#");
  const formula = (hashIndex >= 0 ? body.slice(0, hashIndex) : body).trim();
  const flavor = (hashIndex >= 0 ? body.slice(hashIndex + 1) : "").trim();

  if (!formula) throw new Error(emT("Error.RollMissingFormula"));

  const RollClass = foundry?.dice?.Roll;
  if (!RollClass?.validate?.(formula)) {
    throw new Error(emT("Error.RollInvalidFormula", { formula }));
  }

  return { formula, flavor };
}

async function createPmChatMessage({ userId, speaker, whisper, text, flagData }) {
  const cleanText = String(text ?? "").trim();
  if (!cleanText) return null;

  const flags = {
    [EVIL_MESSENGER_PM_MODULE_ID]: {
      [EVIL_MESSENGER_PM_FLAG_KEY]: flagData
    }
  };

  const rollCommand = parsePmRollCommand(cleanText);
  if (!rollCommand) {
    return ChatMessage.create({
      user: userId,
      speaker,
      content: textToChatHtml(cleanText),
      whisper,
      flags
    });
  }

  const roll = new foundry.dice.Roll(rollCommand.formula);
  await roll.evaluate();

  const prepared = await roll.toMessage(
    {
      user: userId,
      speaker,
      flavor: rollCommand.flavor || undefined,
      flags
    },
    { create: false }
  );

  prepared.user = userId;
  prepared.speaker = speaker;
  prepared.whisper = [...whisper];
  prepared.blind = false;
  prepared.flags = flags;

  return ChatMessage.create(prepared);
}

function scrollPmHistoryToBottom(container) {
  if (!container) return;

  const scroll = () => {
    container.scrollTop = container.scrollHeight;
  };

  scroll();
  requestAnimationFrame(() => {
    scroll();
    requestAnimationFrame(scroll);
  });
  setTimeout(scroll, 100);
}

async function renderPmHistoryContent(message) {
  if (!message?.isRoll || !Array.isArray(message.rolls) || !message.rolls.length) {
    return message?.content ?? "";
  }

  const rendered = [];
  for (const roll of message.rolls) {
    rendered.push(await roll.render({
      flavor: message.flavor || undefined,
      isPrivate: false
    }));
  }
  return rendered.join("");
}

function getPmFlag(message) {
  return message?.getFlag?.(EVIL_MESSENGER_PM_MODULE_ID, EVIL_MESSENGER_PM_FLAG_KEY) ?? null;
}

/** Lit uniquement les messages marqués Evil Messenger. */
function getPmParticipants(message) {
  const flag = getPmFlag(message);
  if (!flag?.senderUserId || !flag?.recipientUserId) return null;
  return {
    senderUserId: flag.senderUserId,
    recipientUserId: flag.recipientUserId,
    flag
  };
}

function buildPmFlagData({ senderUserId, recipientUserId, popup = false, inReplyTo = null }) {
  const sender = game.users.get(senderUserId);
  const recipient = game.users.get(recipientUserId);

  let direction = "user-to-user";

  if (sender?.isGM && recipient && !recipient.isGM) {
    direction = "gm-to-player";
  } else if (sender && !sender.isGM && recipient?.isGM) {
    direction = "player-to-gm";
  } else if (sender && !sender.isGM && recipient && !recipient.isGM) {
    direction = "player-to-player";
  }

  return {
    version: 2,
    direction,
    senderUserId,
    recipientUserId,
    popup: popup === true,
    inReplyTo
  };
}

function getAvailableContacts() {
  return game.users
    .filter(user => user.id !== game.user.id)
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      if (a.isGM !== b.isGM) return a.isGM ? -1 : 1;
      const aName = a.character?.name || a.name;
      const bName = b.character?.name || b.name;
      return String(aName).localeCompare(String(bName), emLocale(), { sensitivity: "base" });
    });
}

// Icône commune aux comptes MJ dans les listes et en-têtes de conversation.
// Pour les joueurs, portrait de fiche (Actor.img), jamais texture de token.
const EVIL_MESSENGER_GM_AVATAR = "modules/evil-messenger/assets/gm-avatar.webp";

function getUserPortrait(user) {
  if (user.isGM === true) return EVIL_MESSENGER_GM_AVATAR;

  const portrait = user.character?.img;
  return (typeof portrait === "string" && portrait.trim())
    ? portrait
    : (user.avatar || "icons/svg/mystery-man.svg");
}

function getUserDisplay(user) {
  return {
    id: user.id,
    userName: user.name,
    characterName: user.character?.name ?? "",
    label: user.character?.name || user.name,
    roleLabel: user.isGM ? emT("User.GM") : emT("User.Player"),
    isGM: user.isGM === true,
    active: user.active === true,
    img: getUserPortrait(user)
  };
}

function getConversationMessages(peerUserId, currentUserId = game.user.id) {
  return game.messages.contents
    .filter(message => {
      const participants = getPmParticipants(message);
      if (!participants) return false;

      const { senderUserId, recipientUserId } = participants;
      return (
        (senderUserId === currentUserId && recipientUserId === peerUserId) ||
        (senderUserId === peerUserId && recipientUserId === currentUserId)
      );
    })
    .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
}

function formatMessageTime(timestamp) {
  if (!timestamp) return "";
  try {
    return new Intl.DateTimeFormat(emLocale(), {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}

/* Les accusés de lecture sont stockés sur le User du lecteur (pas sur le ChatMessage).
 * Un enregistrement par interlocuteur pointe vers le dernier MP reçu effectivement affiché.
 * Cela ne modifie ni les messages existants ni leurs permissions Foundry. */
function getPmReadThrough(user, peerId) {
  const allReceipts = user?.getFlag?.(EVIL_MESSENGER_PM_MODULE_ID, EVIL_MESSENGER_PM_READ_FLAG_KEY);
  const receipt = allReceipts?.[peerId];
  return receipt && typeof receipt.messageId === "string" ? receipt : null;
}

function getPmOutgoingMessages(peerId, senderId) {
  return getConversationMessages(peerId, senderId).filter(message => {
    const participants = getPmParticipants(message);
    return participants?.senderUserId === senderId && participants.recipientUserId === peerId;
  });
}

function getPmReadMessageIds(peerId) {
  const peer = game.users.get(peerId);
  const receipt = getPmReadThrough(peer, game.user.id);
  const ids = new Set();
  if (!receipt) return ids;

  const sent = getPmOutgoingMessages(peerId, game.user.id);
  const readIndex = sent.findIndex(item => item.id === receipt.messageId);
  for (const [index, message] of sent.entries()) {
    if (readIndex >= 0 ? index <= readIndex :
      (typeof receipt.timestamp === "number" &&
       typeof message.timestamp === "number" && message.timestamp < receipt.timestamp)) {
      ids.add(message.id);
    }
  }
  return ids;
}

function pmMessageIsReadByPeer(message, peerId) {
  return getPmReadMessageIds(peerId).has(message.id);
}

function pmReceiptAlreadyCovers(peerId, receipt, lastMessage) {
  if (!receipt || !lastMessage) return false;
  if (receipt.messageId === lastMessage.id) return true;
  const received = getConversationMessages(peerId).filter(message => {
    const participants = getPmParticipants(message);
    return participants?.senderUserId === peerId && participants.recipientUserId === game.user.id;
  });
  const earlier = received.findIndex(message => message.id === lastMessage.id);
  const later = received.findIndex(message => message.id === receipt.messageId);
  if (earlier >= 0 && later >= 0) return later >= earlier;
  return typeof receipt.timestamp === "number" && receipt.timestamp > (lastMessage.timestamp ?? 0);
}

function markPmConversationRead(peerId) {
  if (!peerId || !game.user || peerId === game.user.id) return Promise.resolve();
  const inbound = getConversationMessages(peerId).filter(message => {
    const participants = getPmParticipants(message);
    return participants?.senderUserId === peerId && participants.recipientUserId === game.user.id;
  });
  const lastMessage = inbound.at(-1);
  if (!lastMessage) return Promise.resolve();
  if (pmReceiptAlreadyCovers(peerId, getPmReadThrough(game.user, peerId), lastMessage)) return Promise.resolve();

  // Une seule écriture de flags User à la fois : ne pas perdre le statut d'un autre contact.
  evilMessengerPmReadWriteQueue = evilMessengerPmReadWriteQueue.catch(() => {}).then(async () => {
    const existing = game.user.getFlag(EVIL_MESSENGER_PM_MODULE_ID, EVIL_MESSENGER_PM_READ_FLAG_KEY) ?? {};
    if (pmReceiptAlreadyCovers(peerId, existing[peerId], lastMessage)) return;
    await game.user.setFlag(EVIL_MESSENGER_PM_MODULE_ID, EVIL_MESSENGER_PM_READ_FLAG_KEY, {
      ...existing,
      [peerId]: { messageId: lastMessage.id, timestamp: lastMessage.timestamp ?? 0 }
    });
  });
  return evilMessengerPmReadWriteQueue.catch(err => {
    console.error("Evil Messenger | Enregistrement de lecture impossible", err);
  });
}

function refreshPmReadIndicators() {
  for (const [app, peerId] of [
    [evilMessengerPmDashboardApp, evilMessengerPmDashboardApp?.selectedThreadUserId],
    [evilMessengerPmReplyApp, evilMessengerPmReplyApp?.peerUserId]
  ]) {
    if (!app?.rendered || !peerId) continue;
    const seenIds = getPmReadMessageIds(peerId);
    for (const node of app.element.querySelectorAll("[data-pm-message-id].outgoing, [data-pm-message-id].from-player")) {
      node.classList.toggle("is-read", seenIds.has(node.dataset.pmMessageId));
    }
  }
}

function sendPmTypingSignal(recipientUserId, active) {
  if (!game.users.get(recipientUserId)?.active || recipientUserId === game.user.id) return;
  // Aucun contenu de message n'est transmis, uniquement une activité éphémère.
  try {
    const result = game.socket.emit(EVIL_MESSENGER_PM_SOCKET, {
      type: "typing",
      senderUserId: game.user.id,
      recipientUserId,
      active
    });
    if (result?.catch) result.catch(err => console.warn("Evil Messenger | Signal de saisie", err));
  } catch (err) {
    console.warn("Evil Messenger | Signal de saisie", err);
  }
}

function getPmLocalTypingTargets() {
  const all = new Set();
  for (const source of evilMessengerPmLocalTypingSources.values()) {
    for (const id of source.recipients) all.add(id);
  }
  return all;
}

function stopPmLocalTyping(sourceName) {
  const previous = getPmLocalTypingTargets();
  const source = evilMessengerPmLocalTypingSources.get(sourceName);
  if (source?.timer) clearTimeout(source.timer);
  evilMessengerPmLocalTypingSources.delete(sourceName);
  const remaining = getPmLocalTypingTargets();
  for (const id of previous) {
    if (remaining.has(id)) continue;
    evilMessengerPmLastTypingPulse.delete(id);
    sendPmTypingSignal(id, false);
  }
}

function updatePmLocalTyping(sourceName, ids) {
  const targets = new Set(ids.filter(id => game.users.get(id)?.active && id !== game.user.id));
  if (!targets.size) {
    stopPmLocalTyping(sourceName);
    return;
  }
  const previous = getPmLocalTypingTargets();
  stopPmLocalTypingTimerOnly(sourceName);
  const timer = setTimeout(() => stopPmLocalTyping(sourceName), EVIL_MESSENGER_PM_TYPING_IDLE_MS);
  evilMessengerPmLocalTypingSources.set(sourceName, { recipients: targets, timer });
  const now = Date.now();
  const current = getPmLocalTypingTargets();
  for (const id of previous) {
    if (!current.has(id)) {
      evilMessengerPmLastTypingPulse.delete(id);
      sendPmTypingSignal(id, false);
    }
  }
  for (const id of current) {
    if (!previous.has(id) || now - (evilMessengerPmLastTypingPulse.get(id) ?? 0) >= EVIL_MESSENGER_PM_TYPING_THROTTLE_MS) {
      sendPmTypingSignal(id, true);
      evilMessengerPmLastTypingPulse.set(id, now);
    }
  }
}

function stopPmLocalTypingTimerOnly(sourceName) {
  const source = evilMessengerPmLocalTypingSources.get(sourceName);
  if (source?.timer) clearTimeout(source.timer);
}

function isPmPeerTyping(peerId) {
  const entry = evilMessengerPmTypingByPeer.get(peerId);
  return !!entry && entry.expiresAt > Date.now();
}

function refreshPmTypingIndicators() {
  for (const [app, peerId] of [
    [evilMessengerPmDashboardApp, evilMessengerPmDashboardApp?.selectedThreadUserId],
    [evilMessengerPmReplyApp, evilMessengerPmReplyApp?.peerUserId]
  ]) {
    if (!app?.rendered) continue;
    const indicator = app.element.querySelector("[data-pm-typing-indicator]");
    if (!indicator) continue;
    const typing = !!peerId && isPmPeerTyping(peerId);
    const justAppeared = typing && indicator.hidden;
    const history = app.element.querySelector(".evil-messenger-pm-history, .evil-messenger-pm-player-history");
    // Ne faire défiler qu'une conversation déjà en bas : ne pas interrompre
    // la lecture d'anciens messages lorsque le contact commence à écrire.
    const nearBottom = history && history.scrollHeight - history.scrollTop - history.clientHeight <= 40;
    indicator.hidden = !typing;
    if (typing) {
      const label = indicator.querySelector("[data-pm-typing-label]");
      if (label) label.textContent = emT("Typing.Writing", { name: game.users.get(peerId)?.character?.name || game.users.get(peerId)?.name || emT("User.Contact") });
      // L'apparition de l'indicateur réduit la hauteur disponible pour
      // l'historique. Réaligner le bas après cette modification de layout.
      if (justAppeared && nearBottom) {
        requestAnimationFrame(() => {
          if (history.isConnected && !indicator.hidden) history.scrollTop = history.scrollHeight;
        });
      }
    }
  }
}

function onPmSocketEvent(payload) {
  if (!payload || payload.type !== "typing" || payload.recipientUserId !== game.user.id) return;
  const peerId = payload.senderUserId;
  if (!peerId || peerId === game.user.id || !game.users.get(peerId)?.active) return;
  const previous = evilMessengerPmTypingByPeer.get(peerId);
  if (previous?.timer) clearTimeout(previous.timer);
  if (payload.active === true) {
    const timer = setTimeout(() => {
      evilMessengerPmTypingByPeer.delete(peerId);
      refreshPmTypingIndicators();
    }, EVIL_MESSENGER_PM_TYPING_EXPIRY_MS);
    evilMessengerPmTypingByPeer.set(peerId, { expiresAt: Date.now() + EVIL_MESSENGER_PM_TYPING_EXPIRY_MS, timer });
  } else {
    evilMessengerPmTypingByPeer.delete(peerId);
  }
  refreshPmTypingIndicators();
}

function canCurrentUserWhisper() {
  return game.user.isGM || game.user.can("MESSAGE_WHISPER");
}

async function createPrivateMessage({ recipientUserId, text, popup = false, inReplyTo = null }) {
  const recipient = game.users.get(recipientUserId);
  if (!recipient || recipient.id === game.user.id) {
    throw new Error(emT("Error.RecipientNotFound"));
  }

  if (!canCurrentUserWhisper()) {
    throw new Error(emT("Error.PermissionDenied"));
  }

  const cleanText = String(text ?? "").trim();
  if (!cleanText) return null;

  const senderUserId = game.user.id;
  return createPmChatMessage({
    userId: senderUserId,
    speaker: ChatMessage.getSpeaker({ alias: game.user.character?.name || game.user.name }),
    // Les deux participants sont explicitement destinataires du whisper.
    // Ainsi chacun conserve l'accès au message dans le chat et l'historique Evil Messenger.
    whisper: [senderUserId, recipientUserId],
    text: cleanText,
    flagData: buildPmFlagData({
      senderUserId,
      recipientUserId,
      popup,
      inReplyTo
    })
  });
}

async function openPmDashboard({ userId = null, playerUserId = null } = {}) {
  const requestedUserId = userId || playerUserId || null;

  if (evilMessengerPmDashboardApp?.rendered) {
    if (requestedUserId) {
      await evilMessengerPmDashboardApp.selectConversation(requestedUserId);
    } else {
      // Si la fenêtre existe déjà, assurer un destinataire valide pour la
      // conversation affichée lorsqu'on la rouvre via le bouton ou la macro.
      // Ne pas écraser une sélection multiple déjà cochée manuellement.
      const peerId = evilMessengerPmDashboardApp.selectedThreadUserId;
      if (peerId && game.users.get(peerId)?.active && evilMessengerPmDashboardApp.selectedRecipients.size === 0) {
        evilMessengerPmDashboardApp.selectedRecipients.add(peerId);
        if (evilMessengerPmDashboardApp.draft.trim()) {
          updatePmLocalTyping("dashboard", evilMessengerPmDashboardApp.getTypingRecipients());
        }
        await evilMessengerPmDashboardApp.render();
      }
    }
    evilMessengerPmDashboardApp.bringToFront();
    return;
  }

  evilMessengerPmDashboardApp = new EvilMessengerPmDashboardApp({ userId: requestedUserId });
  const app = evilMessengerPmDashboardApp;
  app.addEventListener("close", () => {
    stopPmLocalTyping("dashboard");
    if (evilMessengerPmDashboardApp === app) evilMessengerPmDashboardApp = null;
  });
  await app.render({ force: true });
}

class EvilMessengerPmDashboardApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  constructor({ userId = null } = {}) {
    super({ window: { title: emT("Window.Dashboard") } });
    const contacts = getAvailableContacts();
    const firstActive = contacts.find(user => user.active) ?? contacts[0] ?? null;
    this.selectedThreadUserId = userId || firstActive?.id || null;
    this.selectedRecipients = new Set(
      this.selectedThreadUserId && game.users.get(this.selectedThreadUserId)?.active
        ? [this.selectedThreadUserId]
        : []
    );
    this.draft = "";
  }

  getTypingRecipients() {
    return [...this.selectedRecipients].filter(id => game.users.get(id)?.active);
  }

  static DEFAULT_OPTIONS = {
    id: "evil-messenger-pm-dashboard",
    classes: ["evil-messenger", "evil-messenger-pm-dashboard"],
    position: {
      width: 860,
      height: 640
    },
    window: {
      title: "Private Messages",
      icon: "fa-solid fa-envelope",
      resizable: true
    },
    actions: {
      selectConversation: this.#onSelectConversation,
      sendClassic: this.#onSendClassic,
      sendPopup: this.#onSendPopup
    }
  };

  static PARTS = {
    content: {
      template: "modules/evil-messenger/templates/private-messages.hbs"
    }
  };

  selectConversation(userId) {
    const user = game.users.get(userId);
    if (!user || user.id === game.user.id) return Promise.resolve();

    this.selectedThreadUserId = user.id;
    // Changer de conversation sélectionne ce seul destinataire.
    // Pour un envoi à plusieurs utilisateurs, les cases restent cochables manuellement.
    this.selectedRecipients = new Set(user.active ? [user.id] : []);
    evilMessengerPmUnreadByUser.delete(user.id);

    // Ne pas laisser un signal « écrit… » actif chez les destinataires précédents.
    if (this.draft.trim()) updatePmLocalTyping("dashboard", this.getTypingRecipients());
    else stopPmLocalTyping("dashboard");

    return this.render().catch(err => console.error("Evil Messenger | Conversation", err));
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const users = getAvailableContacts();

    const contacts = users.map(user => {
      const display = getUserDisplay(user);
      return {
        ...display,
        selectedThread: user.id === this.selectedThreadUserId,
        checked: this.selectedRecipients.has(user.id),
        unread: evilMessengerPmUnreadByUser.get(user.id) ?? 0
      };
    });

    const selectedUser = game.users.get(this.selectedThreadUserId);
    const seenIds = selectedUser ? getPmReadMessageIds(selectedUser.id) : new Set();
    const history = selectedUser
      ? await Promise.all(getConversationMessages(selectedUser.id).map(async message => {
          const participants = getPmParticipants(message);
          const outgoing = participants?.senderUserId === game.user.id;
          return {
            id: message.id,
            outgoing,
            incoming: !outgoing,
            content: await renderPmHistoryContent(message),
            time: formatMessageTime(message.timestamp),
            seen: outgoing && seenIds.has(message.id)
          };
        }))
      : [];

    return {
      ...context,
      contacts,
      onlineContacts: contacts.filter(contact => contact.active),
      offlineContacts: contacts.filter(contact => !contact.active),
      hasContacts: contacts.length > 0,
      selectedUser: selectedUser ? getUserDisplay(selectedUser) : null,
      history,
      hasHistory: history.length > 0,
      draft: this.draft,
      canWhisper: canCurrentUserWhisper()
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    for (const checkbox of this.element.querySelectorAll("[data-pm-recipient]")) {
      checkbox.addEventListener("change", event => {
        const id = event.currentTarget.dataset.pmRecipient;
        if (!id) return;
        if (event.currentTarget.checked) this.selectedRecipients.add(id);
        else this.selectedRecipients.delete(id);
        if (this.draft.trim()) updatePmLocalTyping("dashboard", this.getTypingRecipients());
        else stopPmLocalTyping("dashboard");
      });
    }

    const textarea = this.element.querySelector("[data-pm-draft]");
    textarea?.addEventListener("input", event => {
      this.draft = event.currentTarget.value;
      if (this.draft.trim()) updatePmLocalTyping("dashboard", this.getTypingRecipients());
      else stopPmLocalTyping("dashboard");
    });

    const history = this.element.querySelector(".evil-messenger-pm-history");
    scrollPmHistoryToBottom(history);
    refreshPmTypingIndicators();
    // Appeler seulement après affichage effectif de la conversation.
    void markPmConversationRead(this.selectedThreadUserId);
  }

  static async #onSelectConversation(event, target) {
    const userId = target.dataset.userId;
    if (userId) await this.selectConversation(userId);
  }

  async #sendMessage({ popup }) {
    const text = String(this.draft ?? "").trim();
    if (!text) {
      ui.notifications.warn(emT("Error.EnterMessage"));
      return;
    }

    if (!canCurrentUserWhisper()) {
      ui.notifications.warn(emT("Error.PermissionDenied"));
      return;
    }

    const recipientIds = [...this.selectedRecipients]
      .filter(id => {
        const user = game.users.get(id);
        return user?.active && user.id !== game.user.id;
      });

    if (!recipientIds.length) {
      ui.notifications.warn(emT("Error.NoOnlineRecipient"));
      return;
    }

    try {
      stopPmLocalTyping("dashboard");
      for (const recipientUserId of recipientIds) {
        await createPrivateMessage({ recipientUserId, text, popup });
      }

      const count = recipientIds.length;
      ui.notifications.info(emT(count === 1 ? "Info.MessagesSentOne" : "Info.MessagesSentMany", { count }));
      this.draft = "";
      await this.render();
    } catch (err) {
      console.error("Evil Messenger | Messages privés | Envoi impossible", err);
      ui.notifications.error(err?.message ?? emT("Error.SendFailed"));
    }
  }

  static async #onSendClassic() {
    await this.#sendMessage({ popup: false });
  }

  static async #onSendPopup() {
    await this.#sendMessage({ popup: true });
  }
}

function removePmReplyBackdrop() {
  evilMessengerPmReplyBackdrop?.remove();
  evilMessengerPmReplyBackdrop = null;
}

function ensurePmReplyBackdrop(app) {
  removePmReplyBackdrop();
  const backdrop = document.createElement("div");
  backdrop.className = "evil-messenger-pm-backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  document.body.append(backdrop);

  const zIndex = Number.parseInt(window.getComputedStyle(app.element).zIndex, 10);
  if (Number.isFinite(zIndex)) backdrop.style.zIndex = String(Math.max(0, zIndex - 1));
  evilMessengerPmReplyBackdrop = backdrop;
}

async function openPmReplyPopup(message) {
  const participants = getPmParticipants(message);
  if (!participants || participants.recipientUserId !== game.user.id) return;

  const peerUserId = participants.senderUserId;
  if (!peerUserId || peerUserId === game.user.id) return;

  if (evilMessengerPmReplyApp?.rendered) await evilMessengerPmReplyApp.close();

  // Une conversation affichée dans la popup est également consultée.
  evilMessengerPmUnreadByUser.delete(peerUserId);
  const dashboardElement = evilMessengerPmDashboardApp?.rendered ? evilMessengerPmDashboardApp.element : null;
  const contactButton = [...(dashboardElement?.querySelectorAll('[data-action="selectConversation"]') ?? [])]
    .find(button => button.dataset.userId === peerUserId);
  contactButton?.querySelector(".evil-messenger-pm-unread")?.remove();

  evilMessengerPmReplyApp = new EvilMessengerPmReplyApp(message, peerUserId);
  const app = evilMessengerPmReplyApp;
  app.addEventListener("close", () => {
    removePmReplyBackdrop();
    stopPmLocalTyping("reply");
    if (evilMessengerPmReplyApp === app) evilMessengerPmReplyApp = null;
  });
  await app.render({ force: true });
}

class EvilMessengerPmReplyApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  constructor(message, peerUserId) {
    super({ window: { title: emT("Window.Reply") } });
    this.message = message;
    this.peerUserId = peerUserId;
    this.reply = "";
  }

  static DEFAULT_OPTIONS = {
    id: "evil-messenger-pm-reply",
    classes: ["evil-messenger", "evil-messenger-pm-reply"],
    position: {
      width: 670,
      height: 600
    },
    window: {
      title: "Private Message",
      icon: "fa-solid fa-envelope",
      resizable: true
    },
    actions: {
      sendReply: this.#onSendReply
    }
  };

  static PARTS = {
    content: {
      template: "modules/evil-messenger/templates/private-message-reply.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const peer = game.users.get(this.peerUserId);
    const seenIds = peer ? getPmReadMessageIds(peer.id) : new Set();
    const history = peer
      ? await Promise.all(getConversationMessages(peer.id).map(async message => {
          const participants = getPmParticipants(message);
          const fromMe = participants?.senderUserId === game.user.id;
          return {
            id: message.id,
            fromMe,
            fromPeer: !fromMe,
            content: await renderPmHistoryContent(message),
            time: formatMessageTime(message.timestamp),
            seen: fromMe && seenIds.has(message.id)
          };
        }))
      : [];

    return {
      ...context,
      peer: peer ? getUserDisplay(peer) : null,
      history,
      hasHistory: history.length > 0,
      reply: this.reply
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    ensurePmReplyBackdrop(this);
    this.bringToFront();

    const textarea = this.element.querySelector("[data-pm-reply-draft]");
    textarea?.addEventListener("input", event => {
      this.reply = event.currentTarget.value;
      if (this.reply.trim()) updatePmLocalTyping("reply", [this.peerUserId]);
      else stopPmLocalTyping("reply");
    });
    textarea?.focus();

    const history = this.element.querySelector(".evil-messenger-pm-player-history");
    scrollPmHistoryToBottom(history);
    refreshPmTypingIndicators();
    void markPmConversationRead(this.peerUserId);
  }

  static async #onSendReply() {
    const text = String(this.reply ?? "").trim();
    if (!text) {
      ui.notifications.warn(emT("Error.EnterReply"));
      return;
    }

    try {
      stopPmLocalTyping("reply");
      const created = await createPrivateMessage({
        recipientUserId: this.peerUserId,
        text,
        popup: false,
        inReplyTo: this.message?.id ?? null
      });
      if (!created) return;
      ui.notifications.info(emT("Info.ReplySent"));
      await this.close();
    } catch (err) {
      console.error("Evil Messenger | Messages privés | Réponse impossible", err);
      ui.notifications.error(err?.message ?? emT("Error.ReplyFailed"));
    }
  }
}

async function showGmIncomingNotification(message) {
  if (!game.user.isGM) return;

  const participants = getPmParticipants(message);
  if (!participants || participants.recipientUserId !== game.user.id) return;

  const sender = game.users.get(participants.senderUserId);
  if (!sender) return;

  if (evilMessengerPmNotificationApp?.rendered) await evilMessengerPmNotificationApp.close();

  const senderDisplay = getUserDisplay(sender);

  evilMessengerPmNotificationApp = new EvilMessengerPmNotificationApp({
    senderUserId: sender.id,
    senderLabel: senderDisplay.label,
    senderImg: senderDisplay.img
  });

  const app = evilMessengerPmNotificationApp;
  app.addEventListener("close", () => {
    if (evilMessengerPmNotificationApp === app) evilMessengerPmNotificationApp = null;
  });
  await app.render({ force: true });
}

class EvilMessengerPmNotificationApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  constructor({ senderUserId, senderLabel, senderImg }) {
    super({ window: { title: emT("Window.Notification") } });
    this.senderUserId = senderUserId;
    this.senderLabel = senderLabel;
    this.senderImg = senderImg;
  }

  static DEFAULT_OPTIONS = {
    id: "evil-messenger-pm-notification",
    classes: ["evil-messenger", "evil-messenger-pm-notification"],
    position: {
      width: 330,
      height: "auto"
    },
    window: {
      title: "New Private Message",
      icon: "fa-solid fa-envelope"
    },
    actions: {
      closeNotification: this.#onCloseNotification,
      openDashboard: this.#onOpenDashboard
    }
  };

  static PARTS = {
    content: {
      template: "modules/evil-messenger/templates/private-message-notification.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      senderLabel: this.senderLabel,
      senderImg: this.senderImg
    };
  }

  static async #onCloseNotification() {
    await this.close();
  }

  static async #onOpenDashboard() {
    const userId = this.senderUserId;
    await this.close();
    await openPmDashboard({ userId });
  }
}

function addReplyButtonToChatMessage(message, html) {
  const participants = getPmParticipants(message);
  if (!participants || participants.recipientUserId !== game.user.id) return;

  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!(root instanceof HTMLElement)) return;
  if (root.querySelector(".evil-messenger-pm-chat-reply")) return;

  const target = root.querySelector(".message-content") ?? root;
  const actions = document.createElement("div");
  actions.className = "evil-messenger-pm-chat-actions";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "evil-messenger-pm-chat-reply";
  button.innerHTML = `<i class="fa-solid fa-reply"></i> ${escapeHtmlPm(emT("Chat.Reply"))}`;
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    openPmReplyPopup(message);
  });

  actions.append(button);
  target.append(actions);
}

async function handleCreatedPmMessage(message) {
  const participants = getPmParticipants(message);
  if (!participants || participants.recipientUserId !== game.user.id || !message.visible) return;

  const peerUserId = participants.senderUserId;
  const flag = participants.flag;

  const dashboardOpen = evilMessengerPmDashboardApp?.rendered === true;
  const viewingDashboard = dashboardOpen && evilMessengerPmDashboardApp.selectedThreadUserId === peerUserId;
  const viewingPopup = evilMessengerPmReplyApp?.rendered === true && evilMessengerPmReplyApp.peerUserId === peerUserId;

  if (!viewingDashboard && !viewingPopup) {
    evilMessengerPmUnreadByUser.set(
      peerUserId,
      (evilMessengerPmUnreadByUser.get(peerUserId) ?? 0) + 1
    );
  } else {
    evilMessengerPmUnreadByUser.delete(peerUserId);
  }

  if (dashboardOpen) await evilMessengerPmDashboardApp.render();

  if (flag?.popup === true) {
    await openPmReplyPopup(message);
    return;
  }

  // Une popup déjà ouverte sur ce contact affiche aussi les nouveaux MP classiques.
  if (viewingPopup && evilMessengerPmReplyApp?.rendered) await evilMessengerPmReplyApp.render();

  // Une notification seule n'est jamais considérée comme une lecture.
  if (game.user.isGM && !dashboardOpen && !viewingPopup) {
    await showGmIncomingNotification(message);
  }
}

function injectPrivateMessagesActorButton(application, element) {
  const ActorDirectory = foundry?.applications?.sidebar?.tabs?.ActorDirectory;
  if (!ActorDirectory || !(application instanceof ActorDirectory)) return;
  if (!(element instanceof HTMLElement)) return;
  if (element.querySelector(".evil-messenger-pm-directory-launcher")) return;

  const list = element.querySelector(".directory-list");
  const container = list?.parentElement ?? element.querySelector(".directory") ?? element;

  const launcher = document.createElement("div");
  launcher.className = "evil-messenger-pm-directory-launcher";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "evil-messenger-pm-directory-button";
  button.title = emT("Window.Dashboard");
  button.setAttribute("aria-label", emT("Window.Dashboard"));
  button.innerHTML = `<span class="evil-messenger-pm-directory-button-label">${escapeHtmlPm(emT("Window.Dashboard"))}</span>`;
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    openPmDashboard();
  });

  launcher.append(button);

  if (list && list.parentElement === container) container.insertBefore(launcher, list);
  else container.prepend(launcher);
}

// Synchronise automatiquement l'ordre et le statut des contacts lorsqu'un
// participant rejoint ou quitte la session (hook officiel Foundry v14).
Hooks.on("userConnected", () => {
  for (const [id, entry] of evilMessengerPmTypingByPeer) {
    if (game.users.get(id)?.active) continue;
    clearTimeout(entry.timer);
    evilMessengerPmTypingByPeer.delete(id);
  }
  refreshPmTypingIndicators();
  if (!evilMessengerPmDashboardApp?.rendered) return;
  // Écarter les sélections de destinataires qui viennent de se déconnecter.
  for (const id of evilMessengerPmDashboardApp.selectedRecipients) {
    if (!game.users.get(id)?.active) evilMessengerPmDashboardApp.selectedRecipients.delete(id);
  }
  if (evilMessengerPmDashboardApp.draft.trim()) {
    updatePmLocalTyping("dashboard", evilMessengerPmDashboardApp.getTypingRecipients());
  }
  evilMessengerPmDashboardApp.render().catch(err => {
    console.error("Evil Messenger | Actualisation des contacts impossible", err);
  });
});

Hooks.on("updateUser", user => {
  // Les données de flags peuvent être transmises sous une forme différentielle.
  // La correspondance avec l'interlocuteur évite de dépendre de leur représentation.
  if (user?.id !== evilMessengerPmDashboardApp?.selectedThreadUserId &&
      user?.id !== evilMessengerPmReplyApp?.peerUserId) return;
  refreshPmReadIndicators();
});

Hooks.on("renderChatMessageHTML", (message, html) => {
  addReplyButtonToChatMessage(message, html);
});

Hooks.on("createChatMessage", message => {
  handleCreatedPmMessage(message).catch(err => {
    console.error("Evil Messenger | Messages privés | Traitement message impossible", err);
  });
});

Hooks.on("renderApplicationV2", (application, element) => {
  injectPrivateMessagesActorButton(application, element);
});

Hooks.once("ready", () => {
  game.socket.on(EVIL_MESSENGER_PM_SOCKET, onPmSocketEvent);
  game.evilMessenger ??= {};
  game.evilMessenger.privateMessages = {
    open: openPmDashboard
  };
});

Hooks.on("getSceneControlButtons", controls => {
  if (!game.user.isGM) return;
  const tokens = controls.tokens;
  if (!tokens?.tools) return;

  tokens.tools.evilMessengerPrivateMessages = {
    name: "evilMessengerPrivateMessages",
    title: emT("Window.Dashboard"),
    icon: "fa-solid fa-envelope",
    order: Object.keys(tokens.tools).length,
    button: true,
    visible: true,
    onChange: () => openPmDashboard()
  };
});
