export interface Choice { value: string; label: string; hint?: string }
export interface Question { key: string; label: string; placeholder: string; hint: string; maxLength: number }
export interface Agent {
  id: string;
  name: string;
  docsUrl: string;
  setupUrl: string;
  routinesUrl: string;
  appsUrl: string;
  verifiedAt: string;
  channels: Choice[];
  setupSteps: string[];
  capabilities: { title: string; text: string; url: string; linkLabel: string }[];
}
export interface Playbook {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  agentId: string;
  keywords: string[];
  deliverables: string[];
  defaultFrequency: string;
  questions: Question[];
  prompt: string;
  schedule: string;
  guardrails: string;
  checklistSeparator: string | null;
  riskWarning: string | null;
}
export interface Catalog {
  version: number;
  defaultAgentId: string;
  experiences: Choice[];
  frequencies: Choice[];
  agents: Agent[];
  playbooks: Playbook[];
}
export type Answers = Record<string, string>;
export interface Route { view: string; params: URLSearchParams; malformed: boolean }
export interface SetupGuide {
  id: string;
  title: string;
  description: string;
  risk: string | null;
  note: string;
  verifiedAt: string;
  sourceUrl: string;
  beforeYouStart: string[];
  steps: { actor: string; text: string; commands: string[] }[];
  staySafe: string[];
  prompt: { provider: string; install: string; node: string; human_steps: string; signin: string; verify: string };
}
export interface GuideCatalog {
  version: number;
  reportUrl: string;
  banner: string;
  safetyRules: string[];
  promptTemplate: string;
  guides: SetupGuide[];
}
