import { describe, it, expect } from 'vitest';
import { ComponentDesigner } from '../../src/sds-writer/ComponentDesigner.js';
import { LONG_INPUT_LENGTH, LONG_INPUT_TIME_LIMIT_MS, timed } from '../helpers/longInput.js';

describe('ComponentDesigner component naming', () => {
  type DesignerInternals = { generateComponentName(featureName: string): string };
  const generateComponentName = (featureName: string): string =>
    (new ComponentDesigner() as unknown as DesignerInternals).generateComponentName(featureName);

  it.each([
    ['User Management', 'UsermanagerManager'],
    ['Order   Processing', 'OrderprocessorManager'],
    ['Error\tHandling', 'ErrorhandlerManager'],
    ['Feature: Data management', 'DatamanagerRepository'],
    ['Management', 'ManagementManager'],
    [' Management', 'Manager'],
    ['Report Managements', 'ReportManagementsManager'],
    ['Data Handling Handling', 'DataHandlinghandlerRepository'],
    ['Service :  Billing Processing', 'BillingprocessorManager'],
    ['Xmanagement', 'XmanagementManager'],
  ])('should name the component for %j', (featureName, expected) => {
    expect(generateComponentName(featureName)).toBe(expected);
  });

  it('should name a feature with a long whitespace run quickly', () => {
    // Exercises the Management, Processing, and Handling suffix patterns
    const { result, elapsedMs } = timed(() =>
      generateComponentName(`x${'\t'.repeat(LONG_INPUT_LENGTH)}y`)
    );

    expect(result).toBe('XYManager');
    expect(elapsedMs).toBeLessThan(LONG_INPUT_TIME_LIMIT_MS);
  });
});
