import { SrcFormField } from "@/types";

export interface FormSectionGroup {
  id: string;
  sectionIndex: number;
  title: string;
  description?: string;
  afterSection?: "next" | "submit" | string;
  fields: SrcFormField[];
}

/**
 * Partitions flat form fields into Google Forms–style sections.
 * If no section dividers exist, returns 1 default section holding all fields.
 */
export function getFormSectionGroups(fields: SrcFormField[] = []): FormSectionGroup[] {
  const sections: FormSectionGroup[] = [];
  let currentSection: FormSectionGroup = {
    id: "section-1",
    sectionIndex: 1,
    title: "Section 1",
    description: "",
    afterSection: "next",
    fields: [],
  };

  let hasExplicitSections = false;

  fields.forEach((field) => {
    if (field.type === "section") {
      hasExplicitSections = true;
      // If the first section was empty and had no questions, adopt this section divider as Section 1
      if (sections.length === 0 && currentSection.fields.length === 0) {
        currentSection = {
          id: field.id,
          sectionIndex: 1,
          title: field.question?.trim() || "Section 1",
          description: field.description || "",
          afterSection: field.afterSection || "next",
          fields: [],
        };
      } else {
        sections.push(currentSection);
        currentSection = {
          id: field.id,
          sectionIndex: sections.length + 1,
          title: field.question?.trim() || `Section ${sections.length + 1}`,
          description: field.description || "",
          afterSection: field.afterSection || "next",
          fields: [],
        };
      }
    } else {
      currentSection.fields.push(field);
    }
  });

  sections.push(currentSection);

  // If there are no explicit sections added, provide a friendly default title if empty
  if (!hasExplicitSections && sections.length === 1) {
    sections[0].title = sections[0].title || "General Details";
  }

  // Ensure 1-based indexing & proper fallback titles
  return sections.map((sec, idx) => ({
    ...sec,
    sectionIndex: idx + 1,
    title: sec.title?.trim() || `Section ${idx + 1}`,
  }));
}

/**
 * Computes the next destination section ID or 'submit' based on:
 * 1. Question-level 'Go to section based on answer' branching
 * 2. Section-level 'afterSection' routing rules
 */
export function getNextSectionTarget(
  currentSection: FormSectionGroup,
  allSections: FormSectionGroup[],
  answers: Record<string, any>
): string | "submit" {
  const currentIdx = allSections.findIndex((s) => s.id === currentSection.id);
  const nextSequentialId =
    currentIdx !== -1 && currentIdx < allSections.length - 1
      ? allSections[currentIdx + 1].id
      : "submit";

  // 1. Check for option-level branching rule on answered multiple-choice or dropdown questions
  for (const field of currentSection.fields) {
    if (field.goToSection && (field.type === "multiple_choice" || field.type === "dropdown")) {
      const selectedVal = answers[field.id];
      if (selectedVal && typeof selectedVal === "string") {
        const target = field.goToSection[selectedVal];
        if (target) {
          if (target === "submit") return "submit";
          if (target === "next") return nextSequentialId;
          // Verify target section exists
          const exists = allSections.some((s) => s.id === target);
          if (exists) return target;
        }
      }
    }
  }

  // 2. Fall back to section-level afterSection rule
  const rule = currentSection.afterSection || "next";
  if (rule === "submit") return "submit";
  if (rule === "next") return nextSequentialId;

  // Specific section ID
  const targetExists = allSections.some((s) => s.id === rule);
  if (targetExists) return rule;

  return nextSequentialId;
}

/**
 * Determines which sections have answers recorded for response presentation.
 */
export function analyzeSectionResponses(
  sections: FormSectionGroup[],
  answers: Record<string, any> = {}
) {
  return sections.map((sec) => {
    let answeredCount = 0;
    const nonNoteFields = sec.fields.filter((f) => f.type !== "note");

    nonNoteFields.forEach((f) => {
      const val = answers[f.id];
      if (val !== undefined && val !== null && val !== "") {
        if (Array.isArray(val) && val.length === 0) return;
        answeredCount++;
      }
    });

    return {
      section: sec,
      answeredCount,
      totalCount: nonNoteFields.length,
      isAnswered: answeredCount > 0,
      isCompletelySkipped: answeredCount === 0 && nonNoteFields.length > 0,
    };
  });
}

/**
 * Normalizes WhatsApp group links or phone links into valid clickable URLs.
 */
export function formatWhatsAppUrl(rawUrl?: string): string {
  if (!rawUrl || !rawUrl.trim()) return "";
  const clean = rawUrl.trim();

  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean;
  }

  if (clean.includes("chat.whatsapp.com")) {
    return `https://${clean}`;
  }

  // If pure phone number, route to wa.me
  const digits = clean.replace(/\D/g, "");
  if (digits.length >= 10) {
    const international = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${international}`;
  }

  return clean.startsWith("chat.whatsapp.com") ? `https://${clean}` : clean;
}
