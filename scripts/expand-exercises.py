#!/usr/bin/env python3
"""Expand free-exercise-db (~876) into a 1500+ movement catalog."""
from __future__ import annotations

import json
import re
from pathlib import Path

SRC = Path("/tmp/exercises-raw.json")
OUT = Path("/workspace/src/data/exercises.json")

IMG = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/"


def slug(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "_", name.strip()).strip("_")
    return s[:80] or "exercise"


def normalize(raw: dict) -> dict:
    images = raw.get("images") or []
    image_url = f"{IMG}{images[0]}" if images else None
    return {
        "id": raw.get("id") or slug(raw["name"]),
        "name": raw["name"],
        "force": raw.get("force"),
        "level": raw.get("level") or "intermediate",
        "mechanic": raw.get("mechanic"),
        "equipment": raw.get("equipment") or "other",
        "primaryMuscles": raw.get("primaryMuscles") or [],
        "secondaryMuscles": raw.get("secondaryMuscles") or [],
        "instructions": raw.get("instructions") or [],
        "category": raw.get("category") or "strength",
        "imageUrl": image_url,
        "source": "free-exercise-db",
    }


EXTRAS: list[dict] = []


def add(
    name: str,
    *,
    primary: list[str],
    equipment: str = "barbell",
    force: str | None = "push",
    mechanic: str | None = "compound",
    level: str = "intermediate",
    category: str = "strength",
    secondary: list[str] | None = None,
    instructions: list[str] | None = None,
    source: str = "forge-catalog",
):
    EXTRAS.append(
        {
            "id": slug(name),
            "name": name,
            "force": force,
            "level": level,
            "mechanic": mechanic,
            "equipment": equipment,
            "primaryMuscles": primary,
            "secondaryMuscles": secondary or [],
            "instructions": instructions
            or [
                f"Set up for {name.lower()} with controlled bracing.",
                "Execute the movement through a full, honest range of motion.",
                "Lock in the top or bottom position without bouncing, then reverse with control.",
            ],
            "category": category,
            "imageUrl": None,
            "source": source,
        }
    )


# Olympic / weightlifting
for n, p, s, eq in [
    ("Power Snatch", ["shoulders", "quadriceps"], ["hamstrings", "glutes", "traps"], "barbell"),
    ("Hang Snatch", ["shoulders", "hamstrings"], ["glutes", "traps"], "barbell"),
    ("Block Snatch", ["shoulders"], ["quadriceps", "traps"], "barbell"),
    ("Snatch Balance", ["shoulders", "quadriceps"], ["triceps"], "barbell"),
    ("Overhead Squat", ["quadriceps", "shoulders"], ["glutes", "lower back"], "barbell"),
    ("Snatch Pull", ["traps", "hamstrings"], ["glutes", "lower back"], "barbell"),
    ("Snatch High Pull", ["traps", "shoulders"], ["hamstrings"], "barbell"),
    ("Muscle Snatch", ["shoulders", "traps"], ["triceps"], "barbell"),
    ("Power Clean", ["traps", "quadriceps"], ["hamstrings", "glutes"], "barbell"),
    ("Hang Clean", ["traps", "hamstrings"], ["glutes", "quadriceps"], "barbell"),
    ("Block Clean", ["traps", "quadriceps"], ["hamstrings"], "barbell"),
    ("Clean Pull", ["traps", "hamstrings"], ["glutes"], "barbell"),
    ("Clean High Pull", ["traps", "shoulders"], ["hamstrings"], "barbell"),
    ("Muscle Clean", ["shoulders", "traps"], ["biceps"], "barbell"),
    ("Hang Power Clean", ["traps", "hamstrings"], ["glutes"], "barbell"),
    ("Hang Power Snatch", ["shoulders", "hamstrings"], ["traps"], "barbell"),
    ("Split Jerk", ["shoulders", "quadriceps"], ["triceps", "glutes"], "barbell"),
    ("Push Jerk", ["shoulders", "quadriceps"], ["triceps"], "barbell"),
    ("Power Jerk", ["shoulders", "quadriceps"], ["triceps"], "barbell"),
    ("Split Snatch", ["shoulders", "quadriceps"], ["traps"], "barbell"),
    ("Clean and Jerk", ["shoulders", "quadriceps"], ["traps", "triceps"], "barbell"),
    ("Clean and Press", ["shoulders", "quadriceps"], ["triceps", "traps"], "barbell"),
    ("Tall Clean", ["shoulders", "traps"], ["quadriceps"], "barbell"),
    ("Tall Snatch", ["shoulders"], ["traps"], "barbell"),
    ("No-Foot Snatch", ["shoulders"], ["traps", "quadriceps"], "barbell"),
    ("Heaving Snatch Balance", ["shoulders", "quadriceps"], ["triceps"], "barbell"),
    ("Drop Snatch", ["shoulders", "quadriceps"], ["triceps"], "barbell"),
    ("Pause Snatch", ["shoulders", "hamstrings"], ["glutes"], "barbell"),
    ("Pause Clean", ["traps", "quadriceps"], ["hamstrings"], "barbell"),
    ("Pause Jerk", ["shoulders", "quadriceps"], ["triceps"], "barbell"),
    ("Behind the Neck Jerk", ["shoulders"], ["triceps", "quadriceps"], "barbell"),
    ("Jerk Dip Squat", ["quadriceps", "shoulders"], ["glutes"], "barbell"),
    ("Jerk Recovery", ["shoulders", "quadriceps"], ["triceps"], "barbell"),
    ("Front Squat (Olympic)", ["quadriceps"], ["glutes", "lower back"], "barbell"),
    ("Halt Clean Deadlift", ["hamstrings", "lower back"], ["traps", "glutes"], "barbell"),
    ("Snatch Deadlift", ["hamstrings", "lower back"], ["traps", "glutes"], "barbell"),
    ("Romanian Deadlift (Snatch Grip)", ["hamstrings", "glutes"], ["lower back"], "barbell"),
    ("Duck Walk with Barbell", ["quadriceps", "shoulders"], ["glutes"], "barbell"),
]:
    add(n, primary=p, secondary=s, equipment=eq, force="pull" if "Dead" in n or "Pull" in n or "Clean" in n else "push", level="expert")

