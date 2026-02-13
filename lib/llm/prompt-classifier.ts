/**
 * Deterministic Prompt Classifier
 *
 * Extracts structured signals from a user prompt without any LLM calls.
 * Uses pattern matching, keyword detection, and structural analysis
 * to produce a PromptClassification object.
 *
 * This runs in <1ms and is the first stage of the scoring pipeline.
 */

import type {
  PromptClassification,
  TaskType,
  StakesLevel,
  ClassifierConfidence,
  InputSignals,
} from "./scoring-types";

// ─── Pattern Libraries ──────────────────────────────────────────

const CODE_GEN_PATTERNS = [
  /\b(write|create|generate|implement|build|make)\s+(a|an|the|me)?\s*(function|method|class|component|script|module|api|endpoint|hook|util)/i,
  /\b(write|create|build)\s+(code|program|app|application|service)/i,
  /\b(how\s+(to|do\s+I)\s+(create|make|implement|write|build))\b/i,
  /\b(snippet|boilerplate|starter|template|scaffold)\b/i,
  /\b(convert|transform|parse|serialize|deserialize)\s+(this|it|the|a|from|to)\b/i,
];

const DEBUG_PATTERNS = [
  /\b(debug|fix|error|bug|issue|problem|broken|crash|fail|exception)\b/i,
  /\b(stack\s*trace|traceback|runtime\s*error|type\s*error|syntax\s*error)\b/i,
  /\b(segfault|null\s*pointer|undefined\s+is\s+not|cannot\s+read\s+propert)/i,
  /\b(ENOENT|ECONNREFUSED|SIGABRT|exit\s+code|status\s+code\s+[45]\d\d)\b/i,
  /\b(what('s|\s+is)\s+wrong|doesn('t|t)\s+work|not\s+working)\b/i,
  /\b(troubleshoot|diagnose|root\s+cause)\b/i,
];

const REFACTOR_PATTERNS = [
  /\b(refactor|clean\s+up|improve|optimize|simplify|restructure)\s+(this|my|the|code|function|class)/i,
  /\b(code\s+review|review\s+(this|my|the)\s+(code|pr|pull\s+request))\b/i,
  /\b(make\s+(this|it)\s+(cleaner|better|more\s+(readable|maintainable|efficient)))\b/i,
  /\b(reduce\s+complexity|dry\s+up|extract\s+(method|function|component))\b/i,
  /\b(pr\s+review|pull\s+request\s+review)\b/i,
];

const EXPLAIN_PATTERNS = [
  /\b(explain|describe|what\s+(is|are|does)|how\s+does|walk\s+me\s+through)\b/i,
  /\b(understand|clarify|elaborate|break\s+down)\b/i,
  /\b(difference\s+between|compare|contrast|vs\.?|versus)\b/i,
  /\b(when\s+to\s+use|why\s+(would|should|do)\s+(I|we|you))\b/i,
  /\b(pros\s+and\s+cons|advantages|disadvantages|tradeoffs?)\b/i,
];

const RESEARCH_PATTERNS = [
  /\b(research|investigate|find\s+out|look\s+into|deep\s+dive)\b/i,
  /\b(analyze\s+(the\s+)?tradeoffs?|evaluate\s+(the\s+)?(options|approaches))\b/i,
  /\b(system\s+design|architect(ure)?|design\s+pattern)\b/i,
  /\b(benchmark|performance\s+comparison|cost[- ]benefit)\b/i,
  /\b(feasibility|impact\s+analysis|risk\s+assessment)\b/i,
  /\b(multi[- ]step\s+reasoning|think\s+through\s+step)\b/i,
];

const CREATIVE_PATTERNS = [
  /\b(write\s+(a|an|me)\s+(story|poem|essay|blog|article|post|copy|email|letter|newsletter))\b/i,
  /\b(marketing\s+(copy|email|content|campaign))\b/i,
  /\b(draft|compose|author|ghostwrite)\b/i,
  /\b(creative|brainstorm|ideate|come\s+up\s+with)\b/i,
  /\b(summarize|rewrite|rephrase|paraphrase|simplify)\b/i,
  /\b(cover\s+letter|resume|cv|linkedin)\b/i,
  /\b(landing\s+page|headline|tagline|slogan)\b/i,
];

