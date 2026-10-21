# 1platforms — project notes

## What this is

`1platforms` is a browser-only, single-page pixel-art platform game. The player is a nerd trying to jump onto the one true platform before the current platform sunsets. Decoy platforms cost compliance and create migration debt. There is no server, backend, build step, package manager, or required external asset.

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
- `C` (also `E`): open a migration-debt task while standing on a platform.
- Typing task: type the displayed command; Backspace corrects the current entry; Escape hides the task.
- Dance task: enter the displayed direction sequence with arrow keys or WASD; Escape hides the task.

The sunset timer continues during tasks. Incorrect task input consumes a little time. Hiding a task does not clear its hurdle.

## Game loop and rules

- The opening jump has one platform. Later jumps show two or three choices.
- Read the round's clue and the labels on candidate platforms to choose the canonical one.
- Landing on a true platform rewards score and compliance and resets the sunset deadline.
- Landing on a decoy removes compliance, creates a migration hurdle, and shortens the next deadline. Compliance reaching zero ends the run.
- Each unresolved hurdle reduces horizontal movement/jump control. Clear one by completing its queued typing or arrow-dance task; control returns as hurdles are removed.
- Collect floating compliance stamps during jumps for a small score/compliance bonus.
- Falling past the active platform, running out the sunset timer, or reaching zero compliance ends the run. Best score is saved locally when browser storage is available.

## Structure and conventions

- `index.html`: page shell, metadata, canvas, and script/style references.
- `style.css`: responsive page framing and smooth canvas scaling. Keep the game legible on narrow screens.
- `game.js`: all gameplay state, input, simple pixel-art drawing, and animation. It is a self-invoking vanilla JavaScript module; avoid adding frameworks or server dependencies for this single-page game.
- `.github/workflows/deploy-pages.yml`: deploys the repository's static site to GitHub Pages on pushes to `main`.
- `AGENTS.md`: maintain these run instructions, controls, gameplay rules, and architectural constraints when making meaningful changes.

Canvas coordinates use a fixed 480×320 logical resolution. CSS scales the canvas smoothly to reduce jagged text while pixel-art characters and platforms remain block-built. Keep art authored with integer-aligned rectangles and use the existing palette/helpers. Keep game text high-contrast and large enough to read; update the canvas `aria-label` and these controls if input changes.

## Checks before handing off

- Run `node --check game.js` for syntax validation.
- Run the static server and verify title/start, movement and jumping, correct and decoy landings, compliance pickup, both task types, sunset/fall game over, restart, and a narrow viewport in a browser.
- There is no automated browser-test setup currently. Do not introduce dependencies just to run the static game.