# Powerlifting specialty
for n, p, s, f in [
    ("Competition Squat", ["quadriceps", "glutes"], ["hamstrings", "lower back"], "push"),
    ("Competition Bench Press", ["chest", "triceps"], ["shoulders"], "push"),
    ("Competition Deadlift", ["hamstrings", "lower back"], ["glutes", "traps"], "pull"),
    ("Pause Bench Press", ["chest", "triceps"], ["shoulders"], "push"),
    ("Spoto Press", ["chest", "triceps"], ["shoulders"], "push"),
    ("Board Press", ["triceps", "chest"], ["shoulders"], "push"),
    ("Floor Press (Barbell)", ["chest", "triceps"], ["shoulders"], "push"),
    ("Pin Bench Press", ["chest", "triceps"], ["shoulders"], "push"),
    ("Slingshot Bench Press", ["chest", "triceps"], ["shoulders"], "push"),
    ("Cambered Bar Bench", ["chest", "triceps"], ["shoulders"], "push"),
    ("Close-Grip Pause Bench", ["triceps", "chest"], ["shoulders"], "push"),
    ("Larsen Press", ["chest", "triceps"], ["shoulders"], "push"),
    ("Feet-Up Bench Press", ["chest", "triceps"], ["shoulders"], "push"),
    ("Paused Squat", ["quadriceps", "glutes"], ["hamstrings"], "push"),
    ("Pin Squat", ["quadriceps", "glutes"], ["hamstrings"], "push"),
    ("Box Squat (Competition)", ["glutes", "hamstrings"], ["quadriceps"], "push"),
    ("Safety Bar Squat", ["quadriceps", "glutes"], ["upper back"], "push"),
    ("Cambered Bar Squat", ["quadriceps", "glutes"], ["upper back"], "push"),
    ("Front-Foot Elevated Split Squat", ["quadriceps", "glutes"], ["hamstrings"], "push"),
    ("Hatfield Squat", ["quadriceps", "glutes"], ["hamstrings"], "push"),
    ("Anderson Squat", ["quadriceps", "glutes"], ["hamstrings"], "push"),
    ("Pause Deadlift", ["hamstrings", "lower back"], ["glutes"], "pull"),
    ("Deficit Deadlift", ["hamstrings", "lower back"], ["glutes"], "pull"),
    ("Block Pull", ["lower back", "traps"], ["glutes", "hamstrings"], "pull"),
    ("Rack Pull (Below Knee)", ["lower back", "traps"], ["glutes"], "pull"),
    ("Rack Pull (Above Knee)", ["traps", "lower back"], ["glutes"], "pull"),
    ("Snatch-Grip Deadlift", ["hamstrings", "lower back"], ["traps"], "pull"),
    ("Sumo Pause Deadlift", ["glutes", "hamstrings"], ["lower back"], "pull"),
    ("Conventional Pause Deadlift", ["hamstrings", "lower back"], ["glutes"], "pull"),
    ("Touch-and-Go Deadlift", ["hamstrings", "lower back"], ["glutes"], "pull"),
    ("Banded Deadlift", ["hamstrings", "glutes"], ["lower back"], "pull"),
    ("Chain Deadlift", ["hamstrings", "glutes"], ["lower back"], "pull"),
    ("Banded Bench Press", ["chest", "triceps"], ["shoulders"], "push"),
    ("Chain Bench Press", ["chest", "triceps"], ["shoulders"], "push"),
    ("Banded Squat", ["quadriceps", "glutes"], ["hamstrings"], "push"),
    ("Chain Squat", ["quadriceps", "glutes"], ["hamstrings"], "push"),
    ("3-0-3 Tempo Squat", ["quadriceps", "glutes"], ["hamstrings"], "push"),
    ("3-1-1 Tempo Bench", ["chest", "triceps"], ["shoulders"], "push"),
    ("5-Second Eccentric Squat", ["quadriceps", "glutes"], ["hamstrings"], "push"),
    ("Isometric Mid-Thigh Pull", ["hamstrings", "traps"], ["glutes"], "pull"),
]:
    add(n, primary=p, secondary=s, force=f, level="intermediate")

# Strongman
for n, p, eq in [
    ("Farmer Carry", ["forearms", "traps"], "other"),
    ("Suitcase Carry", ["abdominals", "forearms"], "dumbbell"),
    ("Front Rack Carry", ["shoulders", "abdominals"], "kettlebells"),
    ("Overhead Carry", ["shoulders", "abdominals"], "other"),
    ("Yoke Walk", ["traps", "quadriceps"], "other"),
    ("Atlas Stone Load", ["glutes", "lower back"], "other"),
    ("Atlas Stone Over Bar", ["glutes", "lower back"], "other"),
    ("Log Press", ["shoulders", "triceps"], "other"),
    ("Log Clean", ["traps", "hamstrings"], "other"),
    ("Axle Deadlift", ["hamstrings", "forearms"], "other"),
    ("Axle Clean and Press", ["shoulders", "traps"], "other"),
    ("Tire Flip", ["glutes", "hamstrings"], "other"),
    ("Sled Push", ["quadriceps", "glutes"], "other"),
    ("Sled Pull (Backward)", ["hamstrings", "glutes"], "other"),
    ("Sled Drag (Forward)", ["quadriceps", "glutes"], "other"),
    ("Prowler Sprint", ["quadriceps", "glutes"], "other"),
    ("Sandbag Clean", ["traps", "glutes"], "other"),
    ("Sandbag Over Shoulder", ["glutes", "abdominals"], "other"),
    ("Sandbag Carry", ["abdominals", "traps"], "other"),
    ("Sandbag Squat", ["quadriceps", "glutes"], "other"),
    ("Sandbag Shoulder", ["traps", "glutes"], "other"),
    ("Keg Load", ["glutes", "lower back"], "other"),
    ("Keg Carry", ["abdominals", "forearms"], "other"),
    ("Husafell Carry", ["abdominals", "quadriceps"], "other"),
    ("Frame Carry", ["forearms", "traps"], "other"),
    ("Circus Dumbbell Press", ["shoulders", "triceps"], "dumbbell"),
    ("Viking Press", ["shoulders", "triceps"], "machine"),
    ("Duck Walk (Strongman)", ["quadriceps", "glutes"], "other"),
    ("Car Deadlift", ["hamstrings", "glutes"], "other"),
    ("Arm-Over-Arm Pull", ["lats", "biceps"], "other"),
    ("Truck Pull", ["quadriceps", "hamstrings"], "other"),
    ("Crucifix Hold", ["shoulders", "forearms"], "dumbbell"),
    ("Fingal Fingers", ["shoulders", "glutes"], "other"),
    ("Natural Stone Lift", ["glutes", "lower back"], "other"),
    ("Dinnie Lift", ["forearms", "hamstrings"], "other"),
]:
    add(n, primary=p, equipment=eq, force="static" if "Carry" in n or "Hold" in n else "pull", category="strongman", level="intermediate")

