# 1platforms

**We’ll be down to one by Q3.**

`1platforms` is a keyboard-driven pixel-art platform game about a company promising to unify its platforms in the next quarter. The nerd has to keep climbing before each ledge reaches Sundown, collect compliance, and cope with the inevitable “temporary” systems.

## Play

Open `index.html` in a modern browser, or serve this directory locally:

```sh
python3 -m http.server 8000
```

Visit <http://localhost:8000>. The game is fully browser-based: no backend, build step, dependencies, or external assets are required.

## Controls

| Keys | Action |
| --- | --- |
| `Enter` | Start or restart |
| `H` | Open the Field Guide; use `H`, `Escape`, or `Enter` to return |
| `A` / `D` or `←` / `→` | Move |
| `Space`, `W`, or `↑` | Jump |
| `↓` + `Space` | Drop to the previous platform; costs 75% of current compliance |

Decoys automatically start a mandatory clearance task. Type the highlighted keycaps or follow the arrow sequence; the nerd dances along. The Sundown bar keeps shrinking during tasks.

## How it works

- Most jumps have one platform. Blind forks with two, and rarely three, platforms appear every 5–8 single-platform jumps. Each platform gets a randomly generated corporate name; only one fork option is true.
- Platform widths vary. Consecutive correct landings build a score streak, up to +100; a decoy or down-jump breaks it.
- A true landing restores a random 5–7 seconds of Sundown. A decoy gives 4–5.5 seconds, costs 18 compliance, and adds orbiting migration debt that slows movement. Hit `Backspace` to correct a typing-task entry; errors cost Sundown.
- Sundown is shown as a segmented bar, not a numeric timer. If it empties while you’re standing on a platform, you lose. If you’re already in the air, finish the jump—but landing back on that same platform still loses.
- Compliance stamps appear on only some jumps and have a small pickup area. They award +7 compliance and score.
- About one jump in five has a burning **COMPLIANCE HOOP**. Thread its cyan center for +5 compliance; touch the flaming rim to lose 25 compliance and 0.65 seconds of Sundown. Passing outside the visible hoop is harmless.

### Rare events

- **Downgrade:** Your platform disappears. The nerd falls toward a recovery platform appearing below; steer onto it.
- **Scope Creep:** The next fork gets an extra decoy.
- **Management Intervention:** Horizontal controls reverse until you land on another platform.
- **New Compliance Framework:** Compliance is cut in half. The game-over report tracks how many events of each type you survived out of how many you encountered.

Landing on a decoy flashes **BAD CHOICE**. The Field Guide (`H`) explains the systems and pauses play while it’s open.

## Project files

- `index.html` — page shell and canvas.
- `style.css` — responsive layout and smooth, high-resolution canvas scaling.
- `game.js` — game rules, keyboard input, procedural names/events, and pixel-art rendering.
- `AGENTS.md` — development notes and maintenance checks.
- `.github/workflows/deploy-pages.yml` — publishes the static game to GitHub Pages on pushes to `main`.

For the first Pages deployment, set the repository’s **Settings → Pages** source to **GitHub Actions**.
