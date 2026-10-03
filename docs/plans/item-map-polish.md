# Food Fit Fun — item and map polish

2026-10-03. Implement the user's requested visual improvement and publish to the existing Food Fit Fun production project.

## Visual contract

- A cheerful park town: pale blue sky, soft green hills, planted sidewalks, rounded trees, benches, street lamps and small pastel shops. Buildings and benches face inward toward the road, flower boxes sit parallel to it, and tree canopies reach about 6 scene units above taller trunks (user refinement). Keep the three running lanes unobstructed. Scenery stays beyond the road edge and uses quieter colors than collectibles.
- Additional user refinement: a populated neighborhood on both sides, with frequent houses, shopfronts, cafes and small apartments; a second row of buildings; bus shelters, market stalls, bicycles, mailboxes, bins and garden fences. Vary silhouettes and roof heights while keeping all decoration behind the curbs and facades facing the road. Reuse existing materials and batch each tile.
- One consistent clay-like 3D collectible style for all 15 items. Food silhouettes distinguish each type: layered burger, thick pizza slice/crust, iced donut/hole, curved banana bunch, carton milk, capped water bottle, divided meal tray and leafy vegetables. Exercise items retain their airborne height and readable shape.
- Ground models fit below the existing 2.1-unit jump clearance; common scale and floor contact, subtle contact shadows, restrained pickup rings. Preserve current collision distances, BMI changes, questions, continuous food behind gates and high jump.
- Use procedural Three.js geometry with moderate segment counts and reused materials within each model. No external asset downloads, textures or new runtime dependencies.

## Finish gate

Build and existing behavioral tests; inspect all 15 models in a dev gallery, the actual course with/without gates, desktop and mobile; check ground model bounds against jump clearance and rendering errors. Publish only after visual inspection. Keep Supabase unchanged.
