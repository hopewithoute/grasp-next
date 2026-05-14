import type { ExtractedConceptGraphDto } from "@grasp/domain";

const sentencePattern = /[^.!?\n]+[.!?]?/g;

export function extractConceptsDeterministically(
  sourceMaterial: string
): ExtractedConceptGraphDto {
  const sentences = sourceMaterial
    .match(sentencePattern)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean);

  const excerpts = sentences?.length ? sentences : [sourceMaterial.trim()];
  const selectedExcerpts = excerpts.slice(0, 5);

  const concepts = selectedExcerpts.map((excerpt, index) => {
    const name = buildConceptName(excerpt, index);

    return {
      confidence: 0.5,
      definition: excerpt,
      difficulty: inferDifficulty(excerpt),
      name,
      sourceEvidence: [
        {
          excerpt,
          location: `excerpt ${index + 1}`,
        },
      ],
    };
  });

  return {
    concepts,
    relationships: concepts.slice(1).map((concept, index) => ({
      relationshipType: "prerequisite",
      sourceConceptName: concepts[index].name,
      targetConceptName: concept.name,
    })),
  };
}

function buildConceptName(excerpt: string, index: number) {
  const words = excerpt
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 4);

  if (!words.length) {
    return `Concept ${index + 1}`;
  }

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function inferDifficulty(
  excerpt: string
): ExtractedConceptGraphDto["concepts"][number]["difficulty"] {
  if (excerpt.length > 220) {
    return "advanced";
  }

  if (excerpt.length > 120) {
    return "intermediate";
  }

  return "beginner";
}
