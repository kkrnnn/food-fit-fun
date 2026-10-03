# Health reference used by BODY RUSH learning mode

Verified 2026-10-02. Latest UI accepts whole years only and removes activity selection. Newly saved profiles use `agePrecision=years` and empty activity: raw BMI is available, monthly BMI category and daily EER are unavailable rather than inferred. The reference functions below remain supported for complete historical data.

Supported product age: 108–155 completed months (9–12 years).

## BMI

`weightKg / (heightCm / 100)^2`. Use unrounded BMI for comparisons.

Data: [CDC 2000 BMI-for-age CSV](https://www.cdc.gov/growthcharts/data/zscore/bmiagerev.csv), downloaded from CDC, original bytes retained at `src/features/health/data/bmiagerev.csv`.

SHA256: `cbeea0e8d500ee15c652f3fdc45bcd02cb9c15d4d1e86f4d8048bbfea8d166e5`.

The bundled JSON contains 96 sex/month rows, retaining P5/P85/P95. A completed integer month maps to the half-month row (e.g. 132 → 132.5); no interpolation or percentile approximation is used. This is the [CDC monthly-bin convention](https://www.cdc.gov/growthcharts/cdc-data-files.htm). Categories compare against P5, P85, P95, with equality included in the next category. This is a US reference, not a Thai population standard. The app displays reference bands in the caregiver details and never derives score/character ability from them. No exact high-tail percentile or diagnosis is provided.

Source test row: male, 132.5 months: P5=14.56000917, P85=20.19667437, P95=23.21358351. BMI test: 30 kg at 130 cm → 17.7514792899.

## Estimated daily energy

[Health Canada DRI equations](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html), based on DRI 2023, age 9 to <14 section. Product intentionally supports only 9–12 years.

`EER = intercept + ageCoefficient × (ageMonths / 12) + heightCoefficient × heightCm + weightCoefficient × weightKg + growth`

| Sex | Activity | Intercept | Age | Height cm | Weight kg | Growth kcal/day |
| --- | --- | --- | --- | --- | --- | --- |
| Male | Inactive | -447.51 | 3.68 | 13.01 | 13.15 | 25 |
| Male | Low active | 19.12 | 3.68 | 8.62 | 20.28 | 25 |
| Male | Active | -388.19 | 3.68 | 12.66 | 20.46 | 25 |
| Male | Very active | -671.75 | 3.68 | 15.38 | 23.25 | 25 |
| Female | Inactive | 55.59 | -22.25 | 8.43 | 17.07 | 30 |
| Female | Low active | -297.54 | -22.25 | 12.77 | 14.73 | 30 |
| Female | Active | -189.55 | -22.25 | 11.74 | 18.34 | 30 |
| Female | Very active | -709.59 | -22.25 | 18.22 | 14.25 | 30 |

For this age band the PAL intervals are [1.00,1.44), [1.44,1.59), [1.59,1.77), [1.77,2.50). For complete historical profiles the activity category was selected by a caregiver; the game does not infer activity level from camera motion. Omitted activity → unavailable EER. No adult equation or game calorie deduction is substituted. The UI rounds the final estimate for display only.

Independent worked examples, 10 years, 130 cm, 30 kg:

- Male inactive: −447.51 + 36.80 + 1691.30 + 394.50 + 25 = **1700.09**.
- Male active: −388.19 + 36.80 + 1645.80 + 613.80 + 25 = **1933.21**.
- Female inactive: 55.59 − 222.50 + 1095.90 + 512.10 + 30 = **1471.09**.
- Female active: −189.55 − 222.50 + 1526.20 + 550.20 + 30 = **1694.35**.

These are estimates with individual uncertainty; display is educational caregiver information. Height 80–220 cm and weight 10–200 kg are input sanity bounds, not medical reference bands. Real BMI/EER never change as a result of an item, quiz, score or run outcome. Raw BMI now initializes character torso proportions. The separately labelled fictional character BMI is initialBMI × (1 + balance × 0.0015), with balance clamped ±100. This is a game feedback rule, not a weight prediction or medical formula. The visual width reference of 18 is artistic calibration, not a child BMI category threshold.

## BMI meter follow-up

The in-game meter now maps simulated BMI to the CDC sex/age reference rather than mapping item balance zero to green. Whole-year ages use the envelope of all 12 possible monthly rows. Green requires BMI >= every P5 and < every P85; red requires BMI below every P5 or >= every P95. Intermediate or uncertain boundaries are amber. This conservative visual rule is a product rule, not an official CDC diagnosis; exact-month health assessment remains unavailable for whole-year input. The meter states that its color is approximate. Its position uses a fixed per-age reference scale, including margins below P5 and above P95, so collected items change position without shifting the scale. Scores and real measurements remain unchanged.
