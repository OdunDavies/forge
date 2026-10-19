// The alias and parameter are fixed by callers, never supplied by a request.
export function activityVisibilitySql(alias = "s", viewer = "$1"): string {
  return `(${alias}.user_id = ${viewer} or ${alias}.visibility = 'public' or
    (${alias}.visibility = 'followers' and exists
      (select 1 from follows f where f.follower_id = ${viewer} and f.following_id = ${alias}.user_id)))`;
}
