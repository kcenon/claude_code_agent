# Configuration Directory

This directory contains system-wide configuration files for the AD-SDLC system.

## Files

### agents.yaml
Agent registry defining all available agents and their configurations:
- Agent identifiers and versions
- Model assignments (Sonnet/Opus)
- Tool permissions
- Inter-agent dependencies

### workflow.yaml
Pipeline configuration defining:
- Stage sequence and transitions
- Approval gates
- Retry policies
- Timeout settings
- Worker pool configuration

## Usage

These configuration files are read by the Main Orchestrator at startup. Changes require a system restart to take effect.

## Schema

Configuration schemas are documented in the SDS-001 specification.
