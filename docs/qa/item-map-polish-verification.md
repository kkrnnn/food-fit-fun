# Food Fit Fun — item and map polish

2026-10-03, Asia/Bangkok.

## Implemented

- Replaced all 15 collectible models with a consistent procedural clay style: smooth apple/orange, curved banana bunch, stem/crown broccoli, grooved carrot, layered burger, thick pizza slice with curved crust/toppings, glazed donut, divided meal tray, cup/straw cola, capped water bottle, gabled milk carton, paired shoes, metal dumbbell and continuous rope with handles. Ground models have common floor contact and fit beneath the existing jump clearance.
- Replaced candy roadside props with a park town: planted sidewalks, benches, flower boxes, lamps, pastel shops, taller rounded trees (canopies about 6 scene units), low hedges, hills and a distant neighborhood silhouette. Houses and benches face toward the road; flower boxes run parallel to it, following the user's refinement.
- Calmer blue sky and cool road contrast with the warm food palette; reduced footprint rings, added contact shadows, expanded the near shadow camera and suppressed decorative floating particles in the learning course.
- Added the requested denser roadside environment: two front buildings in most tiles plus a second neighborhood row, alternating gabled houses, shops, cafes and three-floor apartments. Details include awnings, framed windows, balconies, rooftop water tanks, garden fences, cafe tables/stools, bus shelters, produce stalls, bicycles/racks, mailboxes, recycling bins and garden pergolas. Front facades face inward; bikes align with the street.
- Static scenery pieces share a draw call per material within each moving tile. Individual collectible IDs continue to persist across quiz transitions. No external models/textures/dependencies or database changes.

## Verification

- Full tests: 24 files / 103 tests passed. New geometry checks ensure all ground models remain below the actual jump clearance and the park tile geometry remains outside both curbs after orientation/batching.
- TypeScript/Vite build passed; existing bundle-size warning remains. `git diff --check` passed.
- Inspected all 15 real model factories in the dev gallery, including corrected milk roof, smoother apple and continuous jump rope.
- Inspected the real course renderer at desktop 1280×720 and mobile 390×844: high jump over the pizza, visible food behind/after gates, unobstructed lanes, taller trees and inward-facing roadside objects. Local browser snapshots of the expanded neighborhood reported approximately 60 fps at medium quality (about 829–864 draw calls in inspected frames); this is a local browser observation, not a physical-phone benchmark.
- During iterative Vite HMR the dev fixture logged duplicate root/Three instance warnings; added fixture root disposal and verified final renders after full reload. These were development reload artifacts, not production build errors.
- Camera input and a full three-minute game were not retested for this rendering-only change. Existing behavior tests cover scoring, quiz resolution, jumping, feedback and cloud data projection.

## Evidence

- [Expanded neighborhood desktop](neighborhood-desktop.jpg)
- [Expanded neighborhood mobile](neighborhood-mobile.jpg)
- [All item models](item-models-gallery.jpg)
- [Final desktop park](park-map-final-desktop.jpg)
- [Final mobile park and gate](park-map-final-mobile.jpg)
- [Item/jump mobile](park-items-jump-mobile.jpg)

Dev galleries are separate entry points and are not bundled in the production game. No QA score/star was written to Supabase.

## Production

Published the expanded neighborhood to [Food Fit Fun](https://food-fit-fun.vercel.app). [Vercel deployment](https://vercel.com/dream-league1/food-fit-fun/Y1veBozKJHBuuecHNaar5ZbK3eDQ) reported READY / Production. Live home returned HTTP 200 with asset `index-BX6I73Ou.js`; GET `/api/analytics/runs` returned HTTP 200 and `{"enabled":true}`. No QA analytics rows were submitted.
