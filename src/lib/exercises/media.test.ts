import assert from "node:assert/strict";
import { test } from "node:test";
import { open } from "node:fs/promises";
import { EXERCISE_CATALOG } from "./catalog.ts";
import { getExerciseDemo, VIDEO_EXERCISE_IDS } from "./media.ts";

test("every video mapping references a persisted exercise and a bundled MP4 asset", async () => {
  assert.ok(VIDEO_EXERCISE_IDS.length > 0);
  const checked = new Set<string>();
  for (const id of VIDEO_EXERCISE_IDS) {
    assert.ok(EXERCISE_CATALOG.has(id), id);
    const demo = getExerciseDemo(id)!;
    assert.ok(demo.name && demo.videos.length);
    assert.equal(new Set(demo.videos).size, demo.videos.length);
    assert.match(demo.videos[0], /^\/exercise-demos\/[A-Za-z0-9_-]+\.mp4$/);
    for (const url of demo.videos) {
      if (url.startsWith("/exercise-demos/")) {
        if (checked.has(url)) continue;
        checked.add(url);
        const file = await open(new URL(`../../../public${url}`, import.meta.url));
        try {
          const header = Buffer.alloc(40);
          const { bytesRead } = await file.read(header, 0, header.length, 0);
          assert.ok(header.subarray(0, bytesRead).includes(Buffer.from("ftyp")), url);
        } finally {
          await file.close();
        }
      } else {
        assert.equal(new URL(url).protocol, "https:");
        assert.match(new URL(url).pathname, /\.mp4$/);
      }
    }
  }
});

test("common movements resolve exactly, while variations identify the base demonstration", () => {
  assert.equal(getExerciseDemo("Barbell_Bench_Press_-_Medium_Grip")?.name, "Barbell Bench Press");
  assert.equal(getExerciseDemo("Barbell_Squat")?.name, "Barbell Back Squat");
  assert.equal(getExerciseDemo("Seated_Dumbbell_Press")?.name, "Seated Dumbbell Shoulder Press");
  assert.equal(getExerciseDemo("Tempo_Barbell_Curl")?.baseExercise, "Barbell Curl");
  // The upstream aliases incorrectly equate a flat bench press with a shoulder press.
  assert.equal(getExerciseDemo("Dumbbell_Bench_Press"), null);
  assert.equal(getExerciseDemo("Tempo_Dumbbell_Bench_Press"), null);
  assert.equal(getExerciseDemo("Cable_Crunch"), null);
  assert.equal(getExerciseDemo("Single_Arm_Dumbbell_Bench_Press"), null);
  assert.equal(getExerciseDemo("Barbell_Deadlift"), null);
  assert.equal(getExerciseDemo("unknown"), null);
});
