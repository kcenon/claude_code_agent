/**
 * Flow Mapper
 *
 * Maps SRS use case flows to navigation flow documents.
 * Each multi-step use case generates a flow specification that
 * describes screen-to-screen transitions with actions and conditions.
 */

import type { ParsedUseCase, ScreenSpec, FlowSpec, FlowStep } from './types.js';

/**
 * Convert a flow title into a URL-safe slug.
 *
 * @param title - Human-readable flow title
 * @returns URL-safe slug
 */
export function slugifyFlow(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'flow';
}

/**
 * Find the screen most relevant to a use case step.
 *
 * Looks for keyword overlap between the step text and screen titles/purposes.
 * Falls back to the first screen related to the use case.
 *
 * @param step - Use case step text
 * @param screens - Available screens
 * @param useCaseId - Current use case ID
 */
function findScreenForStep(
  step: string,
  screens: readonly ScreenSpec[],
  useCaseId: string
): string {
  const stepLower = step.toLowerCase();

  // Try to find a screen whose title overlaps with the step
  for (const screen of screens) {
    const titleWords = screen.title.toLowerCase().split(/\s+/);
    const matchCount = titleWords.filter((w) => w.length > 3 && stepLower.includes(w)).length;
    if (matchCount > 0) {
      return screen.id;
    }
  }

  // Fall back to screens related to this use case
  const relatedScreens = screens.filter((s) => s.relatedUseCases.includes(useCaseId));
  if (relatedScreens.length > 0 && relatedScreens[0] !== undefined) {
    return relatedScreens[0].id;
  }

  // Last resort: first screen
  return screens[0]?.id ?? 'SCR-001';
}

/**
 * Extract a condition from a step description.
 *
 * Looks for "if", "when", "upon" clauses.
 *
 * @param step - Step description
 */
function extractCondition(step: string): string {
  const conditionMatch = step.match(/\b(?:if|when|upon|after)\s+(.+?)(?:[,.]|$)/i);
  return conditionMatch?.[1]?.trim() ?? '';
}

/**
 * Extract the action from a step description.
 *
 * Takes the main verb phrase from the step.
 *
 * @param step - Step description
 */
function extractAction(step: string): string {
  // Remove leading step numbers
  const cleaned = step.replace(/^(?:step\s*\d+[:.]?\s*|\d+[.)]\s*)/i, '').trim();
  // Truncate to reasonable length
  if (cleaned.length <= 80) {
    return cleaned;
  }
  return cleaned.slice(0, 77) + '...';
}

/**
 * Map use cases to flow specifications.
 *
 * Each use case with 2+ steps generates a flow that describes the
 * navigation path across screens. Single-step use cases are skipped
 * as they don't represent meaningful navigation flows.
 *
 * @param useCases - Parsed use cases from SRS
 * @param screens - Detected screens
 * @returns Array of flow specifications
 */
export function mapFlows(
  useCases: readonly ParsedUseCase[],
  screens: readonly ScreenSpec[]
): readonly FlowSpec[] {
  if (screens.length === 0) {
    return [];
  }

  const flows: FlowSpec[] = [];
  let flowIndex = 1;

  for (const uc of useCases) {
    // Skip use cases with fewer than 2 steps (no meaningful flow)
    if (uc.steps.length < 2) {
      continue;
    }

    const flowId = `FLW-${String(flowIndex).padStart(3, '0')}`;
    const title = `${uc.title} Flow`;
    const nameSlug = slugifyFlow(title);

    const steps: FlowStep[] = [];

    for (let i = 0; i < uc.steps.length - 1; i++) {
      const currentStep = uc.steps[i];
      const nextStep = uc.steps[i + 1];

      if (currentStep === undefined || nextStep === undefined) {
        continue;
      }

      const fromScreen = findScreenForStep(currentStep, screens, uc.id);
      const toScreen = findScreenForStep(nextStep, screens, uc.id);

      steps.push({
        stepNumber: i + 1,
        fromScreen,
        toScreen,
        action: extractAction(currentStep),
        condition: extractCondition(currentStep),
      });
    }

    // Add the last step if it has a clear terminal action
    if (uc.steps.length > 0) {
      const lastStep = uc.steps[uc.steps.length - 1];
      if (lastStep !== undefined) {
        const lastScreen = findScreenForStep(lastStep, screens, uc.id);
        steps.push({
          stepNumber: uc.steps.length,
          fromScreen: lastScreen,
          toScreen: lastScreen,
          action: extractAction(lastStep),
          condition: '',
        });
      }
    }

    flows.push({
      id: flowId,
      nameSlug,
      title,
      description: uc.description || `User flow for ${uc.title}`,
      relatedUseCases: [uc.id],
      steps,
      preconditions: [...uc.preconditions],
      outcomes: [...uc.postconditions],
    });

    flowIndex++;
  }

  return flows;
}
