# Forge product context

## Product decisions

- Forge is entirely free. All users have access to every feature.
- Do not add paywalls, paid tiers, subscriptions, checkout, upgrade prompts, membership badges, or paid feature quotas.
- Keep technical rate limits for abuse prevention independent of access or payment. Show a short, actionable wait message only when a request is actually limited.
- Keep customer copy focused on training, progress, and the action to take next. Do not expose provider names, configuration details, internal scoring mechanics, or implementation terminology unless needed for a meaningful user decision.
- Preserve useful privacy disclosures, injury precautions, clear errors, and confirmation before changing a plan or publishing a workout.
- Onboarding supports preset goals or an optional current-body and goal-reference photo comparison. Photos suggest training priorities, not a guaranteed physique or medical assessment. Users can continue without photos.

## Maintenance

Historical database migrations are retained for existing installations; their old billing columns do not grant or restrict access. Payment processing and billing UI have been removed.
