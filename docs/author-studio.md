# Author studio

The author workspace uses its own scoped stylesheet and follows Polnoch's dark
palette and Lora headings. Reader routes, bot configuration and existing
production data do not change. There are no schema migrations or new environment
variables for this release.

## Workflow

- Desktop sidebar and mobile navigation expose overview, stories, players and
  analytics. The existing admin authorization checks remain in place.
- Overview shows actual story/chapter counts, recently updated stories and the
  next draft. Summaries request chapter identifiers and statuses, not scripts.
- The story catalog has illustrated cards, search, publication filters and sort.
- Story editing provides normal fields for genre, age label and cover copy.
  Additional JSON remains available and retains characters, endings and other
  metadata when normal fields are changed. Errors are shown inline.
- Chapter editor tabs preserve visited panel state. A dirty indicator and shared
  leave warning protect unsaved work. Supported Telegram clients also receive
  closing-confirmation requests while an editor is dirty. This is a warning,
  not a durable local draft: save before closing or reloading.
- The script editor supports Ctrl/Cmd+S, inline parse errors, jumping to a source
  line, statistics and a collapsible syntax reference. Save and publish are
  separate actions. Publication is disabled while script/settings edits are
  unsaved; the test player uses the saved draft.
- Chapter settings show UTC explicitly and submit an explicit UTC timestamp.
- Destructive controls are collapsed, labelled and keep their confirmations.
- Player access controls and analytics keep the existing behavior and backend;
  their presentation follows the workspace palette. Analytics shows actual Stars
  totals without an assumed dollar conversion.

## Validation

Unit checks cover authorization of catalog summaries, correct chapter counts,
next-draft selection and surfaced database failures. Full suite: 125 tests.
Type checking and production build pass.

Browser workflow uses local fixtures only: create story, edit normal fields while
retaining custom metadata, create chapter, jump to an error line, switch tabs
without losing text, dismiss navigation, save with keyboard shortcut, start/exit
preview, preserve settings between tabs and publish the saved chapter. It checks
UTC timestamps from a Europe/Moscow browser context and stored source/metadata.

Responsive checks cover 320/390/768/1440 px and the protected studio login.
Native Telegram keyboard/close behavior still needs a device check after deploy.
No production stories were modified by the browser tests.

## Deployment

The changes are on `deploy/hostkey-nginx`. The existing scoped update command
backs up the database and rebuilds only the Polnoch Compose project:

```sh
nohup bash /opt/polnoch-stories/deploy/hostkey.sh update > /var/lib/polnoch-stories/studio-update.log 2>&1 < /dev/null &
tail -n 40 /var/lib/polnoch-stories/studio-update.log
```

Open Profile → Studio after update. No bot setup or Cloudflare change is needed.
