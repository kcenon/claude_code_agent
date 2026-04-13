/**
 * Design System Generator
 *
 * Generates a design token reference and component library specification
 * based on the detected technology stack and screen specifications.
 * Provides sensible defaults for web and mobile projects.
 */

import type {
  DesignSystem,
  DesignToken,
  DesignComponent,
  ScreenSpec,
  ProjectType,
} from './types.js';

/**
 * Default design tokens for web projects
 */
const WEB_TOKENS: readonly DesignToken[] = [
  { category: 'color', name: 'primary', value: '#1976D2', description: 'Primary brand color' },
  { category: 'color', name: 'secondary', value: '#424242', description: 'Secondary brand color' },
  { category: 'color', name: 'error', value: '#D32F2F', description: 'Error state color' },
  { category: 'color', name: 'success', value: '#388E3C', description: 'Success state color' },
  { category: 'color', name: 'warning', value: '#F57C00', description: 'Warning state color' },
  { category: 'color', name: 'background', value: '#FFFFFF', description: 'Default background' },
  { category: 'color', name: 'surface', value: '#F5F5F5', description: 'Surface/card background' },
  { category: 'color', name: 'text-primary', value: '#212121', description: 'Primary text color' },
  {
    category: 'color',
    name: 'text-secondary',
    value: '#757575',
    description: 'Secondary text color',
  },
  { category: 'spacing', name: 'xs', value: '4px', description: 'Extra small spacing' },
  { category: 'spacing', name: 'sm', value: '8px', description: 'Small spacing' },
  { category: 'spacing', name: 'md', value: '16px', description: 'Medium spacing' },
  { category: 'spacing', name: 'lg', value: '24px', description: 'Large spacing' },
  { category: 'spacing', name: 'xl', value: '32px', description: 'Extra large spacing' },
  {
    category: 'typography',
    name: 'font-family',
    value: 'Inter, system-ui, sans-serif',
    description: 'Default font family',
  },
  { category: 'typography', name: 'font-size-sm', value: '14px', description: 'Small text size' },
  { category: 'typography', name: 'font-size-md', value: '16px', description: 'Body text size' },
  { category: 'typography', name: 'font-size-lg', value: '20px', description: 'Large text size' },
  { category: 'typography', name: 'font-size-xl', value: '24px', description: 'Heading text size' },
  { category: 'border-radius', name: 'sm', value: '4px', description: 'Small border radius' },
  { category: 'border-radius', name: 'md', value: '8px', description: 'Medium border radius' },
  { category: 'border-radius', name: 'lg', value: '16px', description: 'Large border radius' },
];

/**
 * Default design tokens for mobile projects
 */
const MOBILE_TOKENS: readonly DesignToken[] = [
  {
    category: 'color',
    name: 'primary',
    value: '#007AFF',
    description: 'Primary brand color (iOS blue)',
  },
  { category: 'color', name: 'secondary', value: '#5856D6', description: 'Secondary brand color' },
  { category: 'color', name: 'error', value: '#FF3B30', description: 'Error state color' },
  { category: 'color', name: 'success', value: '#34C759', description: 'Success state color' },
  { category: 'color', name: 'background', value: '#FFFFFF', description: 'Default background' },
  { category: 'color', name: 'text-primary', value: '#000000', description: 'Primary text color' },
  { category: 'spacing', name: 'xs', value: '4dp', description: 'Extra small spacing' },
  { category: 'spacing', name: 'sm', value: '8dp', description: 'Small spacing' },
  { category: 'spacing', name: 'md', value: '16dp', description: 'Medium spacing' },
  { category: 'spacing', name: 'lg', value: '24dp', description: 'Large spacing' },
  {
    category: 'typography',
    name: 'font-family',
    value: 'SF Pro / Roboto',
    description: 'Platform default font',
  },
  { category: 'typography', name: 'font-size-body', value: '16sp', description: 'Body text size' },
  {
    category: 'typography',
    name: 'font-size-title',
    value: '20sp',
    description: 'Title text size',
  },
];

