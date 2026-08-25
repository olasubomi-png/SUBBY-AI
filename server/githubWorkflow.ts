export function supportsManualDispatch(workflowYaml: string) {
  return /(^|\n)\s*workflow_dispatch\s*:/m.test(workflowYaml);
}
