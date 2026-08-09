/**
 * Budget for the agent knowledge block (`<agent_knowledge>`), i.e. the files a
 * user enables on an agent from the resource library.
 *
 * These files are injected into the FIRST user message, which means they are
 * re-sent on **every** request of the topic. Without a budget, enabling a
 * single multi-megabyte file silently turns "how are you?" into a
 * million-token request: it inflates cost by orders of magnitude and makes
 * small-context models reject the request outright.
 *
 * Content beyond the budget is not lost — it stays reachable on demand through
 * the Knowledge Base tool (`readKnowledge` / `searchKnowledgeBase`), which is
 * pay-per-use instead of pay-per-turn.
 */

/**
 * Max characters injected inline per enabled knowledge file.
 * ~20k chars ≈ 5k tokens — enough for a normal document to be fully present.
 */
export const AGENT_KNOWLEDGE_FILE_CHAR_LIMIT = 20_000;

/**
 * Max characters injected inline across ALL enabled knowledge files combined.
 * ~60k chars ≈ 15k tokens. Files that no longer fit are listed by id/name/size
 * only, so the model still knows they exist and can read them on demand.
 */
export const AGENT_KNOWLEDGE_TOTAL_CHAR_LIMIT = 60_000;