# Calisthenics / gymnastics
for n, p, eq, cat in [
    ("Muscle-Up (Bar)", ["lats", "chest"], "body only", "strength"),
    ("Muscle-Up (Rings)", ["lats", "chest"], "body only", "strength"),
    ("Ring Dip", ["chest", "triceps"], "body only", "strength"),
    ("Ring Push-Up", ["chest", "shoulders"], "body only", "strength"),
    ("Ring Row", ["lats", "biceps"], "body only", "strength"),
    ("Ring Support Hold", ["shoulders", "abdominals"], "body only", "strength"),
    ("Skin the Cat", ["shoulders", "lats"], "body only", "stretching"),
    ("German Hang", ["shoulders"], "body only", "stretching"),
    ("Front Lever", ["lats", "abdominals"], "body only", "strength"),
    ("Front Lever Raise", ["lats", "abdominals"], "body only", "strength"),
    ("Front Lever Tuck", ["lats", "abdominals"], "body only", "strength"),
    ("Back Lever", ["lats", "shoulders"], "body only", "strength"),
    ("Back Lever Tuck", ["lats", "shoulders"], "body only", "strength"),
    ("Planche", ["shoulders", "chest"], "body only", "strength"),
    ("Planche Lean", ["shoulders", "chest"], "body only", "strength"),
    ("Tuck Planche", ["shoulders", "abdominals"], "body only", "strength"),
    ("Handstand", ["shoulders", "abdominals"], "body only", "strength"),
    ("Handstand Hold (Wall)", ["shoulders", "abdominals"], "body only", "strength"),
    ("Handstand Push-Up (Wall)", ["shoulders", "triceps"], "body only", "strength"),
    ("Freestanding Handstand Push-Up", ["shoulders", "triceps"], "body only", "strength"),
    ("Pike Push-Up", ["shoulders", "triceps"], "body only", "strength"),
    ("Pseudo Planche Push-Up", ["shoulders", "chest"], "body only", "strength"),
    ("Archer Push-Up", ["chest", "shoulders"], "body only", "strength"),
    ("Typewriter Push-Up", ["chest", "shoulders"], "body only", "strength"),
    ("Hindu Push-Up", ["chest", "shoulders"], "body only", "strength"),
    ("Dive Bomber Push-Up", ["chest", "shoulders"], "body only", "strength"),
    ("Clapping Push-Up", ["chest", "triceps"], "body only", "plyometrics"),
    ("Explosive Push-Up", ["chest", "triceps"], "body only", "plyometrics"),
    ("One-Arm Push-Up", ["chest", "abdominals"], "body only", "strength"),
    ("One-Arm Pull-Up", ["lats", "biceps"], "body only", "strength"),
    ("Archer Pull-Up", ["lats", "biceps"], "body only", "strength"),
    ("Typewriter Pull-Up", ["lats", "biceps"], "body only", "strength"),
    ("L-Sit Pull-Up", ["lats", "abdominals"], "body only", "strength"),
    ("Chest-to-Bar Pull-Up", ["lats", "biceps"], "body only", "strength"),
    ("Kipping Pull-Up", ["lats", "abdominals"], "body only", "strength"),
    ("Butterfly Pull-Up", ["lats", "abdominals"], "body only", "strength"),
    ("Strict Pull-Up", ["lats", "biceps"], "body only", "strength"),
    ("Neutral-Grip Pull-Up", ["lats", "biceps"], "body only", "strength"),
    ("Commando Pull-Up", ["lats", "biceps"], "body only", "strength"),
    ("Mixed-Grip Pull-Up", ["lats", "biceps"], "body only", "strength"),
    ("Hanging Leg Raise (Strict)", ["abdominals"], "body only", "strength"),
    ("Toes-to-Bar", ["abdominals", "lats"], "body only", "strength"),
    ("Knees-to-Elbows", ["abdominals"], "body only", "strength"),
    ("Windshield Wipers", ["abdominals", "obliques"], "body only", "strength"),
    ("L-Sit", ["abdominals", "hip flexors"], "body only", "strength"),
    ("V-Sit", ["abdominals", "hip flexors"], "body only", "strength"),
    ("Man Maker", ["shoulders", "chest"], "dumbbell", "strength"),
    ("Human Flag", ["lats", "obliques"], "body only", "strength"),
    ("Pistol Squat", ["quadriceps", "glutes"], "body only", "strength"),
    ("Shrimp Squat", ["quadriceps", "glutes"], "body only", "strength"),
    ("Sissy Squat", ["quadriceps"], "body only", "strength"),
    ("Nordic Hamstring Curl", ["hamstrings"], "body only", "strength"),
    ("Reverse Nordic Curl", ["quadriceps"], "body only", "strength"),
    ("Glute Ham Raise", ["hamstrings", "glutes"], "machine", "strength"),
    ("Inverted Row (Rings)", ["lats", "biceps"], "body only", "strength"),
    ("Australian Pull-Up", ["lats", "biceps"], "body only", "strength"),
    ("Wall Walk", ["shoulders", "abdominals"], "body only", "strength"),
    ("Bear Crawl", ["shoulders", "abdominals"], "body only", "strength"),
    ("Crab Walk", ["triceps", "glutes"], "body only", "strength"),
    ("Duck Walk", ["quadriceps", "glutes"], "body only", "strength"),
    ("Inchworm", ["hamstrings", "shoulders"], "body only", "stretching"),
    ("Burpee (Standard)", ["quadriceps", "chest"], "body only", "plyometrics"),
    ("Burpee Pull-Up", ["lats", "quadriceps"], "body only", "plyometrics"),
    ("Devil Press", ["shoulders", "chest"], "dumbbell", "plyometrics"),
]:
    add(n, primary=p, equipment=eq, category=cat, force="pull" if "Pull" in n or "Row" in n or "Lever" in n else "push")

