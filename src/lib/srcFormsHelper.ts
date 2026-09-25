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
  severity?: "error" | "warning";
  message: string;
  fieldId?: string;
  sectionId?: string;
  optionLabel?: string;
}

export interface ActiveRouteInfo {
  visitedPath: string[];
  projectedPath: string[];
  currentStepNumber: number;
  totalSteps: number;
  progressPercent: number;
  isLastStep: boolean;
  nextTarget: string | "submit";
}

/**
 * Partitions flat form fields into Google Forms–style sections.
 * If no section dividers exist, returns 1 default section holding all fields.
 * whatsapp_link fields are treated as regular fields (non-branching).
 */
export function getFormSectionGroups(fields: SrcFormField[] = []): FormSectionGroup[] {
  const sections: FormSectionGroup[] = [];
  const sec1Explicit = fields.find((f) => (f.id === "section-1" || f.id === "sec-1") && f.type === "section");
  let currentSection: FormSectionGroup = {
    id: sec1Explicit?.id || "section-1",
    sectionIndex: 1,
    title: sec1Explicit?.question?.trim() || "Section 1",
    description: sec1Explicit?.description || "",
    afterSection: sec1Explicit?.afterSection || "next",
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
 * Calculates dynamic route information for Google Forms-style section progression.
 * Evaluates the respondent's actual traversed history plus projected future branch
 * destinations based on current answers, ensuring the "Section X of Y" indicator
 * reflects the respondent's ACTIVE route rather than arbitrary physical array size.
 */
export function getActiveRouteInfo(
  allSections: FormSectionGroup[],
  answers: Record<string, any> = {},
  activeSectionId?: string,
  sectionHistory: string[] = []
): ActiveRouteInfo {
  if (!allSections || allSections.length === 0) {
    return {
      visitedPath: [],
      projectedPath: [],
      currentStepNumber: 1,
      totalSteps: 1,
      progressPercent: 100,
      isLastStep: true,
      nextTarget: "submit",
    };
  }

  const effectiveActiveId =
    activeSectionId && allSections.some((s) => s.id === activeSectionId)
      ? activeSectionId
      : allSections[0].id;

  const currentSection =
    allSections.find((s) => s.id === effectiveActiveId) || allSections[0];

  const nextTarget = getNextSectionTarget(currentSection, allSections, answers);

  const visitedPath = [...sectionHistory, effectiveActiveId];
  const seen = new Set<string>(visitedPath);
  const projectedRemaining: string[] = [];

  let curTarget = nextTarget;
  let hops = 0;
  while (curTarget !== "submit" && hops < 50) {
    hops++;
    if (seen.has(curTarget)) break; // cycle guard
    seen.add(curTarget);
    projectedRemaining.push(curTarget);

    const nextSec = allSections.find((s) => s.id === curTarget);
    if (!nextSec) break;
    curTarget = getNextSectionTarget(nextSec, allSections, answers);
  }

  const projectedPath = [...visitedPath, ...projectedRemaining];
  const currentStepNumber = visitedPath.length;
  const totalSteps = Math.max(projectedPath.length, currentStepNumber);
  const progressPercent = Math.min(
    100,
    Math.max(10, Math.round((currentStepNumber / totalSteps) * 100))
  );
  const isLastStep =
    allSections.length <= 1 ||
    nextTarget === "submit" ||
    projectedRemaining.length === 0;

  return {
    visitedPath,
    projectedPath,
    currentStepNumber,
    totalSteps,
    progressPercent,
    isLastStep,
    nextTarget,
  };
}

/**
 * Prunes answers belonging to skipped sections so that if a respondent navigates back,
 * changes an answer, and takes a different branch, answers from bypassed sections
 * are NOT submitted into Firestore or counted as dangling responses.
 */
export function pruneSkippedSectionAnswers(
  allSections: FormSectionGroup[],
  visitedSectionIds: string[],
  answers: Record<string, any> = {}
): Record<string, any> {
  if (!visitedSectionIds || visitedSectionIds.length === 0) return answers;
  if (!allSections || allSections.length <= 1) return answers;

  const visitedSet = new Set(visitedSectionIds);
  const validFieldIds = new Set<string>();

  for (const section of allSections) {
    if (visitedSet.has(section.id)) {
      for (const field of section.fields) {
        validFieldIds.add(field.id);
      }
    }
  }

  const pruned: Record<string, any> = {};
  for (const [k, v] of Object.entries(answers)) {
    if (validFieldIds.has(k)) {
      pruned[k] = v;
    }
  }
  return pruned;
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
          severity: "error",
          message: `Section "${section.title}" routes to a deleted or missing section.`,
          sectionId: section.id,
        });
      }
      if (rule === section.id) {
        issues.push({
          type: "self_loop",
          severity: "error",
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
              severity: "error",
              message: `Option "${opt}" in question "${field.question || field.id}" routes to a section that no longer exists.`,
              fieldId: field.id,
              sectionId: section.id,
              optionLabel: opt,
            });
          }
          if (target === section.id) {
            issues.push({
              type: "self_loop",
              severity: "error",
              message: `Option "${opt}" routes to its own section (${section.title}), causing a loop.`,
              fieldId: field.id,
              sectionId: section.id,
              optionLabel: opt,
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
          severity: "warning",
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

/**
 * Returns the first whatsapp_link field (with a non-empty waGroupUrl) found
 * inside the sections the respondent actually visited (sectionPath).
 *
 * Falls back to null if no whatsapp_link exists in any visited section.
 * This powers option-based conditional post-submit WhatsApp group cards:
 *   • Dance answer → Section 3 visited → Section 3 WA link shown
 *   • Music answer → Section 4 visited → Section 4 WA link shown
 *
 * @param sections  Output of getFormSectionGroups()
 * @param sectionPath  Ordered list of section IDs the respondent traversed
 */
export function getWhatsAppLinkForPath(
  sections: FormSectionGroup[],
  sectionPath: string[]
): SrcFormField | null {
  if (!sectionPath || sectionPath.length === 0) return null;

  for (const sectionId of sectionPath) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) continue;
    const waField = section.fields.find(
      (f) => f.type === "whatsapp_link" && f.waGroupUrl?.trim()
    );
    if (waField) return waField;
  }
  return null;
}
