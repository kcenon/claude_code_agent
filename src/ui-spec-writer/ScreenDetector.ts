/**
 * Screen Detector
 *
 * Parses SRS use cases and features to identify distinct UI screens.
 * Each use case that involves user interaction maps to one or more screens.
 * Features that describe UI-facing functionality contribute additional
 * screen candidates.
 */

import type { ParsedUseCase, ParsedFeature, ScreenSpec, UIElement } from './types.js';

/**
 * Convert a screen title into a URL-safe slug.
 *
 * @param title - Human-readable screen title
 * @returns URL-safe slug
 */
export function slugifyScreen(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'screen';
}

/**
 * Extract UI elements from a use case's steps.
 *
 * Infers element types from step descriptions using keyword patterns.
 *
 * @param steps - Use case steps
 * @param screenId - Parent screen ID for element ID generation
 */
export function extractElements(steps: readonly string[], screenId: string): readonly UIElement[] {
  const elements: UIElement[] = [];
  let elementIndex = 1;

  for (const step of steps) {
    const lower = step.toLowerCase();

    if (lower.includes('enter') || lower.includes('input') || lower.includes('type')) {
      elements.push({
        id: `${screenId}-input-${String(elementIndex)}`,
        type: 'input',
        label: extractLabel(step),
        dataSource: 'User input',
        behavior: step,
      });
      elementIndex++;
    }

    if (
      lower.includes('click') ||
      lower.includes('press') ||
      lower.includes('submit') ||
      lower.includes('select')
    ) {
      elements.push({
        id: `${screenId}-button-${String(elementIndex)}`,
        type: 'button',
        label: extractLabel(step),
        dataSource: 'User action',
        behavior: step,
      });
      elementIndex++;
    }

    if (lower.includes('display') || lower.includes('show') || lower.includes('view')) {
      elements.push({
        id: `${screenId}-display-${String(elementIndex)}`,
        type: 'display',
        label: extractLabel(step),
        dataSource: inferDataSource(lower),
        behavior: step,
      });
      elementIndex++;
    }

    if (lower.includes('list') || lower.includes('table')) {
      elements.push({
        id: `${screenId}-list-${String(elementIndex)}`,
        type: 'list',
        label: extractLabel(step),
        dataSource: inferDataSource(lower),
        behavior: step,
      });
      elementIndex++;
    }
  }

  return elements;
}

/**
 * Extract a short label from a step description.
 *
 * Takes the first meaningful clause (up to 50 chars) from the step.
 *
 * @param step - Full step description
 */
function extractLabel(step: string): string {
  // Remove leading step numbers ("1. ", "Step 1: ")
  const cleaned = step.replace(/^(?:step\s*\d+[:.]?\s*|\d+[.)]\s*)/i, '').trim();
  if (cleaned.length <= 50) {
    return cleaned;
  }
  return cleaned.slice(0, 47) + '...';
}

/**
 * Infer the data source for a display or list element from its step text.
 *
 * Uses keyword patterns to classify as API response, system state, or
 * database query.
 *
 * @param stepLower - Lowercased step description
 */
function inferDataSource(stepLower: string): string {
  if (stepLower.includes('api') || stepLower.includes('fetch') || stepLower.includes('response')) {
    return 'API response';
  }
  if (
    stepLower.includes('database') ||
    stepLower.includes('query') ||
    stepLower.includes('record')
  ) {
    return 'Database query';
  }
  if (
    stepLower.includes('system') ||
    stepLower.includes('server') ||
    stepLower.includes('generate')
  ) {
    return 'System state';
  }
  if (
    stepLower.includes('user') ||
    stepLower.includes('profile') ||
    stepLower.includes('account')
  ) {
    return 'User data';
  }
  return 'System state';
}

/**
 * Derive a screen title from a use case.
 *
 * Strips common prefixes like "User", "System" and action verbs
 * to produce a noun-phrase screen name.
 *
 * @param useCase - Use case to derive screen from
 */
function deriveScreenTitle(useCase: ParsedUseCase): string {
  let title = useCase.title;
  // Remove common verb prefixes to get a noun-oriented screen name
  title = title.replace(/^(?:User\s+)?(?:can\s+)?/i, '');
  // Capitalize first character
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  return title;
}