# Machines / cables extra
MACHINES = [
    ("Pendulum Squat", ["quadriceps", "glutes"], "machine", "push"),
    ("Hack Squat (Machine)", ["quadriceps", "glutes"], "machine", "push"),
    ("V-Squat", ["quadriceps", "glutes"], "machine", "push"),
    ("Belt Squat", ["quadriceps", "glutes"], "machine", "push"),
    ("Leg Press (45 Degree)", ["quadriceps", "glutes"], "machine", "push"),
    ("Horizontal Leg Press", ["quadriceps", "glutes"], "machine", "push"),
    ("Vertical Leg Press", ["quadriceps", "glutes"], "machine", "push"),
    ("Single-Leg Leg Press", ["quadriceps", "glutes"], "machine", "push"),
    ("Lying Leg Curl", ["hamstrings"], "machine", "pull"),
    ("Seated Leg Curl", ["hamstrings"], "machine", "pull"),
    ("Standing Leg Curl", ["hamstrings"], "machine", "pull"),
    ("Single-Leg Curl", ["hamstrings"], "machine", "pull"),
    ("Leg Extension", ["quadriceps"], "machine", "push"),
    ("Single-Leg Extension", ["quadriceps"], "machine", "push"),
    ("Hip Abduction Machine", ["abductors"], "machine", "push"),
    ("Hip Adduction Machine", ["adductors"], "machine", "push"),
    ("Glute Drive Machine", ["glutes"], "machine", "push"),
    ("Reverse Hyper", ["glutes", "hamstrings"], "machine", "pull"),
    ("Back Extension Machine", ["lower back", "glutes"], "machine", "pull"),
    ("Pec Deck", ["chest"], "machine", "push"),
    ("Chest Press Machine", ["chest", "triceps"], "machine", "push"),
    ("Incline Chest Press Machine", ["chest", "shoulders"], "machine", "push"),
    ("Decline Chest Press Machine", ["chest", "triceps"], "machine", "push"),
    ("Shoulder Press Machine", ["shoulders", "triceps"], "machine", "push"),
    ("Lateral Raise Machine", ["shoulders"], "machine", "push"),
    ("Rear Delt Machine", ["shoulders"], "machine", "pull"),
    ("Assisted Pull-Up", ["lats", "biceps"], "machine", "pull"),
    ("Assisted Dip", ["chest", "triceps"], "machine", "push"),
    ("Lat Pulldown (Wide)", ["lats", "biceps"], "cable", "pull"),
    ("Lat Pulldown (Close Neutral)", ["lats", "biceps"], "cable", "pull"),
    ("Lat Pulldown (Reverse Grip)", ["lats", "biceps"], "cable", "pull"),
    ("Single-Arm Lat Pulldown", ["lats", "biceps"], "cable", "pull"),
    ("Straight-Arm Pulldown", ["lats"], "cable", "pull"),
    ("Seated Cable Row (V-Bar)", ["lats", "middle back"], "cable", "pull"),
    ("Seated Cable Row (Wide)", ["lats", "middle back"], "cable", "pull"),
    ("Single-Arm Cable Row", ["lats", "biceps"], "cable", "pull"),
    ("Chest-Supported T-Bar Row", ["middle back", "lats"], "barbell", "pull"),
    ("Meadows Row", ["lats", "middle back"], "barbell", "pull"),
    ("Helms Row", ["lats", "middle back"], "dumbbell", "pull"),
    ("Seal Row", ["middle back", "lats"], "barbell", "pull"),
    ("Pendlay Row", ["middle back", "lats"], "barbell", "pull"),
    ("Yates Row", ["lats", "middle back"], "barbell", "pull"),
    ("Cable Crossover (High to Low)", ["chest"], "cable", "push"),
    ("Cable Crossover (Low to High)", ["chest", "shoulders"], "cable", "push"),
    ("Cable Crossover (Mid)", ["chest"], "cable", "push"),
    ("Cable Fly (Single-Arm)", ["chest"], "cable", "push"),
    ("Cable Lateral Raise", ["shoulders"], "cable", "push"),
    ("Cable Front Raise", ["shoulders"], "cable", "push"),
    ("Cable Rear Delt Fly", ["shoulders"], "cable", "pull"),
    ("Face Pull", ["shoulders", "traps"], "cable", "pull"),
    ("Cable External Rotation", ["shoulders"], "cable", "pull"),
    ("Cable Internal Rotation", ["shoulders"], "cable", "push"),
    ("Cable Curl", ["biceps"], "cable", "pull"),
    ("Bayesian Curl", ["biceps"], "cable", "pull"),
    ("Cable Hammer Curl", ["biceps", "forearms"], "cable", "pull"),
    ("Overhead Cable Curl", ["biceps"], "cable", "pull"),
    ("Cable Tricep Pushdown (V-Bar)", ["triceps"], "cable", "push"),
    ("Cable Tricep Pushdown (Rope)", ["triceps"], "cable", "push"),
    ("Overhead Cable Extension", ["triceps"], "cable", "push"),
    ("Cable Kickback", ["triceps"], "cable", "push"),
    ("Cable Crunch", ["abdominals"], "cable", "pull"),
    ("Pallof Press", ["abdominals", "obliques"], "cable", "static"),
    ("Pallof Press (Half-Kneeling)", ["obliques", "abdominals"], "cable", "static"),
    ("Cable Woodchop (High to Low)", ["obliques"], "cable", "pull"),
    ("Cable Woodchop (Low to High)", ["obliques"], "cable", "pull"),
    ("Cable Pull-Through", ["glutes", "hamstrings"], "cable", "pull"),
    ("Cable Hip Abduction", ["abductors"], "cable", "push"),
    ("Cable Kickback (Glute)", ["glutes"], "cable", "push"),
    ("Smith Machine Squat", ["quadriceps", "glutes"], "machine", "push"),
    ("Smith Machine Reverse Lunge", ["quadriceps", "glutes"], "machine", "push"),
    ("Smith Machine Bench Press", ["chest", "triceps"], "machine", "push"),
    ("Smith Machine Incline Press", ["chest", "shoulders"], "machine", "push"),
    ("Smith Machine Row", ["lats", "middle back"], "machine", "pull"),
    ("Smith Machine Calf Raise", ["calves"], "machine", "push"),
    ("Smith Machine Shrug", ["traps"], "machine", "pull"),
    ("Smith Machine Split Squat", ["quadriceps", "glutes"], "machine", "push"),
    ("Standing Calf Raise Machine", ["calves"], "machine", "push"),
    ("Seated Calf Raise Machine", ["calves"], "machine", "push"),
    ("Donkey Calf Raise", ["calves"], "machine", "push"),
    ("Tibia Raise", ["calves"], "other", "pull"),
    ("Neck Flexion (Harness)", ["neck"], "other", "pull"),
    ("Neck Extension (Harness)", ["neck"], "other", "push"),
    ("Plate Pinch Hold", ["forearms"], "other", "static"),
    ("Wrist Roller", ["forearms"], "other", "pull"),
    ("Gripper Close", ["forearms"], "other", "static"),
    ("Dead Hang", ["forearms", "lats"], "body only", "static"),
    ("Active Hang", ["lats", "shoulders"], "body only", "static"),
]
for n, p, eq, f in MACHINES:
    add(n, primary=p, equipment=eq, force=f)

