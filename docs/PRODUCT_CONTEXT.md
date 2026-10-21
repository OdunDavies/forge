# Forge product context

## Product decisions

- Forge is entirely free. All users have access to every feature.
- Do not add paywalls, paid tiers, subscriptions, checkout, upgrade prompts, membership badges, or paid feature quotas.
- Keep technical rate limits for abuse prevention independent of access or payment. Show a short, actionable wait message only when a request is actually limited.
- Keep customer copy focused on training, progress, and the action to take next. Do not expose provider names, configuration details, internal scoring mechanics, or implementation terminology unless needed for a meaningful user decision.
- Preserve useful privacy disclosures, injury precautions, clear errors, and confirmation before changing a plan or publishing a workout.
- Onboarding supports preset goals or an optional current-body and goal-reference photo comparison. Photos suggest training priorities, not a guaranteed physique or medical assessment. Users can continue without photos.
- Workout selection uses compound lifts, accessory balance and alternating angles inspired by the Hunt Fitness Ronnie Coleman article. Adapt the principles to ordinary users; do not copy professional lifting loads, maximal efforts or diet quantities.
- Weekly schedules: 2–3 days full body; 4 days upper/lower twice; 5 days upper/lower plus pull/push/legs; 6 days pull/push/legs twice. Include shoulders with pressing and calves with pulling/lower sessions. Keep at least one rest day, including when all seven days are available.
- Movement coverage, equipment, injury restrictions and experience take priority over muscle-focus percentages. Focus changes accessory emphasis without displacing the main patterns. AI explanations must preserve the validated program. Existing plans change only when users choose to rebuild.

## Maintenance

Historical database migrations are retained for existing installations; their old billing columns do not grant or restrict access. Payment processing and billing UI have been removed.

AI supports NVIDIA and Gemini through shared server-side configuration. Production uses NVIDIA with `AI_PROVIDER=nvidia`; the existing key can remain under `GEMINI_API_KEY`. Never route an ambiguous key to a provider based only on that legacy variable name. Keep provider details out of customer copy and verify model availability before changing defaults.
