# 1platforms — project notes

## What this is

`1platforms` is a browser-only, single-page pixel-art platform game. The player is a nerd trying to jump onto the one true platform before the current platform reaches sundown. Decoy platforms cost compliance and create migration debt. There is no server, backend, build step, package manager, or required external asset.

The brand joke is the corporate promise that `1platforms` will be unified to one platform by Q3. Keep the headline and related copy in that self-defeating roadmap voice; do not add a separate secondary tagline.

## Run it

Open `index.html` in a modern browser, or serve the directory locally (recommended for browser security consistency):

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. The game uses only `index.html`, `style.css`, and `game.js`; there are no install commands.

## Deploy to GitHub Pages

`.github/workflows/deploy-pages.yml` publishes the static site on every push to `main` and can also be run manually with `workflow_dispatch`. It stages only `index.html`, `style.css`, and `game.js`, then uses GitHub's Pages artifact deployment actions. There is no application build, dependency install, or secret required.

For the first deployment, enable Pages in the repository's **Settings → Pages** and select **GitHub Actions** as the build and deployment source. The workflow requires `contents: read`, `pages: write`, and `id-token: write` permissions, which are declared in the workflow.

## Controls

- `Enter`: start or restart.
- `A` / `D` or `←` / `→`: move left and right.
- `Space`, `W`, or `↑`: jump.
- `↓` + `Space`: drop to the previous platform; this costs 75% of current compliance and triggers a Compliance Violation alert.
- A decoy landing automatically starts a mandatory hurdle task; there is no separate clear button.
- Typing task: enter the displayed keycap sequence; Backspace corrects the current entry.
- Dance task: follow the displayed arrow-key sequence with arrow keys or WASD.

The Sundown countdown continues during tasks and is shown as a segmented bar, not a number. It is randomized to 5–7 seconds after a correct landing and 4–5.5 seconds after a decoy. Incorrect task input consumes a little time.

## Game loop and rules

- Most jumps offer one platform. Forks appear after 5–8 single-platform jumps; ordinary forks have two platforms, with three-way forks rare. A rare Scope Creep event adds a decoy to the next fork.
- Platform signs show only randomly generated corporate names. Forks are blind guesses; do not add role tags or clue subtitles to platform signs.
- Landing feedback is a brief green/red platform flash, not a floating text badge. A decoy fork also triggers a brief red field flash with **BAD CHOICE**.
- Landing on a decoy removes compliance, creates a flying migration hurdle, and immediately opens its short mandatory clearance task. Compliance reaching zero ends the run.
- Each active hurdle visibly orbits the nerd as tangled red tape and reduces horizontal movement/jump control. The clearance task uses only highlighted keycaps or arrow symbols, with no explanatory prose; arrow inputs visibly animate the nerd's dance.
- About one jump in five spawns a titled, outlined burning compliance hoop between platforms. Pass through its cyan-marked center for +5 compliance; touching the flaming rim costs 25 compliance and 0.65 seconds of Sundown.
- Very rarely, a Downgrade event removes the current platform, flashes **DOWNGRADE**, and drops the nerd toward a recovery platform that scrolls into view from below. Steer onto it. Random events are separated by a cooldown so they cannot chain.
- A rare Management Intervention inverts horizontal controls until the next distinct platform is reached; its shared screen alert remains visible throughout and the footer shows the reversed mapping.
- A very rare New Compliance Framework event cuts current compliance in half. Event survival counts are tracked by type and shown on the game-over screen.
- Compliance stamps appear on only some jumps and have a tight pickup radius; collect them for a small score/compliance bonus.
- Every compliance gain/loss briefly floats a green/red number beside the player/platform.
- Falling past the active platform, running out the Sundown countdown, or reaching zero compliance ends the run. Best score is saved locally when browser storage is available.

## Structure and conventions

- `index.html`: page shell, metadata, canvas, and script/style references.
- `style.css`: responsive page framing and smooth canvas scaling. Keep the game legible on narrow screens.
- `game.js`: all gameplay state, input, simple pixel-art drawing, and animation. It is a self-invoking vanilla JavaScript module; avoid adding frameworks or server dependencies for this single-page game.
- `.github/workflows/deploy-pages.yml`: deploys the repository's static site to GitHub Pages on pushes to `main`.
- `AGENTS.md`: maintain these run instructions, controls, gameplay rules, and architectural constraints when making meaningful changes.

Canvas coordinates use a fixed 480×320 logical resolution. `game.js` scales the backing canvas for the rendered CSS width and device pixel ratio, keeping text sharp while pixel-art characters and platforms remain block-built. Sundown is randomized per platform and represented by a shrinking segmented bar, not a numeric timer. Keep landing feedback subtle and attached to platforms as short color flashes; do not add large floating status banners or separate blue platform subtitles. Use the shared `flashScreenAlert`/`drawScreenAlert` component for full-field alerts such as **BAD CHOICE**, **DOWNGRADE**, and **COMPLIANCE VIOLATION**. Keep platform signs to generated names only. Keep auto-triggered hurdle tasks understandable from keycaps/arrows with no explanatory prose, and keep the burning hoop's safe opening visually distinct from its hazard rim. Keep art authored with integer-aligned rectangles and use the existing palette/helpers. Keep game text high-contrast and large enough to read; update the canvas `aria-label` and these controls if input changes.

## Checks before handing off

- Run `node --check game.js` for syntax validation.
- Run the static server and verify the Q3 headline, button-only start instructions, names-only blind forks, platform/field flashes, mandatory orbiting/visual-task hurdles and dance animation, titled compliance hoop pass/hit outcomes and penalty, Downgrade fall/recovery flow, down-jump penalty, Management Intervention control inversion, framework event/stat tracking, floating compliance deltas, Sundown/fall game over, restart, and a narrow viewport in a browser.
- There is no automated browser-test setup currently. Do not introduce dependencies just to run the static game.