# Kettlebell sport / extra
for n, p in [
    ("Kettlebell Snatch", ["shoulders", "glutes"]),
    ("Kettlebell Clean", ["traps", "glutes"]),
    ("Kettlebell Jerk", ["shoulders", "quadriceps"]),
    ("Kettlebell Push Press", ["shoulders", "quadriceps"]),
    ("Kettlebell Long Cycle", ["shoulders", "glutes"]),
    ("Kettlebell Goblet Squat", ["quadriceps", "glutes"]),
    ("Kettlebell Front Squat", ["quadriceps", "abdominals"]),
    ("Kettlebell Swing (Hardstyle)", ["glutes", "hamstrings"]),
    ("Kettlebell Swing (Sport)", ["glutes", "hamstrings"]),
    ("Double Kettlebell Swing", ["glutes", "hamstrings"]),
    ("Kettlebell Deadlift", ["hamstrings", "glutes"]),
    ("Kettlebell Windmill", ["obliques", "shoulders"]),
    ("Kettlebell Turkish Get-Up", ["shoulders", "abdominals"]),
    ("Kettlebell Halo", ["shoulders", "abdominals"]),
    ("Kettlebell Bottoms-Up Press", ["shoulders", "forearms"]),
    ("Kettlebell Bottoms-Up Carry", ["forearms", "shoulders"]),
    ("Kettlebell Rack Carry", ["abdominals", "shoulders"]),
    ("Kettlebell Overhead Squat", ["quadriceps", "shoulders"]),
    ("Kettlebell Cossack Squat", ["quadriceps", "adductors"]),
    ("Kettlebell Single-Leg RDL", ["hamstrings", "glutes"]),
    ("Kettlebell Row", ["lats", "biceps"]),
    ("Kettlebell High Pull", ["shoulders", "traps"]),
    ("Kettlebell Figure-8", ["abdominals", "shoulders"]),
    ("Kettlebell Sots Press", ["shoulders", "quadriceps"]),
    ("Kettlebell Thruster", ["quadriceps", "shoulders"]),
    ("Double Kettlebell Thruster", ["quadriceps", "shoulders"]),
    ("Kettlebell Clean and Press", ["shoulders", "glutes"]),
    ("Kettlebell See-Saw Press", ["shoulders", "triceps"]),
    ("Kettlebell Renegade Row", ["lats", "abdominals"]),
    ("Kettlebell Pullover", ["lats", "chest"]),
]:
    add(n, primary=p, equipment="kettlebells", force="pull" if "Row" in n or "Dead" in n or "Swing" in n or "RDL" in n else "push")

# Mobility / stretching extras
MOB = [
    ("90/90 Hip Switch", ["abductors", "adductors"], "stretching"),
    ("Couch Stretch", ["quadriceps", "hip flexors"], "stretching"),
    ("Pigeon Stretch", ["glutes", "abductors"], "stretching"),
    ("Frog Stretch", ["adductors"], "stretching"),
    ("World's Greatest Stretch", ["hip flexors", "hamstrings"], "stretching"),
    ("Cat-Cow", ["lower back", "abdominals"], "stretching"),
    ("Thoracic Rotation (Open Book)", ["shoulders", "middle back"], "stretching"),
    ("Thread the Needle", ["shoulders", "middle back"], "stretching"),
    ("Scorpion Stretch", ["hip flexors", "abdominals"], "stretching"),
    ("Quadruped Rock Back", ["hips", "lower back"], "stretching"),
    ("Deep Squat Hold (Prying)", ["adductors", "quadriceps"], "stretching"),
    ("Jefferson Curl", ["hamstrings", "lower back"], "stretching"),
    ("Standing Pike Stretch", ["hamstrings"], "stretching"),
    ("Seated Straddle Stretch", ["adductors", "hamstrings"], "stretching"),
    ("Wall Slides", ["shoulders", "middle back"], "stretching"),
    ("Prone Cobra", ["lower back", "shoulders"], "stretching"),
    ("Dead Bug", ["abdominals"], "strength"),
    ("Bird Dog", ["abdominals", "lower back"], "strength"),
    ("McGill Curl-Up", ["abdominals"], "strength"),
    ("Side Plank (McGill)", ["obliques"], "strength"),
    ("Copenhagen Plank", ["adductors", "obliques"], "strength"),
    ("Hollow Body Hold", ["abdominals"], "strength"),
    ("Hollow Body Rock", ["abdominals"], "strength"),
    ("Arch Hold (Superman)", ["lower back", "glutes"], "strength"),
    ("Wall Hip Flexor Stretch", ["hip flexors"], "stretching"),
    ("Ankle Dorsiflexion Rock", ["calves"], "stretching"),
    ("T-Spine Extension on Foam Roller", ["middle back"], "stretching"),
    ("Lat Stretch on Rack", ["lats"], "stretching"),
    ("Pec Stretch in Doorway", ["chest"], "stretching"),
    ("Banded Distraction (Hip)", ["hips"], "stretching"),
    ("Banded Distraction (Ankle)", ["calves"], "stretching"),
    ("Shoulder Dislocate (Band)", ["shoulders"], "stretching"),
    ("Pass-Through (PVC)", ["shoulders"], "stretching"),
    ("Sleeper Stretch", ["shoulders"], "stretching"),
    ("Cross-Body Shoulder Stretch", ["shoulders"], "stretching"),
]
for n, p, cat in MOB:
    add(n, primary=p, equipment="body only", force="static", category=cat, mechanic="isolation", level="beginner")