/**
 * Detect screens from parsed SRS use cases and features.
 *
 * Each use case that references user interaction generates at least one
 * screen. Features that map to UI surfaces may generate additional screens
 * if they are not already covered by use-case-derived screens.
 *
 * @param useCases - Parsed use cases from SRS
 * @param features - Parsed features from SRS
 * @returns Array of screen specifications
 */
export function detectScreens(
  useCases: readonly ParsedUseCase[],
  features: readonly ParsedFeature[]
): readonly ScreenSpec[] {
  const screens: ScreenSpec[] = [];
  const coveredFeatures = new Set<string>();
  let screenIndex = 1;

  // Generate screens from use cases
  for (const uc of useCases) {
    const screenId = `SCR-${String(screenIndex).padStart(3, '0')}`;
    const title = deriveScreenTitle(uc);
    const nameSlug = slugifyScreen(title);

    // Find related features by keyword matching
    const relatedFeatures: string[] = [];
    for (const feature of features) {
      const ucWords = uc.title.toLowerCase().split(/\s+/);
      const featureWords = feature.title.toLowerCase().split(/\s+/);
      const overlap = ucWords.filter((w) => featureWords.includes(w) && w.length > 3);
      if (overlap.length > 0) {
        relatedFeatures.push(feature.id);
        coveredFeatures.add(feature.id);
      }
    }

    const elements = extractElements(uc.steps, screenId);

    screens.push({
      id: screenId,
      nameSlug,
      title,
      purpose: uc.description || `Screen for ${uc.title}`,
      relatedUseCases: [uc.id],
      relatedFeatures,
      elements,
      navigationTargets: [],
    });

    screenIndex++;
  }

  // Generate screens for features not covered by use cases
  for (const feature of features) {
    if (coveredFeatures.has(feature.id)) {
      continue;
    }

    // Only create screens for UI-facing features
    const lower = feature.description.toLowerCase();
    const isUIFacing =
      lower.includes('screen') ||
      lower.includes('page') ||
      lower.includes('form') ||
      lower.includes('view') ||
      lower.includes('display') ||
      lower.includes('dashboard') ||
      lower.includes('ui') ||
      lower.includes('interface');

    if (!isUIFacing) {
      continue;
    }

    const screenId = `SCR-${String(screenIndex).padStart(3, '0')}`;
    const title = feature.title;
    const nameSlug = slugifyScreen(title);

    screens.push({
      id: screenId,
      nameSlug,
      title,
      purpose: feature.description || `Screen for ${feature.title}`,
      relatedUseCases: [],
      relatedFeatures: [feature.id],
      elements: [],
      navigationTargets: [],
    });

    screenIndex++;
  }

  // Link navigation targets based on flow adjacency
  return linkNavigationTargets(screens);
}

/**
 * Link screens by setting navigationTargets based on related use cases.
 *
 * Screens that share related use cases or features are likely linked
 * in the navigation graph.
 *
 * @param screens - Screens to link
 */
function linkNavigationTargets(screens: readonly ScreenSpec[]): readonly ScreenSpec[] {
  return screens.map((screen, index) => {
    const targets: string[] = [];

    for (let i = 0; i < screens.length; i++) {
      if (i === index) continue;
      const other = screens[i];
      if (other === undefined) continue;

      // Link screens that share use cases
      const sharedUCs = screen.relatedUseCases.filter((uc) => other.relatedUseCases.includes(uc));
      if (sharedUCs.length > 0) {
        targets.push(other.id);
        continue;
      }

      // Link screens that share features
      const sharedFeatures = screen.relatedFeatures.filter((f) =>
        other.relatedFeatures.includes(f)
      );
      if (sharedFeatures.length > 0) {
        targets.push(other.id);
        continue;
      }
    }

    // If no explicit links, connect to adjacent screens (sequential flow)
    if (targets.length === 0 && screens.length > 1) {
      const nextIndex = index + 1;
      if (nextIndex < screens.length) {
        const nextScreen = screens[nextIndex];
        if (nextScreen !== undefined) {
          targets.push(nextScreen.id);
        }
      }
    }

    return { ...screen, navigationTargets: targets };
  });
}
