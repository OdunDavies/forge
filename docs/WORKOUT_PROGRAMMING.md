# Workout programming

Source: [Hunt Fitness — The Ronnie Coleman Workout and Diet Program](https://kylehuntfitness.com/the-ronnie-coleman-workout-and-diet-program/).

Forge adapts the article's compound-first approach, horizontal/vertical pulling, varied pressing angles, arm accessories and calf work. It does not reproduce the article's full routine. Its rolling rotation is adapted to a fixed week with two lower-body sessions at higher frequencies. Shoulders join pressing days; maximal lifts and the professional athlete's workload and diet are not prescribed.

| Training days | Sessions in order |
| --- | --- |
| 2 | Full body A, B |
| 3 | Full body A, B, C |
| 4 | Upper A, lower A, upper B, lower B |
| 5 | Upper A, lower A, pull B, push B, lower B |
| 6 | Pull A, push A, lower A, pull B, push B, lower B |

Sessions follow selected weekdays in calendar order. All-seven-day availability reserves Sunday for recovery. Unavailable days stay rest days. These are weekly templates, not an automatically advancing multiweek rotation.

The first four exercise slots protect essential movement coverage. Additional slots can emphasize the user's chosen muscles. A/B sessions prefer different available exercises and angles. Selection is deterministic so rebuilding does not create arbitrary novelty. Equipment and conservative injury exclusions filter the catalog before selection; same-muscle alternatives are used when possible. If no appropriate alternative exists, the session is shorter rather than filled with an unrelated or excluded exercise.

Beginners receive two sets and RPE 6; other users normally receive three sets and RPE 7. Sessions of 30 minutes or less use two sets and up to four movements; longer sessions use five, or six from 75 minutes. Compound strength work uses 5–8 reps with longer rests; other compounds use 8–10, accessories 10–15, static holds 20–30 seconds. Warm-up and gradual progression cues accompany sessions. This is general programming, not rehabilitation.

`routines.ts` defines movement templates and substitutions; `fallback.ts` applies profile constraints and prescriptions. AI may personalize explanations and notes only: `refinement.ts` rejects changes to the schedule, exercise identities/order or prescriptions. The deterministic plan remains available if AI fails. New logic applies during onboarding or an explicit plan rebuild; saved plans and workout history are preserved.