# Plyometrics / conditioning
PLY = [
    ("Box Jump", ["quadriceps", "glutes"], "plyometrics"),
    ("Depth Jump", ["quadriceps", "glutes"], "plyometrics"),
    ("Broad Jump", ["glutes", "quadriceps"], "plyometrics"),
    ("Single-Leg Box Jump", ["quadriceps", "glutes"], "plyometrics"),
    ("Lateral Bound", ["glutes", "abductors"], "plyometrics"),
    ("Skater Jump", ["glutes", "abductors"], "plyometrics"),
    ("Tuck Jump", ["quadriceps", "abdominals"], "plyometrics"),
    ("Split Jump", ["quadriceps", "glutes"], "plyometrics"),
    ("Jump Squat", ["quadriceps", "glutes"], "plyometrics"),
    ("Jump Lunge", ["quadriceps", "glutes"], "plyometrics"),
    ("Hurdle Hop", ["quadriceps", "calves"], "plyometrics"),
    ("Pogo Jump", ["calves", "quadriceps"], "plyometrics"),
    ("Ankle Hop", ["calves"], "plyometrics"),
    ("Medicine Ball Rotational Throw", ["obliques", "shoulders"], "strength"),
    ("Medicine Ball Chest Pass", ["chest", "shoulders"], "plyometrics"),
    ("Medicine Ball Slam", ["abdominals", "shoulders"], "plyometrics"),
    ("Medicine Ball Overhead Throw", ["shoulders", "abdominals"], "plyometrics"),
    ("Battle Rope Waves", ["shoulders", "abdominals"], "strength"),
    ("Battle Rope Slams", ["shoulders", "abdominals"], "plyometrics"),
    ("Assault Bike Sprint", ["quadriceps", "hamstrings"], "cardio"),
    ("Rowing Erg Sprint", ["lats", "quadriceps"], "cardio"),
    ("Ski Erg Sprint", ["lats", "abdominals"], "cardio"),
    ("Echo Bike Sprint", ["quadriceps", "shoulders"], "cardio"),
    ("Air Bike Intervals", ["quadriceps", "shoulders"], "cardio"),
    ("Jump Rope (Single Unders)", ["calves"], "cardio"),
    ("Jump Rope (Double Unders)", ["calves", "shoulders"], "cardio"),
    ("Hill Sprint", ["quadriceps", "glutes"], "cardio"),
    ("Sled Sprint", ["quadriceps", "glutes"], "cardio"),
    ("Farmer Carry Sprint", ["forearms", "quadriceps"], "cardio"),
    ("Shuttle Run", ["quadriceps", "hamstrings"], "cardio"),
]
for n, p, cat in PLY:
    add(n, primary=p, equipment="body only" if "Ball" not in n and "Rope" not in n and "Sled" not in n and "Farmer" not in n else "other", force="push", category=cat, mechanic="compound")

# Dumbbell / isolation extras
DB = [
    ("Dumbbell Bench Press (Neutral Grip)", ["chest", "triceps"], "push"),
    ("Dumbbell Floor Press", ["chest", "triceps"], "push"),
    ("Dumbbell Pause Bench", ["chest", "triceps"], "push"),
    ("Dumbbell Squeeze Press", ["chest", "triceps"], "push"),
    ("Dumbbell Pullover (Chest)", ["chest", "lats"], "pull"),
    ("Dumbbell Pullover (Lat)", ["lats", "chest"], "pull"),
    ("Dumbbell Seal Row", ["middle back", "lats"], "pull"),
    ("Chest-Supported Dumbbell Row", ["lats", "middle back"], "pull"),
    ("Dumbbell Gorilla Row", ["lats", "biceps"], "pull"),
    ("Dumbbell Kroc Row", ["lats", "biceps"], "pull"),
    ("Dumbbell Incline Row", ["lats", "rear delts"], "pull"),
    ("Dumbbell Z-Press", ["shoulders", "triceps"], "push"),
    ("Dumbbell Arnold Press", ["shoulders", "triceps"], "push"),
    ("Dumbbell Push Press", ["shoulders", "quadriceps"], "push"),
    ("Dumbbell See-Saw Press", ["shoulders", "triceps"], "push"),
    ("Dumbbell Cuban Press", ["shoulders", "traps"], "push"),
    ("Dumbbell Y Raise", ["shoulders"], "push"),
    ("Dumbbell T Raise", ["shoulders"], "pull"),
    ("Dumbbell W Raise", ["shoulders"], "pull"),
    ("Dumbbell Upright Row (Wide)", ["shoulders", "traps"], "pull"),
    ("Dumbbell Spider Curl", ["biceps"], "pull"),
    ("Dumbbell Preacher Curl", ["biceps"], "pull"),
    ("Dumbbell Incline Curl", ["biceps"], "pull"),
    ("Dumbbell Drag Curl", ["biceps"], "pull"),
    ("Dumbbell Waiter Curl", ["biceps"], "pull"),
    ("Dumbbell Cross-Body Hammer Curl", ["biceps", "forearms"], "pull"),
    ("Dumbbell Skull Crusher", ["triceps"], "push"),
    ("Dumbbell Tate Press", ["triceps"], "push"),
    ("Dumbbell JM Press", ["triceps", "chest"], "push"),
    ("Dumbbell Kickback", ["triceps"], "push"),
    ("Dumbbell Overhead Extension", ["triceps"], "push"),
    ("Dumbbell Walking Lunge", ["quadriceps", "glutes"], "push"),
    ("Dumbbell Reverse Lunge", ["quadriceps", "glutes"], "push"),
    ("Dumbbell Lateral Lunge", ["quadriceps", "adductors"], "push"),
    ("Dumbbell Bulgarian Split Squat", ["quadriceps", "glutes"], "push"),
    ("Dumbbell Step-Up", ["quadriceps", "glutes"], "push"),
    ("Dumbbell Deficit Reverse Lunge", ["quadriceps", "glutes"], "push"),
    ("Dumbbell Front Squat", ["quadriceps", "abdominals"], "push"),
    ("Dumbbell Goblet Box Squat", ["quadriceps", "glutes"], "push"),
    ("Dumbbell RDL", ["hamstrings", "glutes"], "pull"),
    ("Dumbbell Stiff-Leg Deadlift", ["hamstrings", "glutes"], "pull"),
    ("Dumbbell Suitcase Deadlift", ["hamstrings", "obliques"], "pull"),
    ("Dumbbell Hip Thrust", ["glutes", "hamstrings"], "push"),
    ("Dumbbell Frog Pump", ["glutes"], "push"),
    ("Dumbbell Calf Raise", ["calves"], "push"),
    ("Dumbbell Seated Calf Raise", ["calves"], "push"),
    ("Dumbbell Side Bend", ["obliques"], "pull"),
    ("Dumbbell Sit-Up", ["abdominals"], "pull"),
    ("Dumbbell Russian Twist", ["obliques"], "pull"),
    ("Dumbbell Pullover Crunch", ["abdominals", "lats"], "pull"),
]
for n, p, f in DB:
    add(n, primary=p, equipment="dumbbell", force=f, mechanic="isolation" if any(x in n for x in ["Curl", "Raise", "Extension", "Kickback", "Calf", "Bend"]) else "compound")

