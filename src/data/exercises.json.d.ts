declare module "@/data/exercises.json" {
  const value: Array<{
    id: string;
    name: string;
    force: string | null;
    level: string;
    mechanic: string | null;
    equipment: string | null;
    primaryMuscles: string[];
    secondaryMuscles: string[];
    instructions: string[];
    category: string | null;
    imageUrl: string | null;
    source: string;
  }>;
  export default value;
}
