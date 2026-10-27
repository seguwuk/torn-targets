# Torn Targets

A small Angular app that loads target data from a JSON file and displays a sortable list of targets with last action, last attack, and attack actions.

After uploading a YATA target JSON file, you can optionally enter your personal Torn API key to refresh each target's current status and health. The key is sent directly to Torn over HTTPS, kept only in the page while the refresh runs, and cleared when the refresh completes. Requests are made one at a time with a delay to stay within Torn's API rate limit. Never share your API key or enter your Torn password.

Target names link to their Torn profiles. Status, health, and each target's last successful refresh time are shown in the list. Click any sortable column heading to change the sort order; a refresh processes targets in the order currently shown.

For targets currently in the hospital, the status column also shows a live countdown to Torn's status-until timestamp. When it reaches zero, refresh the target to confirm their current status before attacking.

Enter your API key and use the **Refresh** link under a target's status to refresh only that target's status and health.

Use the **Dark mode** toggle to switch to a deep navy theme with teal and violet aurora accents. Your preference is saved in this browser.

Use **Download updated JSON** to save the current target list with refreshed status, health, and last-action data. Browser security does not allow the app to overwrite the uploaded file directly, so it downloads a separate `-updated.json` copy. Torn's public basic user response does not provide other players' last-attack records or battle stats, so those original JSON values are retained.

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