# Barbell extras not likely in original
BB = [
    ("Barbell Front Rack Reverse Lunge", ["quadriceps", "glutes"], "push"),
    ("Barbell Walking Lunge", ["quadriceps", "glutes"], "push"),
    ("Barbell Lateral Lunge", ["adductors", "quadriceps"], "push"),
    ("Barbell Step-Up", ["quadriceps", "glutes"], "push"),
    ("Barbell Hip Thrust", ["glutes", "hamstrings"], "push"),
    ("Barbell Glute Bridge", ["glutes", "hamstrings"], "push"),
    ("Barbell Good Morning", ["hamstrings", "lower back"], "pull"),
    ("Seated Good Morning", ["lower back", "hamstrings"], "pull"),
    ("Barbell JM Press", ["triceps", "chest"], "push"),
    ("Barbell Skull Crusher", ["triceps"], "push"),
    ("Barbell Close-Grip Bench", ["triceps", "chest"], "push"),
    ("Barbell Spoto Press", ["chest", "triceps"], "push"),
    ("Barbell Floor Press", ["chest", "triceps"], "push"),
    ("Barbell Z-Press", ["shoulders", "triceps"], "push"),
    ("Barbell Push Press", ["shoulders", "quadriceps"], "push"),
    ("Landmine Press", ["shoulders", "chest"], "push"),
    ("Landmine Squat", ["quadriceps", "glutes"], "push"),
    ("Landmine Row", ["lats", "middle back"], "pull"),
    ("Landmine Rotation", ["obliques", "shoulders"], "pull"),
    ("Landmine Reverse Lunge", ["quadriceps", "glutes"], "push"),
    ("Landmine Single-Arm Press", ["shoulders", "triceps"], "push"),
    ("Barbell Shrug (Behind Back)", ["traps"], "pull"),
    ("Barbell Overhead Shrug", ["traps", "shoulders"], "pull"),
    ("Barbell Wrist Curl", ["forearms"], "pull"),
    ("Barbell Reverse Wrist Curl", ["forearms"], "pull"),
    ("Zercher Squat", ["quadriceps", "upper back"], "push"),
    ("Zercher Carry", ["upper back", "abdominals"], "static"),
    ("Zercher Good Morning", ["hamstrings", "upper back"], "pull"),
    ("Jefferson Deadlift", ["hamstrings", "glutes"], "pull"),
    ("Hack Lift (Barbell)", ["quadriceps", "glutes"], "push"),
    ("Barbell Ab Rollout", ["abdominals"], "pull"),
    ("Barbell Pause Front Squat", ["quadriceps", "abdominals"], "push"),
    ("Barbell Heels-Elevated Squat", ["quadriceps"], "push"),
    ("Low-Bar Back Squat", ["glutes", "hamstrings"], "push"),
    ("High-Bar Back Squat", ["quadriceps", "glutes"], "push"),
    ("Barbell Split Squat", ["quadriceps", "glutes"], "push"),
    ("Barbell Anderson Press", ["shoulders", "triceps"], "push"),
]
for n, p, f in BB:
    add(n, primary=p, equipment="barbell", force=f)

# Bands
for n, p, f in [
    ("Band Pull-Apart", ["shoulders", "traps"], "pull"),
    ("Band Face Pull", ["shoulders", "traps"], "pull"),
    ("Band Dislocate", ["shoulders"], "pull"),
    ("Banded Glute Bridge", ["glutes"], "push"),
    ("Banded Clamshell", ["abductors", "glutes"], "push"),
    ("Banded Lateral Walk", ["abductors", "glutes"], "push"),
    ("Banded Monster Walk", ["abductors", "glutes"], "push"),
    ("Banded Good Morning", ["hamstrings", "glutes"], "pull"),
    ("Banded Push-Up", ["chest", "triceps"], "push"),
    ("Banded Row", ["lats", "biceps"], "pull"),
    ("Banded Lat Pulldown", ["lats", "biceps"], "pull"),
    ("Banded Overhead Press", ["shoulders", "triceps"], "push"),
    ("Banded Tricep Pushdown", ["triceps"], "push"),
    ("Banded Bicep Curl", ["biceps"], "pull"),
    ("Banded Pallof Press", ["obliques"], "static"),
    ("Banded Dead Bug", ["abdominals"], "static"),
    ("Banded Hip Thrust", ["glutes"], "push"),
    ("Banded Squat", ["quadriceps", "glutes"], "push"),
    ("Banded RDL", ["hamstrings", "glutes"], "pull"),
    ("Banded Hamstring Curl", ["hamstrings"], "pull"),
    ("Banded Leg Extension", ["quadriceps"], "push"),
    ("Banded Chest Fly", ["chest"], "push"),
    ("Banded Reverse Fly", ["shoulders"], "pull"),
    ("Banded Shoulder External Rotation", ["shoulders"], "pull"),
    ("Banded Ankle Dorsiflexion", ["calves"], "pull"),
]:
    add(n, primary=p, equipment="bands", force=f, mechanic="isolation", level="beginner")

