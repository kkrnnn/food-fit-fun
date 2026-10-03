# Upright item models — 2026-10-03

PIZZA, DONUT, MEAL and SHOES had horizontal top surfaces. Their model subgroup now tilts +80 degrees around X so the top faces the runner camera, enlarged 15%. Exercise ring and arrow stay upright separately. Ground pizza/donut/meal are lifted to 1.25 to avoid cutting into the road. Existing upright and spherical models retain their geometry.

Learning items now sway about 10 degrees instead of rotating continuously through edge-on/back-facing views. Item counts, hit detection, jump requirements and BMI effects unchanged.

Visual QA on local Vite: all four models inspected in the actual GameEngine3D camera using docs/qa/upright-items-preview.html (development-only fixture). Pizza toppings, donut hole/icing, meal components and shoe laces are visible; exercise cue remains upright. Screenshot: upright-pizza.png. No production deployment.

81 automated tests passed. TypeScript/Vite production build passed; existing bundle-size warning remains.
