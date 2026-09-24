import { SrcFormField } from "@/types";

export interface FormSectionGroup {
  id: string;
  sectionIndex: number;
  title: string;
  description?: string;
  afterSection?: "next" | "submit" | string;
  fields: SrcFormField[];
}

export interface SectionValidationIssue {
  type: "orphaned_ref" | "circular" | "unreachable" | "self_loop";
  message: string;
  fieldId?: string;
  sectionId?: string;
}

/**
 * Partitions flat form fields into Google Forms–style sections.
 * If no section dividers exist, returns 1 default section holding all fields.
 * whatsapp_link fields are treated as regular fields (non-branching).
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
 * 1. Question-level 'Go to section based on answer' branching (multiple_choice, dropdown, checkboxes)
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

  // 1. Check for option-level branching rule on answered multiple-choice, dropdown, or checkboxes
  for (const field of currentSection.fields) {
    if (
      field.goToSection &&
      (field.type === "multiple_choice" ||
        field.type === "dropdown" ||
        field.type === "checkboxes")
    ) {
      const selectedVal = answers[field.id];

      if (selectedVal && typeof selectedVal === "string") {
        // Single value (multiple_choice or dropdown)
        const target = field.goToSection[selectedVal];
        if (target) {
          if (target === "submit") return "submit";
          if (target === "next") return nextSequentialId;
          const exists = allSections.some((s) => s.id === target);
          if (exists) return target;
        }
      } else if (Array.isArray(selectedVal) && selectedVal.length > 0) {
        // Checkboxes — use the first selected option's routing rule
        for (const val of selectedVal) {
          const target = field.goToSection[val];
          if (target) {
            if (target === "submit") return "submit";
            if (target === "next") return nextSequentialId;
            const exists = allSections.some((s) => s.id === target);
            if (exists) return target;
          }
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
 * Simulates a respondent's path through sections given a complete answers map.
 * Returns the ordered list of section IDs the respondent would visit.
 * Stops at "submit" or if a cycle is detected (max 50 hops).
 */
export function getVisitedSectionPath(
  allSections: FormSectionGroup[],
  answers: Record<string, any>
): string[] {
  if (allSections.length === 0) return [];

  const visited: string[] = [];
  const seen = new Set<string>();
  let currentId = allSections[0].id;

  let hops = 0;
  while (hops < 50) {
    hops++;
    if (seen.has(currentId)) break; // Cycle guard
    seen.add(currentId);

    const section = allSections.find((s) => s.id === currentId);
    if (!section) break;
    visited.push(currentId);

    const next = getNextSectionTarget(section, allSections, answers);
    if (next === "submit") break;
    currentId = next;
  }

  return visited;
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
    // Exclude non-interactive fields (note, section, whatsapp_link)
    const answerableFields = sec.fields.filter(
      (f) => f.type !== "note" && f.type !== "whatsapp_link"
    );

    answerableFields.forEach((f) => {
      const val = answers[f.id];
      if (val !== undefined && val !== null && val !== "") {
        if (Array.isArray(val) && val.length === 0) return;
        answeredCount++;
      }
    });

    return {
      section: sec,
      answeredCount,
      totalCount: answerableFields.length,
      isAnswered: answeredCount > 0,
      isCompletelySkipped: answeredCount === 0 && answerableFields.length > 0,
    };
  });
}

/**
 * Validates the section routing graph for common issues.
 * Returns a list of issues the form builder can surface to the creator.
 */
export function validateSectionGraph(
  fields: SrcFormField[]
): SectionValidationIssue[] {
  const sections = getFormSectionGroups(fields);
  const issues: SectionValidationIssue[] = [];
  const sectionIds = new Set(sections.map((s) => s.id));

  for (const section of sections) {
    // Check section-level afterSection refs
    const rule = section.afterSection;
    if (rule && rule !== "next" && rule !== "submit") {
      if (!sectionIds.has(rule)) {
        issues.push({
          type: "orphaned_ref",
          message: `Section "${section.title}" routes to a deleted or missing section.`,
          sectionId: section.id,
        });
      }
      if (rule === section.id) {
        issues.push({
          type: "self_loop",
          message: `Section "${section.title}" routes to itself.`,
          sectionId: section.id,
        });
      }
    }

    // Check field-level goToSection refs
    for (const field of section.fields) {
      if (!field.goToSection) continue;
      for (const [opt, target] of Object.entries(field.goToSection)) {
        if (target && target !== "next" && target !== "submit") {
          if (!sectionIds.has(target)) {
            issues.push({
              type: "orphaned_ref",
              message: `Option "${opt}" in question "${field.question || field.id}" routes to a deleted section.`,
              fieldId: field.id,
              sectionId: section.id,
            });
          }
        }
      }
    }
  }

  // Detect unreachable sections (sections that no route points to)
  if (sections.length > 1) {
    const reachable = new Set<string>([sections[0].id]);
    for (const section of sections) {
      const rule = section.afterSection;
      if (rule && rule !== "next" && rule !== "submit" && sectionIds.has(rule)) {
        reachable.add(rule);
      }
      for (const field of section.fields) {
        if (!field.goToSection) continue;
        for (const target of Object.values(field.goToSection)) {
          if (target && target !== "next" && target !== "submit" && sectionIds.has(target)) {
            reachable.add(target);
          }
        }
      }
      // Sequential fallback
      const idx = sections.findIndex((s) => s.id === section.id);
      if (idx < sections.length - 1) reachable.add(sections[idx + 1].id);
    }

    for (const section of sections) {
      if (!reachable.has(section.id)) {
        issues.push({
          type: "unreachable",
          message: `Section "${section.title}" may be unreachable — no route points to it.`,
          sectionId: section.id,
        });
      }
    }
  }

  return issues;
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