const STACK_TRACE_PATTERNS = [
  /\b(at\s+\w+\.\w+\s*\()/,       // "at Module.func ("
  /\b(File\s+"[^"]+",\s+line\s+\d+)/i, // Python traceback
  /\b(Traceback\s+\(most\s+recent)/i,
  /^\s*at\s+/m,                      // Stack trace lines
  /\b(Error|Exception):\s+/,
  /\b(panic:|goroutine\s+\d+)/,    // Go panics
];

const STRUCTURED_FORMAT_PATTERNS = [
  /\b(json|yaml|xml|csv|table|markdown\s+table|schema)\b/i,
  /\b(format\s+as|output\s+as|return\s+as|respond\s+with|give\s+me\s+a)\s+(json|yaml|xml|csv|table)/i,
  /\b(structured|formatted|typed)\s+(output|response|data)\b/i,
  /\b(interface|type|schema|spec)\b/i,
];

const RECENCY_PATTERNS = [
  /\b(latest|newest|recent|current|up[- ]to[- ]date|modern)\b/i,
  /\b(202[5-9]|2030)\b/,
  /\b(new\s+(version|release|feature|api|update))\b/i,
  /\b(just\s+released|recently\s+(added|changed|updated))\b/i,
];

const HIGH_STAKES_PATTERNS = [
  /\b(executive|board|investor|stakeholder|c-suite|ceo|cto|cfo)\b/i,
  /\b(production[- ]ready|enterprise|mission[- ]critical)\b/i,
  /\b(legal|compliance|regulatory|audit)\b/i,
  /\b(public\s+statement|press\s+release|official)\b/i,
  /\b(sensitive|confidential|high[- ]stakes)\b/i,
  /\b(security|authentication|authorization|encryption)\b/i,
  /\b(payment|billing|financial|transaction)\b/i,
];

const CODE_LANGUAGE_SIGNALS =
  /\b(typescript|javascript|python|java|rust|golang|go|ruby|swift|kotlin|c\+\+|csharp|c#|php|sql|html|css|react|vue|angular|node\.?js|express|django|flask|rails|spring|docker|kubernetes|terraform|aws|gcp|azure)\b/i;

// ─── Classification Engine ──────────────────────────────────────

function matchCount(text: string, patterns: RegExp[]): number {
  return patterns.filter((p) => p.test(text)).length;
}

function detectTaskType(prompt: string): { taskType: TaskType; strength: number } {
  const scores: Record<TaskType, number> = {
    code_gen: matchCount(prompt, CODE_GEN_PATTERNS),
    debug: matchCount(prompt, DEBUG_PATTERNS),
    refactor: matchCount(prompt, REFACTOR_PATTERNS),
    explain: matchCount(prompt, EXPLAIN_PATTERNS),
    research: matchCount(prompt, RESEARCH_PATTERNS),
    creative: matchCount(prompt, CREATIVE_PATTERNS),
    general: 0,
  };

  // Boost debug if stack trace-like content detected
  if (matchCount(prompt, STACK_TRACE_PATTERNS) >= 2) {
    scores.debug += 3;
  }

  // Boost code_gen if code language mentioned alongside generation keywords
  if (CODE_LANGUAGE_SIGNALS.test(prompt) && scores.code_gen > 0) {
    scores.code_gen += 1;
  }

  // Find the winning task type
  let bestType: TaskType = "general";
  let bestScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type as TaskType;
    }
  }

  return { taskType: bestType, strength: bestScore };
}

function detectInputSignals(prompt: string): InputSignals {
  const hasCode =
    CODE_LANGUAGE_SIGNALS.test(prompt) ||
    /```[\s\S]*```/.test(prompt) ||
    /\b(function|class|const|let|var|def|import|export|return)\b/.test(prompt);

  const hasStackTrace = matchCount(prompt, STACK_TRACE_PATTERNS) >= 2;
  const strictFormat = matchCount(prompt, STRUCTURED_FORMAT_PATTERNS) >= 1;
  const longForm = prompt.length > 500;
  const concise = prompt.length < 100;
  const mentionsLatest = matchCount(prompt, RECENCY_PATTERNS) >= 1;

  return { hasCode, hasStackTrace, strictFormat, longForm, concise, mentionsLatest };
}

function detectStakes(prompt: string): StakesLevel {
  const highStakesHits = matchCount(prompt, HIGH_STAKES_PATTERNS);
  if (highStakesHits >= 2) return "high";
  if (highStakesHits >= 1) return "medium";

  // Long, complex prompts default to medium stakes
  if (prompt.length > 600) return "medium";

  return "low";
}

function computeClassifierConfidence(
  taskStrength: number,
  prompt: string
): ClassifierConfidence {
  // Strong signal: multiple pattern matches
  // Lowered from 3 to 2 — most real prompts only match 1-2 patterns.
  if (taskStrength >= 2) return "high";

  // Single match is still meaningful, especially with a real prompt
  if (taskStrength === 1 && prompt.length > 30) return "medium";
  if (taskStrength === 1) return "medium";

  // Zero pattern matches — truly ambiguous
  // Even then, if the prompt has meaningful length, it's not "low"
  if (prompt.length > 100) return "medium";

  return "low";
}

// ─── Public API ─────────────────────────────────────────────────

export function classifyPrompt(prompt: string): PromptClassification {
  const { taskType, strength } = detectTaskType(prompt);
  const inputSignals = detectInputSignals(prompt);
  const stakes = detectStakes(prompt);
  const recencyRequirement = inputSignals.mentionsLatest;
  const classifierConfidence = computeClassifierConfidence(strength, prompt);

  return {
    taskType,
    inputSignals,
    stakes,
    recencyRequirement,
    classifierConfidence,
  };
}
