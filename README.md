# Torn Targets

A small Angular app that loads target data from a JSON file and displays a sortable list of targets with last action, last attack, and attack actions.

After uploading a YATA target JSON file, you can optionally enter your personal Torn API key to refresh each target's current status and health. The key is sent directly to Torn over HTTPS, kept only in the page while the refresh runs, and cleared when the refresh completes. Requests are made one at a time with a delay to stay within Torn's API rate limit. Never share your API key or enter your Torn password.

Target names link to their Torn profiles. Status, health, and each target's last successful refresh time are shown in the list. Click any sortable column heading to change the sort order; a refresh processes targets in the order currently shown.

Sorting by **Status** puts Okay targets first, followed by hospitalized targets ordered by time remaining (soonest first). When a hospital countdown reaches zero, the target still needs to be refreshed to confirm the current status.

Sorting by **Last Action** parses the displayed elapsed duration into seconds (including compound and abbreviated units such as `1 min 5 secs`) and sorts the displayed values numerically. Recent activity appears first by default.

Use the filter field to narrow visible targets by name, ID, level, or status. Filtering remains available during refresh and only changes the displayed rows; the refresh continues through its original target list in the order captured when it started.

For targets currently in the hospital, the status column shows a live countdown adjusted by one minute to match the countdown shown on the Torn profile. When it reaches zero, refresh the target to confirm their current status before attacking.

Enter your API key and use the **Refresh** link under a target's status to refresh only that target's status and health.

Use the **Dark mode** toggle to switch to a deep navy theme with teal and violet aurora accents. Your preference is saved in this browser.

Use **Download updated JSON** to save the current target list with refreshed status, health, last-action data, and your latest attack timestamps for targets found in Torn's most recent 1,000 attack records. Browser security does not allow the app to overwrite the uploaded file directly, so it downloads a separate numbered JSON copy (for example, `targets-1.json`, then `targets-2.json`). Battle stats are not updated by this refresh.

## Online Access

```bash
https://seguwuk.github.io/torn-targets/
```

## Run locally

```bash
npm install
npm start
```

Then open `http://localhost:4200/`.

## Build

```bash
npm run build
```
