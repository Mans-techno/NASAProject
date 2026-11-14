# Юный астронавт: База (Junior Astronaut: Outpost)

A browser game for kids aged 7–12, in **Russian and English** (RU/EN button on every screen). The player runs a 4-person outpost on the Moon (Shackleton crater rim) or Mars (Utopia Planitia) for 20 days. Nothing to install and no account needed: open `index.html` in any browser.

**For judges:** press **"▶ Judges' demo mission"** on the start screen, or open `index.html?demo&lang=en`. The demo starts with a 5-step tutorial. On day 3 it plays the real 28 Oct 2003 "Halloween" proton storm (X17, S4). On day 9 it plays the 24 Oct 2014 X3.1 flare, which was very bright but brought almost no protons.

## Walk the base (survival mode)
When a mission starts, you are the commander standing inside the habitat dome.
- **Move:** WASD or arrow keys (Shift to run), or the on-screen joystick on a phone. Drag to turn the camera.
- **First or third person:** press **V** (or the eye button).
- **Jump with real gravity:** press **Space**. The jump uses the real surface gravity: 1.62 m/s² on the Moon and 3.71 m/s² on Mars, so the same push gives a much higher, slower jump on the Moon. Ceilings stop you indoors.
- **The base is five connected modules:** the main dome (22 m across, with rooms for bunks, galley, gym, comms and a medical bay), an airlock tunnel to the east, a tunnel to the geodesic greenhouse in the west, and a tunnel to the cylindrical lab in the south. Walls, doorways and floors are solid, and bilingual signs label every room.
- **Work sites** are glowing rings with our own line symbols (no emoji). Press **E** to pick the day's task there. Indoors: bunks (sleep to end the day), medical bay, comms desk (radio link), lab (science), tool locker (repair), greenhouse (build a grow bed, harvest). Outdoors: solar field, battery bank, regolith quarry, drill site, radio dish, reactor pad.
- **Crew:** three crew members (engineer, doctor, biologist) walk between rooms and jobs. Walk up and press E to talk; each gives advice based on the live mission state.
- **Harvest (Engineer mode):** once a day, collect fresh food from working grow beds (+0.4 kg per bed and +2% health). Plants regrow over the next days.
- **Power** is split with the Power button (**Q**). There is no separate console to walk to.
- **Survival:** the suit refills while you are inside any pressurised module. Outside it holds about 2.5 minutes of oxygen; if it runs out, the crew drags you back and you lose 10% health. During a real proton storm, every second outside adds radiation dose. A mini-map shows modules, work sites and crew.
- **Terrain:** 900 × 900 m with craters, polar massifs on the Moon and mesas on Mars.

## Models
All base models were built in **Blender 5.3** with a Python script (`bpy`) and exported as glTF (.glb). They are embedded in `index.html`, gzip-compressed (about 0.6 MB), and loaded with Three.js GLTFLoader, so the game still runs from a single offline file. Models: habitat dome with furnished interior, lab, geodesic greenhouse, grow beds, lettuce, tomato and wheat plants, three tunnels, solar panel, battery, fission reactor, radio dish, rover, cargo lander, drill rig, excavator, crates, path lights, an EVA astronaut and crew members with jointed arms and legs.

## The trade-off loop
Each day the player:
1. **Splits limited power** between oxygen (water electrolysis), heating and the radio link to Earth. Engineer mode adds water recycling and greenhouses. Any surplus charges the battery. When there isn't enough power, every system browns out together.
2. **Gives the crew one task:** regolith shielding, a solar panel, a battery, a reactor, a repair, dust cleaning (Mars), or a science sortie. Science only counts once the radio sends it to Earth, so it costs power as well as radiation dose from going outside.
3. **Ends the day** and reads a report. Every event includes a short "Почему так? / Why?" note explaining the real engineering behind it.

## Real NASA data (archived or live, always labelled)
| What | Where it is used | Source |
|---|---|---|
| 10 real solar events: flare class, sunspot region, NOAA proton-storm level (S0–S4) and peak >10 MeV flux | Each mission draws 2. At least one is a real proton storm. **Radiation dose is set by the proton storm, not by the flare class**, and the game teaches this with the Oct 2014 "bright but harmless" flares | NOAA SWPC *Solar Proton Events Affecting the Earth Environment*; NASA DONKI (2010 onward) |
| **Space weather today** (optional) | Fetches the last 30 days of flares (FLR) and proton events (SEP) from NASA DONKI. The player can add the strongest recent flare to the mission, marked "live". If the request fails, the game says so and uses the archive | NASA DONKI API, fetched live |
| Surface radiation: Mars 0.67 mSv/day, Moon 1.37 mSv/day | Daily background dose | Curiosity RAD (Hassler et al., Science 2014); Chang'e-4 LND (Zhang et al., Sci. Adv. 2020) |
| O₂ 0.84 kg, food 1.8 kg per person per day | Consumption | NASA BVAD |
| Water recovery 90% (ISS: ~93–98%) | Recycler | NASA ECLSS, 2023 milestone |
| Earth–Mars light time for today's date | Radio delay shown in game. On Mars the onboard computer gives advice, because Earth is too far away to help in time | JPL approximate Keplerian elements |
| 40 kW fission reactor | Reactor build | NASA Fission Surface Power |
| Plant and crew-health experiments | Basis for greenhouses and recovery | NASA OSDR |

The **Наука в игре / The science** screen shows all of this inside the game: the full event table, what is real and what is simplified, and 13 linked sources.

**Simplifications:** the game picks a dose for each storm level (S0 ≈ 1, S3 ≈ 45–50, S4 ≈ 70–85 mSv with no shielding). These numbers are an order-of-magnitude choice for the game. A live DONKI proton event counts as S1, because DONKI does not report the S-level. The game's dose limit is 100 mSv per mission (NASA's real limit is 600 mSv over a whole career). Energy is counted in kWh per day.

## Accessibility and classroom use
- **Cadet** mode (ages 7–9): 3 core resources (power, oxygen, radiation). **Engineer** mode (ages 10–12+): adds water, food, greenhouses and breakdowns.
- First-time tutorial, built-in glossary, keyboard accessible, reduced-motion support, works on phones.
- **Mission code** (e.g. `M-3844`): the whole class can replay the same mission and compare decisions.
- Language: `?lang=ru` or `?lang=en`, or the RU/EN button.

## Balance testing
960 automated games: 60 seeds × 2 planets × 2 modes × 4 strategies. Each cell shows wins out of 60.

| Planet / mode | Do nothing | Science every day | Build, no plan | Planned play |
|---|---|---|---|---|
| Moon / Cadet | 20 (no science, 1 star) | 7 | 60 | 60 |
| Moon / Engineer | 11 | 4 | 30 | 60 |
| Mars / Cadet | 45 (no science, 1 star) | 0 | 58 | 60 |
| Mars / Engineer | 0 | 0 | 6 | 54 |

## Files
- `index.html`: the standalone game (a single file with Three.js, GLTFLoader and the Blender models inlined; no network needed except optional fonts and live DONKI).
- `README.md`: this explainer.
