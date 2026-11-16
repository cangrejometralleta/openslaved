# OpenSlaved

An open, browser-based implementation inspired by **[Slave of God](https://www.increpare.com/game/slave-of-god.html)**, the 2012 game by increpare.

OpenSlaved explores the feeling of losing yourself in a nightclub: movement, music, flashing lights, and encounters with strangers. Its aim is to reinterpret that experience in a publicly available web project that people can inspect and develop further. This is an independent reinterpretation, not an official release or a direct port of the original game's Unity source.

**[Play in your browser](https://cangrejometralleta.github.io/openslaved/)**

## The experience

Explore a 3D club with a dance floor, bar, DJ booth, and bathroom. Move among faceless polygonal figures, dance, order drinks, and interact with the people around you. Angular dance poses and rhythmic lighting give the room its pulse.

The game includes synthesized music and an optional browser-tab audio source. Use **Music source** to share audio from another tab; the club responds to the detected rhythm. Availability depends on your browser's tab-sharing support.

**Flashing lights:** the strobe mode contains intense flashes. Choose gentle mode at entry or press **L** to disable them during play.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Shift | Run |
| Mouse / drag | Look around |
| J / R | Turn |
| Esc | Release the mouse |
| C (hold) | Crouch |
| Space | Tap the rhythm |
| B | Toggle dancing |
| E / click | Interact |
| Q | Sip your drink |
| X | Sit at the bar or stand up |
| M | Select or stop a shared music source |
| L | Toggle gentle lighting |

## Run locally

Install Node.js, clone the repository, and start the development server:

```sh
git clone https://github.com/cangrejometralleta/openslaved.git
cd openslaved
npm run dev
```

Open **http://127.0.0.1:4173**. Saved file changes reload the page automatically. No dependency installation or build step is required; Three.js is bundled in `vendor/`.

## Project structure

- `index.html` — entry page and interface.
- `src/engine.js` — club geometry, characters, movement, interactions, and lighting.
- `src/audio.js` — synthesized music.
- `src/tab-audio.js` — shared tab media and rhythm analysis.
- `src/style.css` — interface styling.
- `scripts/dev-server.cjs` — local server with automatic reload.
- `scripts/export.py` — export to a standalone HTML file.
- `tests/` — movement, collision, character, and entry checks.

Run the existing checks with:

```sh
node tests/collisions.cjs
node tests/entry.cjs
```

To create a standalone HTML export with Python 3:

```sh
python3 scripts/export.py
```

The output is `dist/openslaved.html`. Shared tab media still depends on browser permissions and secure-context support.

GitHub Pages publishes the site from the root of `main` when changes are pushed.

## Credits and licensing

The original **Slave of God** is by **increpare**. Visit its [official page](https://www.increpare.com/game/slave-of-god.html) for the original game and source code.

OpenSlaved uses **Three.js**, distributed under the [MIT license](vendor/THREE-LICENSE.txt).

OpenSlaved's source is publicly available. A project-wide license has not yet been specified; the bundled Three.js license applies to that dependency.
