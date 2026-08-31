export enum RecommendedSkillType {
  Builtin = 'builtin',
  Composio = 'composio',
  Lobehub = 'lobehub',
}

export interface RecommendedSkillItem {
  id: string;
  type: RecommendedSkillType;
}

export const RECOMMENDED_SKILLS: RecommendedSkillItem[] = [
  // Builtin skills
  { id: 'lobe-artifacts', type: RecommendedSkillType.Builtin },
  { id: 'lobe-user-memory', type: RecommendedSkillType.Builtin },
  { id: 'lobe-cloud-sandbox', type: RecommendedSkillType.Builtin },
  { id: 'lobe-task', type: RecommendedSkillType.Builtin },
  { id: 'lobe-agent-documents', type: RecommendedSkillType.Builtin },
  { id: 'lobe-message', type: RecommendedSkillType.Builtin },
  // Opt-in chat image generation: default-installed so Tools can pin it without Skill Store first.
  { id: 'lobe-image-generation', type: RecommendedSkillType.Builtin },
  // ФГИС ЛК: отраслевой инструмент отчётности. Установлен по умолчанию по той же
  // причине, что и генерация изображений: иначе его можно включить только через
  // магазин навыков, а тот требует авторизации в облаке LobeHub. Установка не
  // включает инструмент в каждом диалоге — он лишь появляется в списке Tools.
  { id: 'lobe-fgislk', type: RecommendedSkillType.Builtin },
  // LobeHub skills
  { id: 'notion', type: RecommendedSkillType.Lobehub },
  { id: 'posthog', type: RecommendedSkillType.Lobehub },
  { id: 'twitter', type: RecommendedSkillType.Lobehub },
  // Composio skills
  { id: 'gmail', type: RecommendedSkillType.Composio },
  { id: 'google-drive', type: RecommendedSkillType.Composio },
  { id: 'google-calendar', type: RecommendedSkillType.Composio },
  { id: 'slack', type: RecommendedSkillType.Composio },
];
