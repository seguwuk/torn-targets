# Torn Targets

A small Angular app that loads target data from a JSON file and displays a sortable list of targets with last action, last attack, and attack actions.

After uploading a YATA target JSON file, you can optionally enter your personal Torn API key to refresh each target's current status and health. The key is sent directly to Torn over HTTPS, kept only in the page while the refresh runs, and cleared when the refresh completes. Requests are made one at a time with a delay to stay within Torn's API rate limit. Never share your API key or enter your Torn password.

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
