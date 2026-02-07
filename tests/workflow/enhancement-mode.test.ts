/**
 * Tests for Enhancement Pipeline Mode Configuration
 *
 * These tests validate the workflow.yaml enhancement mode configuration
 * including stage definitions, parallel execution, and agent configurations.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface PipelineStage {
  name: string;
  agent?: string;
  description: string;
  inputs?: (string | { type: string })[];
  outputs?: string[];
  next?: string | null;
  approval_required?: boolean;
  parallel?: boolean;
  max_parallel?: number;
  substages?: PipelineStage[];
}

interface PipelineMode {
  description: string;
  stages: PipelineStage[];
}

interface WorkflowConfig {
  version: string;
  name: string;
  pipeline: {
    default_mode: string;
    modes: {
      greenfield: PipelineMode;
      enhancement: PipelineMode;
    };
    stages: PipelineStage[];
  };
  agents: Record<string, unknown>;
}

describe('Enhancement Pipeline Mode Configuration', () => {
  let workflowConfig: WorkflowConfig;
  let agentsConfig: Record<string, unknown>;

  beforeAll(() => {
    const workflowPath = path.join(
      process.cwd(),
      '.ad-sdlc/config/workflow.yaml'
    );
    const agentsPath = path.join(process.cwd(), '.ad-sdlc/config/agents.yaml');

    const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
    const agentsContent = fs.readFileSync(agentsPath, 'utf-8');

    workflowConfig = yaml.load(workflowContent) as WorkflowConfig;
    agentsConfig = yaml.load(agentsContent) as Record<string, unknown>;
  });

  describe('Pipeline Mode Structure', () => {
    it('should have default_mode set to greenfield', () => {
      expect(workflowConfig.pipeline.default_mode).toBe('greenfield');
    });

    it('should have both greenfield and enhancement modes defined', () => {
      expect(workflowConfig.pipeline.modes).toBeDefined();
      expect(workflowConfig.pipeline.modes.greenfield).toBeDefined();
      expect(workflowConfig.pipeline.modes.enhancement).toBeDefined();
    });

    it('should have description for each mode', () => {
      expect(workflowConfig.pipeline.modes.greenfield.description).toBe(
        'Full document generation pipeline for new projects'
      );
      expect(workflowConfig.pipeline.modes.enhancement.description).toBe(
        'Incremental update pipeline for existing projects'
      );
    });
  });

  describe('Greenfield Mode Stages', () => {
    it('should have all required greenfield stages', () => {
      const stages = workflowConfig.pipeline.modes.greenfield.stages;
      const stageNames = stages.map((s) => s.name);

      expect(stageNames).toContain('collection');
      expect(stageNames).toContain('prd_generation');
      expect(stageNames).toContain('srs_generation');
      expect(stageNames).toContain('sds_generation');
      expect(stageNames).toContain('issue_generation');
      expect(stageNames).toContain('orchestration');
      expect(stageNames).toContain('implementation');
      expect(stageNames).toContain('review');
    });

    it('should have correct stage flow for greenfield mode', () => {
      const stages = workflowConfig.pipeline.modes.greenfield.stages;

      const collectionStage = stages.find((s) => s.name === 'collection');
      expect(collectionStage?.next).toBe('prd_generation');

      const prdStage = stages.find((s) => s.name === 'prd_generation');
      expect(prdStage?.next).toBe('srs_generation');

      const reviewStage = stages.find((s) => s.name === 'review');
      expect(reviewStage?.next).toBeNull();
    });
  });

  describe('Enhancement Mode Stages', () => {
    it('should have all required enhancement stages', () => {
      const stages = workflowConfig.pipeline.modes.enhancement.stages;
      const stageNames = stages.map((s) => s.name);

      expect(stageNames).toContain('analysis_parallel');
      expect(stageNames).toContain('doc_code_comparison');
      expect(stageNames).toContain('impact_analysis');
      expect(stageNames).toContain('document_update');
      expect(stageNames).toContain('issue_generation');
      expect(stageNames).toContain('orchestration');
      expect(stageNames).toContain('parallel_execution');
      expect(stageNames).toContain('review');
    });

    it('should have correct stage flow for enhancement mode', () => {
      const stages = workflowConfig.pipeline.modes.enhancement.stages;

      const analysisStage = stages.find((s) => s.name === 'analysis_parallel');
      expect(analysisStage?.next).toBe('doc_code_comparison');

      const docCodeStage = stages.find((s) => s.name === 'doc_code_comparison');
      expect(docCodeStage?.next).toBe('impact_analysis');

      const impactStage = stages.find((s) => s.name === 'impact_analysis');
      expect(impactStage?.next).toBe('document_update');

      const reviewStage = stages.find((s) => s.name === 'review');
      expect(reviewStage?.next).toBeNull();
    });
  });

  describe('Parallel Execution Configuration', () => {
    it('should have parallel analysis stage with document_reading and codebase_analysis substages', () => {
      const stages = workflowConfig.pipeline.modes.enhancement.stages;
      const analysisStage = stages.find((s) => s.name === 'analysis_parallel');

      expect(analysisStage?.parallel).toBe(true);
      expect(analysisStage?.substages).toBeDefined();
      expect(analysisStage?.substages?.length).toBe(3);

      const substageNames = analysisStage?.substages?.map((s) => s.name);
      expect(substageNames).toContain('document_reading');
      expect(substageNames).toContain('codebase_analysis');
      expect(substageNames).toContain('code_reading');
    });

    it('should have parallel execution stage with implementation and regression_testing substages', () => {
      const stages = workflowConfig.pipeline.modes.enhancement.stages;
      const parallelStage = stages.find(
        (s) => s.name === 'parallel_execution'
      );

      expect(parallelStage?.parallel).toBe(true);
      expect(parallelStage?.substages).toBeDefined();
      expect(parallelStage?.substages?.length).toBe(2);

      const substageNames = parallelStage?.substages?.map((s) => s.name);
      expect(substageNames).toContain('implementation');
      expect(substageNames).toContain('regression_testing');
    });

    it('should have document_update stage with sequential PRD/SRS/SDS updaters', () => {
      const stages = workflowConfig.pipeline.modes.enhancement.stages;
      const documentUpdateStage = stages.find(
        (s) => s.name === 'document_update'
      );

      expect(documentUpdateStage?.substages).toBeDefined();
      expect(documentUpdateStage?.substages?.length).toBe(3);

      const substageNames = documentUpdateStage?.substages?.map((s) => s.name);
      expect(substageNames).toEqual(['prd_update', 'srs_update', 'sds_update']);

      // Verify sequential flow
      const prdUpdate = documentUpdateStage?.substages?.find(
        (s) => s.name === 'prd_update'
      );
      expect(prdUpdate?.next).toBe('srs_update');

      const srsUpdate = documentUpdateStage?.substages?.find(
        (s) => s.name === 'srs_update'
      );
      expect(srsUpdate?.next).toBe('sds_update');
    });
  });

  describe('Approval Gates', () => {
    it('should require approval for impact_analysis stage', () => {
      const stages = workflowConfig.pipeline.modes.enhancement.stages;
      const impactStage = stages.find((s) => s.name === 'impact_analysis');

      expect(impactStage?.approval_required).toBe(true);
    });

    it('should require approval for document update substages', () => {
      const stages = workflowConfig.pipeline.modes.enhancement.stages;
      const documentUpdateStage = stages.find(
        (s) => s.name === 'document_update'
      );

      documentUpdateStage?.substages?.forEach((substage) => {
        expect(substage.approval_required).toBe(true);
      });
    });

    it('should not require approval for parallel analysis substages', () => {
      const stages = workflowConfig.pipeline.modes.enhancement.stages;
      const analysisStage = stages.find((s) => s.name === 'analysis_parallel');

      analysisStage?.substages?.forEach((substage) => {
        expect(substage.approval_required).toBe(false);
      });
    });
  });

  describe('Enhancement Agent Configurations', () => {
    it('should have document-reader agent configuration', () => {
      const agents = workflowConfig.agents as Record<string, unknown>;
      expect(agents['document-reader']).toBeDefined();
    });

    it('should have codebase-analyzer agent configuration', () => {
      const agents = workflowConfig.agents as Record<string, unknown>;
      expect(agents['codebase-analyzer']).toBeDefined();
    });

    it('should have impact-analyzer agent configuration', () => {
      const agents = workflowConfig.agents as Record<string, unknown>;
      expect(agents['impact-analyzer']).toBeDefined();
    });

    it('should have document updater agent configurations', () => {
      const agents = workflowConfig.agents as Record<string, unknown>;
      expect(agents['prd-updater']).toBeDefined();
      expect(agents['srs-updater']).toBeDefined();
      expect(agents['sds-updater']).toBeDefined();
    });

    it('should have regression-tester agent configuration', () => {
      const agents = workflowConfig.agents as Record<string, unknown>;
      expect(agents['regression-tester']).toBeDefined();
    });
  });

  describe('Agent Input/Output Configuration', () => {
    it('should have correct inputs for impact_analysis stage', () => {
      const stages = workflowConfig.pipeline.modes.enhancement.stages;
      const impactStage = stages.find((s) => s.name === 'impact_analysis');

      expect(impactStage?.inputs).toBeDefined();
      const inputStrings = impactStage?.inputs?.map((i) =>
        typeof i === 'string' ? i : i.type
      );
      expect(inputStrings).toContain('user_message');
    });

    it('should have correct outputs for analysis substages', () => {
      const stages = workflowConfig.pipeline.modes.enhancement.stages;
      const analysisStage = stages.find((s) => s.name === 'analysis_parallel');

      const docReading = analysisStage?.substages?.find(
        (s) => s.name === 'document_reading'
      );
      expect(docReading?.outputs?.some((o) => o.includes('current_state.yaml'))).toBe(true);

      const codeAnalysis = analysisStage?.substages?.find(
        (s) => s.name === 'codebase_analysis'
      );
      expect(codeAnalysis?.outputs?.some((o) => o.includes('architecture_overview.yaml'))).toBe(true);
      expect(codeAnalysis?.outputs?.some((o) => o.includes('dependency_graph.json'))).toBe(true);
    });

    it('should have regression report as input for review stage', () => {
      const stages = workflowConfig.pipeline.modes.enhancement.stages;
      const reviewStage = stages.find((s) => s.name === 'review');

      expect(reviewStage?.inputs?.some((i) => {
        const input = typeof i === 'string' ? i : i.type;
        return input.includes('regression_report.yaml');
      })).toBe(true);
    });
  });
});

describe('Agents.yaml Enhancement Pipeline Configuration', () => {
  let agentsConfig: Record<string, unknown>;

  beforeAll(() => {
    const agentsPath = path.join(process.cwd(), '.ad-sdlc/config/agents.yaml');
    const agentsContent = fs.readFileSync(agentsPath, 'utf-8');
    agentsConfig = yaml.load(agentsContent) as Record<string, unknown>;
  });

  describe('Enhancement Pipeline Agent Definitions', () => {
    it('should have document-reader agent defined', () => {
      const agents = agentsConfig.agents as Record<string, unknown>;
      expect(agents['document-reader']).toBeDefined();

      const agent = agents['document-reader'] as Record<string, unknown>;
      expect(agent.id).toBe('document-reader');
      expect(agent.category).toBe('enhancement_pipeline');
    });

    it('should have codebase-analyzer agent defined', () => {
      const agents = agentsConfig.agents as Record<string, unknown>;
      expect(agents['codebase-analyzer']).toBeDefined();

      const agent = agents['codebase-analyzer'] as Record<string, unknown>;
      expect(agent.id).toBe('codebase-analyzer');
      expect(agent.category).toBe('enhancement_pipeline');
    });

    it('should have impact-analyzer agent defined', () => {
      const agents = agentsConfig.agents as Record<string, unknown>;
      expect(agents['impact-analyzer']).toBeDefined();

      const agent = agents['impact-analyzer'] as Record<string, unknown>;
      expect(agent.id).toBe('impact-analyzer');
      expect(agent.category).toBe('enhancement_pipeline');
    });

    it('should have regression-tester agent defined', () => {
      const agents = agentsConfig.agents as Record<string, unknown>;
      expect(agents['regression-tester']).toBeDefined();

      const agent = agents['regression-tester'] as Record<string, unknown>;
      expect(agent.id).toBe('regression-tester');
      expect(agent.category).toBe('enhancement_pipeline');
    });
  });

  describe('Enhancement Pipeline Category', () => {
    it('should have enhancement_pipeline category with all required agents', () => {
      const categories = agentsConfig.categories as Record<string, unknown>;
      expect(categories.enhancement_pipeline).toBeDefined();

      const category = categories.enhancement_pipeline as Record<string, unknown>;
      const agents = category.agents as string[];

      expect(agents).toContain('document-reader');
      expect(agents).toContain('codebase-analyzer');
      expect(agents).toContain('impact-analyzer');
      expect(agents).toContain('prd-updater');
      expect(agents).toContain('srs-updater');
      expect(agents).toContain('sds-updater');
      expect(agents).toContain('regression-tester');
    });
  });

  describe('Agent Dependencies', () => {
    it('should have impact-analyzer depending on document-reader and codebase-analyzer', () => {
      const relationships = agentsConfig.relationships as Record<string, unknown>;
      const dependencies = relationships.dependencies as Record<string, unknown>;

      const impactAnalyzer = dependencies['impact-analyzer'] as Record<string, unknown>;
      expect(impactAnalyzer.requires).toContain('document-reader');
      expect(impactAnalyzer.requires).toContain('codebase-analyzer');
    });

    it('should have prd-updater depending on impact-analyzer', () => {
      const relationships = agentsConfig.relationships as Record<string, unknown>;
      const dependencies = relationships.dependencies as Record<string, unknown>;

      const prdUpdater = dependencies['prd-updater'] as Record<string, unknown>;
      expect(prdUpdater.requires).toContain('impact-analyzer');
    });

    it('should have regression-tester depending on codebase-analyzer and worker', () => {
      const relationships = agentsConfig.relationships as Record<string, unknown>;
      const dependencies = relationships.dependencies as Record<string, unknown>;

      const regressionTester = dependencies['regression-tester'] as Record<string, unknown>;
      expect(regressionTester.requires).toContain('codebase-analyzer');
      expect(regressionTester.requires).toContain('worker');
    });
  });

  describe('Data Flow Configuration', () => {
    it('should have data flow from document-reader to impact-analyzer', () => {
      const relationships = agentsConfig.relationships as Record<string, unknown>;
      const dataFlow = relationships.data_flow as Array<Record<string, unknown>>;

      const flow = dataFlow.find(
        (f) => f.from === 'document-reader' && f.to === 'impact-analyzer'
      );
      expect(flow).toBeDefined();
      expect(flow?.data).toBe('current_state.yaml');
    });

    it('should have data flow from codebase-analyzer to impact-analyzer', () => {
      const relationships = agentsConfig.relationships as Record<string, unknown>;
      const dataFlow = relationships.data_flow as Array<Record<string, unknown>>;

      const flow = dataFlow.find(
        (f) => f.from === 'codebase-analyzer' && f.to === 'impact-analyzer'
      );
      expect(flow).toBeDefined();
    });

    it('should have data flow from impact-analyzer to prd-updater', () => {
      const relationships = agentsConfig.relationships as Record<string, unknown>;
      const dataFlow = relationships.data_flow as Array<Record<string, unknown>>;

      const flow = dataFlow.find(
        (f) => f.from === 'impact-analyzer' && f.to === 'prd-updater'
      );
      expect(flow).toBeDefined();
      expect(flow?.data).toBe('impact_report.yaml');
    });

    it('should have data flow from regression-tester to pr-reviewer', () => {
      const relationships = agentsConfig.relationships as Record<string, unknown>;
      const dataFlow = relationships.data_flow as Array<Record<string, unknown>>;

      const flow = dataFlow.find(
        (f) => f.from === 'regression-tester' && f.to === 'pr-reviewer'
      );
      expect(flow).toBeDefined();
      expect(flow?.data).toBe('regression_report.yaml');
    });
  });
});
