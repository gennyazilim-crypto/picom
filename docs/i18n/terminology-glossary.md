# PICOM terminology glossary — 10 locales

Canonical translation of PICOM's core product nouns. Every namespace file and every
locale catalog (`src/i18n/locales/*/*.json`, `settingsI18n*.ts`, `liveNowCatalog.ts`,
`publisherProgramCatalog.ts`) must reuse these exact terms wherever the concept appears,
so the same idea never reads as two different words in two screens of the same language.

Never translate: `PICOM`, `LiveKit`, `Supabase`, usernames, community/channel names, URLs,
or any user-authored content.

| Concept | en | tr | de | fr | es | it | pt (BR) | nl | pl | ru |
|---|---|---|---|---|---|---|---|---|---|---|
| Community | Community | Topluluk | Community | Communauté | Comunidad | Community | Comunidade | Community | Społeczność | Сообщество |
| Channel | Channel | Kanal | Kanal | Salon | Canal | Canale | Canal | Kanaal | Kanał | Канал |
| Feed | Feed | Feed | Feed | Fil d'actualité | Feed | Feed | Feed | Feed | Kanał aktywności | Лента |
| Direct Message | Direct Message | Direkt Mesaj | Direktnachricht | Message privé | Mensaje directo | Messaggio diretto | Mensagem direta | Direct bericht | Wiadomość bezpośrednia | Личное сообщение |
| Voice Room | Voice Room | Ses Odası | Sprachraum | Salon vocal | Sala de voz | Stanza vocale | Sala de voz | Spraakkamer | Pokój głosowy | Голосовая комната |
| Live | Live | Canlı | Live | Live | En vivo | Live | Ao vivo | Live | Na żywo | Прямой эфир |
| Event | Event | Etkinlik | Event | Événement | Evento | Evento | Evento | Evenement | Wydarzenie | Мероприятие |
| Member | Member | Üye | Mitglied | Membre | Miembro | Membro | Membro | Lid | Członek | Участник |
| Moderator | Moderator | Moderatör | Moderator | Modérateur | Moderador | Moderatore | Moderador | Moderator | Moderator | Модератор |
| Owner | Owner | Sahip | Inhaber | Propriétaire | Propietario | Proprietario | Proprietário | Eigenaar | Właściciel | Владелец |
| Screen Share | Screen Share | Ekran Paylaşımı | Bildschirmfreigabe | Partage d'écran | Compartir pantalla | Condivisione schermo | Compartilhamento de tela | Scherm delen | Udostępnianie ekranu | Демонстрация экрана |
| Mention | Mention | Bahsetme | Erwähnung | Mention | Mención | Menzione | Menção | Vermelding | Wzmianka | Упоминание |
| Reaction | Reaction | Tepki | Reaktion | Réaction | Reacción | Reazione | Reação | Reactie | Reakcja | Реакция |
| Thread | Thread | Konu | Thread | Fil de discussion | Hilo | Thread | Tópico | Thread | Wątek | Тема |
| Waitlist | Waitlist | Bekleme listesi | Warteliste | Liste d'attente | Lista de espera | Lista d'attesa | Lista de espera | Wachtlijst | Lista oczekujących | Список ожидания |
| Creator Studio | Creator Studio | Creator Studio | Creator Studio | Creator Studio | Creator Studio | Creator Studio | Creator Studio | Creator Studio | Creator Studio | Creator Studio |
| Trust & Safety | Trust & Safety | Güven ve Güvenlik | Vertrauen und Sicherheit | Confiance et sécurité | Confianza y seguridad | Fiducia e sicurezza | Confiança e segurança | Vertrouwen en veiligheid | Zaufanie i bezpieczeństwo | Доверие и безопасность |

Notes:
- "Creator"/"Publisher" (account/badge types) stay in English across all locales, matching
  existing `liveNowCatalog.ts` precedent (`live.now.badge.creator`/`live.now.badge.publisher`
  are untranslated in every locale already authored) — treat as a product-tier proper noun.
- "Community" is deliberately left untranslated in de/it/nl/pl (matches how "Community" is
  commonly used as a loanword in tech products in these markets); tr/fr/es/pt/ru use the
  native equivalent since "Topluluk"/"Communauté"/"Comunidad"/"Comunidade"/"Сообщество" are
  the natural, expected terms in those markets' social-product conventions.
