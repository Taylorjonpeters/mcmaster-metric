<p align="center"><img src="icons/192x192.gif" alt="McMaster-Carr Metric Converter" width="192"></p>

# McMaster-Carr Metric Converter

A Vibe-Coded Chrome extension that shows imperial values on mcmaster.com in metric.
This is because I am a Canadian Living in the US, and most of the raw stock options on McMC have only imperial measurements
and I have absolutely NO interest in figuring out ow thick .0024" is while buying aluminum sheet.

`3/4"` → `19.05 mm`  ·  `170,000 psi` → `1,172 MPa`  ·  `-20° to 180° F` → `-28.9° to 82.2° C`

## Install (no build needed)

1. Download the latest `mcmaster-metric-vX.Y.Z.zip` from the [Releases page](../../releases/latest).
2. Unzip it somewhere permanent (Chrome reads the files from that folder, so don't delete it).
3. Open `chrome://extensions` and turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder (the one containing `manifest.json`).
5. Pin the extension and open the popup to choose what to convert.

Works in Chrome and other Chromium browsers (Edge, Brave, ...). To update, download the new zip and replace the folder's contents, then click the reload icon on `chrome://extensions`.

## What it converts

| Kind | Examples |
|---|---|
| Length | `3/4"`, `1-1/2"`, `.0024"`, `12 in.`, `5 ft.`, `3" x 4"`, `2 mil`, `32 µin`, `2 miles` |
| Ranges (one shared unit) | `1/4 to 1/2 in.` → `6.35 to 12.7 mm`, `100 to 200 psi` |
| Area / volume | `sq. in.`, `in.²`, `sq. ft.`, `sq. yd.`, `cu. in.`, `cu. ft.`, `cu. yd.`, `gal.`, `qt.`, `pint`, `fl. oz.` |
| Weight / density | `lb.`, `oz.`, `lb./ft.`, `lb./sq. ft.`, `lb./cu. ft.`, `lb./cu. in.`, `lb./gal.` |
| Pressure | `psi`, `psig`, `ksi`, `lb./sq. in.`, `in. Hg`, `in. of water` |
| Temperature | `°F`, `° F`, `ºF`, `deg. F`, `degrees Fahrenheit`, ranges like `-20° to 180° F` |
| Torque | `ft.-lbs.`, `in.-lbs.`, `in.-oz.` |
| Flow / speed / power | `gpm`, `gal./min.`, `gph`, `cfm`, `scfm`, `cu. ft./min.`, `cfh`, `ft./min.`, `in./sec.`, `ipm`, `mph`, `hp`, `BTU`, `BTU/hr` |
| Force | `lbf` |

Thread callouts such as `1/4"-20` and `#10-32` are left alone because they are names, not measurements.

## Settings (popup)

- **Where** – defaults to *Raw materials & stock* pages only. Switch to everywhere, or pick *Fasteners*,
  *Pipe, tubing & fittings* and/or your own keywords. McMaster doesn't expose its catalog section on the
  page, so this is keyword matching on the page title, heading, breadcrumb and URL.
- **Display** – metric only (`19.05 mm`) or both (`3/4" (19.05 mm)`).
- **Convert** – turn individual unit categories on or off.

Settings sync through your Chrome profile (`chrome.storage.sync`). The extension has no servers, no
analytics, and only runs on `mcmaster.com`. The only permission it requests is `storage`.

## Disclaimer

Not affiliated with, endorsed by, or sponsored by McMaster-Carr Supply Company. "McMaster-Carr" is a
trademark of its owner. Conversions are rounded for display and are applied to page text only; the site
still orders, filters and prices in its own units. **Always verify critical dimensions against the
original value before ordering or machining. DO NOT build something important without checking I know I will but I dont want you to**

## Development

```
npm install
npm test          # unit + jsdom tests
npm run build     # writes dist/mcmaster-metric-v<version>.zip
```

- `src/converter.js` – pure text conversion and page-scope matching
- `src/dom-engine.js` – DOM walking/restoring (matches across sibling text nodes, because McMaster renders `3/4"` as `<span>3/4</span>"`)
- `src/content.js` – settings and single-page-app navigation wiring

### Releasing

Bump `version` in `manifest.json` and `package.json`, commit, then push a matching tag:

```
git tag v0.1.1 && git push origin v0.1.1
```

GitHub Actions runs the tests, builds the zip and attaches it to a new Release.

## License

[MIT](LICENSE)
