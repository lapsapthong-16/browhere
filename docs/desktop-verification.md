# Desktop Verification Checklist

Run these checks before treating the desktop build as release-ready.

## Automated Checks

- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] `npm run tauri:build`

## Tauri Development Check

- [ ] `npm run tauri:dev` opens the Browhere UI.
- [ ] `/api/index/status` loads without a browser tab.
- [ ] The main window can be closed without crashing the app.
- [ ] `CommandOrControl+Shift+Space` opens the compact search window.
- [ ] The compact search input is focused immediately.
- [ ] Pressing `Escape` while the compact search window is focused hides that window.
- [ ] Pressing `Escape` in another app is not intercepted by Browhere.

## Folder And Result Actions

- [ ] Choose a folder with the native folder picker.
- [ ] Confirm the folder appears under approved folders.
- [ ] Index a small known fixture folder.
- [ ] Search returns a file from the approved folder.
- [ ] Reveal opens the result in Finder.
- [ ] Open launches the result with the default app.
- [ ] A stale or unapproved path is rejected by the native action.
- [ ] Removing the folder stops future results from that folder.

## Packaged App Check

- [ ] Install or move `src-tauri/target/release/bundle/macos/Browhere.app` to a test location such as `/Applications`.
- [ ] Launch the app from Finder.
- [ ] Confirm the UI loads without manually running `npm run start`.
- [ ] Confirm `/api/index/status` responds in the packaged app.
- [ ] Confirm app data is created under the macOS app data directory unless `BROWHERE_INDEX_DIR` is explicitly set.
- [ ] Confirm quitting the app stops the managed Next runtime.

## Current Packaging Limitation

The packaged app includes the Next standalone runtime assets under app resources, but the current launcher still requires a host `node` executable. This is an explicit limitation until a bundled Node sidecar is added.
