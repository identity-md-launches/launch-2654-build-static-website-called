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
