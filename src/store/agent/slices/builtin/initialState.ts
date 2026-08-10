export interface BuiltinAgentSliceState {
  /**
   * Builtin agent id mapping { [slug]: agentId }
   * Used to store IDs of builtin agents (page-agent, etc.)
   */
  builtinAgentIdMap: Record<string, string>;
  /** Cache scope that produced the current builtin ID map. */
  builtinAgentScope: string | null;
}

export const initialBuiltinAgentSliceState: BuiltinAgentSliceState = {
  builtinAgentIdMap: {},
  builtinAgentScope: null,
};