# Unilateral / specialty
UNI = [
    ("Single-Leg Hip Thrust", ["glutes"], "body only", "push"),
    ("Single-Leg Glute Bridge", ["glutes"], "body only", "push"),
    ("Single-Leg Calf Raise", ["calves"], "body only", "push"),
    ("Single-Leg Box Squat", ["quadriceps", "glutes"], "body only", "push"),
    ("Single-Arm Farmer Carry", ["obliques", "forearms"], "dumbbell", "static"),
    ("Single-Arm Overhead Press", ["shoulders", "triceps"], "dumbbell", "push"),
    ("Single-Arm Landmine Press", ["shoulders", "chest"], "barbell", "push"),
    ("Single-Arm Cable Chest Fly", ["chest"], "cable", "push"),
    ("Single-Arm Cable Lateral Raise", ["shoulders"], "cable", "push"),
    ("Single-Arm Dumbbell Snatch", ["shoulders", "glutes"], "dumbbell", "pull"),
    ("Single-Arm Dumbbell Clean", ["traps", "glutes"], "dumbbell", "pull"),
    ("Single-Arm Dumbbell Swing", ["glutes", "hamstrings"], "dumbbell", "pull"),
    ("B-Stance RDL", ["hamstrings", "glutes"], "dumbbell", "pull"),
    ("B-Stance Hip Thrust", ["glutes"], "barbell", "push"),
    ("B-Stance Squat", ["quadriceps", "glutes"], "dumbbell", "push"),
    ("Kickstand RDL", ["hamstrings", "glutes"], "dumbbell", "pull"),
    ("Rear-Foot Elevated Split Squat", ["quadriceps", "glutes"], "dumbbell", "push"),
    ("Front-Foot Elevated Reverse Lunge", ["quadriceps", "glutes"], "dumbbell", "push"),
    ("Cossack Squat", ["adductors", "quadriceps"], "body only", "push"),
    ("Lateral Step-Down", ["quadriceps", "glutes"], "body only", "push"),
    ("Spanish Squat", ["quadriceps"], "bands", "push"),
    ("Wall Sit", ["quadriceps"], "body only", "static"),
    ("Isometric Split Squat", ["quadriceps", "glutes"], "body only", "static"),
    ("Isometric Push-Up Hold", ["chest", "abdominals"], "body only", "static"),
    ("Isometric Pull-Up Hold", ["lats", "biceps"], "body only", "static"),
    ("Isometric Mid-Range Curl", ["biceps"], "dumbbell", "static"),
]
for n, p, eq, f in UNI:
    add(n, primary=p, equipment=eq, force=f)


def variation_allowed(ex: dict, prefix: str) -> bool:
    name = ex["name"].lower()
    eq = (ex.get("equipment") or "").lower()
    mech = (ex.get("mechanic") or "")
    if prefix in name:
        return False
    if prefix == "Pause" and mech == "compound" and eq in {"barbell", "dumbbell", "machine"}:
        return "stretch" not in name and "cardio" not in (ex.get("category") or "")
    if prefix == "Deficit" and any(k in name for k in ["deadlift", "push-up", "push up", "row", "lunge", "rdl"]):
        return True
    if prefix == "Tempo" and mech in {"compound", "isolation"} and eq not in {"body only"}:
        return ex.get("category") in {"strength", None, "powerlifting"}
    if prefix == "Single-Arm" and eq in {"dumbbell", "cable", "kettlebells"} and "single" not in name and mech == "compound":
        return True
    if prefix == "Single-Leg" and any(k in name for k in ["squat", "rdl", "deadlift", "hip thrust", "calf", "leg press", "leg curl"]):
        return "single" not in name and "pistol" not in name
    if prefix == "Seated" and eq in {"dumbbell", "cable", "machine"} and any(k in name for k in ["press", "row", "curl", "raise"]):
        return "seated" not in name
    if prefix == "Standing" and eq in {"cable", "dumbbell"} and any(k in name for k in ["curl", "press", "fly", "raise"]):
        return "standing" not in name
    if prefix == "Close-Grip" and any(k in name for k in ["bench", "push-up", "lat pulldown", "row"]):
        return "close" not in name
    if prefix == "Wide-Grip" and any(k in name for k in ["bench", "pulldown", "row", "pull-up"]):
        return "wide" not in name
    return False


def main() -> None:
    raw = json.loads(SRC.read_text())
    catalog = [normalize(x) for x in raw]
    seen = {e["id"].lower() for e in catalog}
    seen_names = {e["name"].lower() for e in catalog}

    def absorb(items: list[dict]) -> None:
        for e in items:
            key = e["id"].lower()
            nm = e["name"].lower()
            if key in seen or nm in seen_names:
                continue
            seen.add(key)
            seen_names.add(nm)
            catalog.append(e)

    absorb(EXTRAS)

    variations: list[dict] = []
    for ex in list(catalog):
        for prefix in [
            "Pause",
            "Deficit",
            "Tempo",
            "Single-Arm",
            "Single-Leg",
            "Seated",
            "Standing",
            "Close-Grip",
            "Wide-Grip",
        ]:
            if not variation_allowed(ex, prefix):
                continue
            name = f"{prefix} {ex['name']}"
            if name.lower() in seen_names:
                continue
            variations.append(
                {
                    **ex,
                    "id": slug(name),
                    "name": name,
                    "imageUrl": None,
                    "source": "forge-variation",
                    "instructions": [
                        f"Perform {ex['name']} with a {prefix.lower()} emphasis.",
                        *(ex.get("instructions") or [])[:2],
                    ],
                }
            )
    absorb(variations)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(catalog, ensure_ascii=False))
    by_src: dict[str, int] = {}
    for e in catalog:
        by_src[e["source"]] = by_src.get(e["source"], 0) + 1
    print(json.dumps({"count": len(catalog), "bySource": by_src}))


if __name__ == "__main__":
    main()
