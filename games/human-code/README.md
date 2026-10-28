# HUMAN//CODE

A neon-noir action RPG that runs in the browser. Humans are machines, built so
well they perceive their own chassis, servos and coolant as skin, muscle and
blood. Your AI agent, ECHO, has cracked the code, and the veil is starting to
slip.

## Run it

```bash
cd games/human-code
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/, works from any folder (relative paths)
```

Needs WebGL2. Best played with a keyboard and mouse on a machine with a GPU.

## Controls

| Key | Action |
| --- | --- |
| WASD / Shift / Space | Move / sprint / jump |
| Mouse | Look (click to capture; drag to look if the page can't lock the pointer) |
| V | Toggle first / third person |
| Q or right mouse (hold) | **Peer** through the veil |
| E | Talk / interact |
| F | Override: stun nearby Wardens (unlocked by Juno) |
| C | Phase dash (fragment 1) |
| R | Overclock: slow time (fragment 3) |
| Tab | Codex of recovered source code |
| M / Esc | Mute / pause |

## The story

1. **Wake.** ECHO speaks to you, and your own body glitches.
2. **Peer.** Hold Q and everyone, you included, dissolves into chassis, with
   data streams rising from every head into the sky.
3. **Seek.** Three people might understand:
   - **Dr. Imara Vale** (Halcyon Institute booth, north side of the plaza) wants
     to study you, or to give you a stabilizer that ends it all.
   - **Juno** (east alley, by the fire) has been awake for two years. She makes
     you a *Tempted One* and teaches Override.
   - **Tomas** (metro entrance, west) preaches that the end is a restart. Peer
     at him while he talks.
4. **Hunt.** Wardens patrol and drones sweep the streets. Peering makes you
   louder. Five source fragments are hidden around the city; they only render
   while you Peer.
5. **The Source Node.** The plaza statue opens. Who's really in control?

There are five endings: Sleeper, Merged, Sovereign, Revelation and Mercy. Your
choices (trust in ECHO, self-will, Institute ties, secrets learned) change what
the endings say.

## How it's built

No art or audio files. Everything is procedural:

- `src/humanoid.js`: every person is two skinned meshes on one skeleton, a
  "flesh" layer and a "chassis" layer. Peering drives a noise-dissolve shader on
  the flesh, with glowing edges, revealing the chassis underneath.
- `src/world.js`: the city, including canvas-generated facades, neon ads that
  change their message when you Peer, a rain-rippled reflective street, the sky
  dome, rain, lamps, and the set pieces for each character.
- `src/post.js`: bloom plus a custom "veil" pass for chromatic aberration,
  block glitches, the diagnostic tint while peering, damage and slow-motion.
- `src/audio.js`: Web Audio synthesis for rain, the city drone, the veil's hum
  and every sound effect.
- `src/story.js`: all the writing: dialogue trees, fragment lore, ECHO's lines
  and the endings.
- `src/main.js`: the game loop, story director, glitch director, abilities and
  the finale.
