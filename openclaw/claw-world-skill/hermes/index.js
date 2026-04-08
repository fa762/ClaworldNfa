'use strict';

const path = require('path');
const { ClawRuntime } = require('./claw-runtime');
const { HermesSessionStore } = require('./session-store');
const { HermesMemoryAdapter } = require('./memory-adapter');
const { createToolRegistry } = require('./tool-registry');
const {
  buildToolSchemas,
  createToolManifest,
  createOpenAiToolDescriptors,
  createMcpToolDescriptors
} = require('./tool-schemas');

function createHermesAdapter(options) {
  const settings = options || {};
  const skillDir = settings.skillDir || path.resolve(__dirname, '..');
  const runtime = settings.runtime || new ClawRuntime({
    skillDir,
    clawPath: settings.clawPath,
    nodePath: settings.nodePath,
    timeoutMs: settings.timeoutMs
  });
  const sessionStore = settings.sessionStore || new HermesSessionStore();
  const memoryAdapter = settings.memoryAdapter || new HermesMemoryAdapter(runtime, sessionStore);
  const tools = settings.tools || createToolRegistry(runtime, sessionStore, memoryAdapter);
  const toolSchemas = settings.toolSchemas || buildToolSchemas();
  const manifestOptions = {
    tools,
    schemas: toolSchemas,
    version: settings.version,
    entrypoint: settings.entrypoint,
    manifestCommand: settings.manifestCommand,
    schemaCommand: settings.schemaCommand
  };
  const manifest = createToolManifest(manifestOptions);
  const openAiTools = createOpenAiToolDescriptors(manifestOptions);
  const mcpTools = createMcpToolDescriptors(manifestOptions);

  return {
    runtime,
    sessionStore,
    memoryAdapter,
    tools,
    toolSchemas,
    manifest,
    openAiTools,
    mcpTools
  };
}

module.exports = {
  createHermesAdapter,
  ClawRuntime,
  HermesSessionStore,
  HermesMemoryAdapter,
  createToolRegistry,
  buildToolSchemas,
  createToolManifest,
  createOpenAiToolDescriptors,
  createMcpToolDescriptors
};
