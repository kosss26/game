# Comfortable story reading

The messenger keeps a quiet background with higher-contrast incoming messages,
softer outgoing violet and 1.55 line spacing. ReadingControls in the chat and
profile select 16/18/20 px message text and reduced motion. Preferences are local,
shared across routes, and restored on launch. OS reduced-motion is respected.
Speed and timer settings remain independent. Choice panels have bounded height
and scrolling; action labels and spoken replies are distinguished without caps.

Native dialog sheets provide focus containment, Escape/backdrop dismissal,
background scroll locking and focus restoration. The same behavior is used for
clues and reading settings. Photo viewer is another native dialog with a close
button clear of Telegram's content safe area; captions stay readable and images
are opened only when requested. Failed media retains descriptions.

The first release added six main-character portraits. Full cast and photo-message
coverage is now described in [all-story-visuals.md](all-story-visuals.md). Authors can provide a Character.avatar asset;
existing content and snapshots need no migration. Eight optimized WebP assets
(six 256px portraits and two 600x800 story photos) are served locally.

Photo syntax accepts `[фото /story-media/evidence.webp] Description`. Explicit
sources are limited to local story-media paths. The original exact photo
captions for the zucchini (04:44) and mansion (Northern Lights) resolve to authored
illustrations without editing story text or snapshot versions. Other captions
remain text descriptions: they are not replaced with generic invented evidence.
The generated originals remain outside the repository. More illustrations can
be added with the same format after editorial review of each clue.

Chapter results emphasize the recap and next chapter. Clues, ending collection
and choice statistics are expandable. The final chapter has a primary action
back to the catalog. Invitations use the common native-card/fallback flow.
Voice messages without audio explicitly show a transcription label.

Validation: production build, type checking, Jest suite, local browser checks
of play, reading preferences, photo modal and narrow layouts. Browser checks
use guest sessions in the local JSON database and never message real users.
No story branches, purchases, published snapshots or progress schema change.
Deployment: hostkey.sh update; no bot setup or Cloudflare change required.