/**
 * Default design tokens for desktop projects
 */
const DESKTOP_TOKENS: readonly DesignToken[] = [
  { category: 'color', name: 'primary', value: '#0078D4', description: 'Primary accent color' },
  { category: 'color', name: 'background', value: '#F3F3F3', description: 'Window background' },
  { category: 'color', name: 'text-primary', value: '#1A1A1A', description: 'Primary text color' },
  { category: 'spacing', name: 'sm', value: '4px', description: 'Small spacing' },
  { category: 'spacing', name: 'md', value: '8px', description: 'Medium spacing' },
  { category: 'spacing', name: 'lg', value: '16px', description: 'Large spacing' },
  {
    category: 'typography',
    name: 'font-family',
    value: 'Segoe UI, system-ui',
    description: 'Platform default font',
  },
  { category: 'typography', name: 'font-size-body', value: '14px', description: 'Body text size' },
];

/**
 * Derive UI components from detected screen elements.
 *
 * Analyzes element types across all screens to determine which
 * reusable components should be documented.
 *
 * @param screens - Detected screen specifications
 */
export function deriveComponents(screens: readonly ScreenSpec[]): readonly DesignComponent[] {
  const elementTypes = new Map<string, number>();

  for (const screen of screens) {
    for (const element of screen.elements) {
      const count = elementTypes.get(element.type) ?? 0;
      elementTypes.set(element.type, count + 1);
    }
  }

  const components: DesignComponent[] = [];

  if (elementTypes.has('button')) {
    components.push({
      name: 'Button',
      description: 'Interactive button component for user actions',
      variants: ['primary', 'secondary', 'outlined', 'text', 'disabled'],
    });
  }

  if (elementTypes.has('input')) {
    components.push({
      name: 'TextInput',
      description: 'Text input field for user data entry',
      variants: ['default', 'password', 'email', 'multiline', 'error', 'disabled'],
    });
  }

  if (elementTypes.has('display')) {
    components.push({
      name: 'Card',
      description: 'Content card for displaying grouped information',
      variants: ['default', 'elevated', 'outlined'],
    });
  }

  if (elementTypes.has('list')) {
    components.push({
      name: 'DataList',
      description: 'List component for displaying collections of items',
      variants: ['default', 'paginated', 'searchable'],
    });
  }

  // Always include basic layout and navigation components
  components.push({
    name: 'AppBar',
    description: 'Top navigation bar with title and actions',
    variants: ['default', 'transparent', 'colored'],
  });

  components.push({
    name: 'Navigation',
    description: 'Navigation component for screen transitions',
    variants: ['sidebar', 'bottom-tab', 'breadcrumb'],
  });

  return components;
}

/**
 * Select appropriate design tokens based on project type.
 *
 * @param projectType - Detected project type
 */
function selectTokens(projectType: ProjectType): readonly DesignToken[] {
  switch (projectType) {
    case 'mobile':
      return MOBILE_TOKENS;
    case 'desktop':
      return DESKTOP_TOKENS;
    case 'web':
    case 'unknown':
    default:
      return WEB_TOKENS;
  }
}

/**
 * Determine the technology stack reference string based on project type.
 *
 * @param projectType - Detected project type
 */
function technologyStackReference(projectType: ProjectType): string {
  switch (projectType) {
    case 'web':
      return 'Web (HTML/CSS/JavaScript)';
    case 'mobile':
      return 'Mobile (iOS/Android)';
    case 'desktop':
      return 'Desktop Application';
    default:
      return 'Web (default)';
  }
}

/**
 * Generate a design system specification.
 *
 * Produces design tokens and component references appropriate for
 * the project type, enriched with components derived from detected screens.
 *
 * @param projectType - Detected project type
 * @param screens - Detected screen specifications
 */
export function generateDesignSystem(
  projectType: ProjectType,
  screens: readonly ScreenSpec[]
): DesignSystem {
  const tokens = selectTokens(projectType);
  const components = deriveComponents(screens);
  const technologyStack = technologyStackReference(projectType);

  return { tokens, components, technologyStack };
}
