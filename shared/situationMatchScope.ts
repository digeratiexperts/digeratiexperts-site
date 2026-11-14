/** Fixed line shown when the visitor did not describe a business IT or security situation. */
export const SITUATION_MATCH_OFF_TOPIC_NOTE =
  "Describe an IT or security situation at your business and we'll match it.";

const SOCIAL_ONLY_RE =
  /^(hi+|(?:hello|hey)(?: there)?|yo|sup|hiya|howdy|thanks|thank you|thx|ok|okay|cool|nice|good (?:morning|afternoon|evening|night)|what'?s up|whats up|how are you(?: doing)?|how(?:'s| is) it going|nice to meet you)[\s!.?,]*$/i;

const CREATIVE_WRITING_RE =
  /\b(?:write(?: me)?(?: (?:a|an|some|another))?(?: \w+){0,3} (?:poem|poetry|haiku|sonnet|limerick|stories|story|novel|song|lyrics|screenplay|script|fanfic(?:tion)?|lullaby)|compose(?: me)?(?: (?:a|an))? (?:poem|haiku|song|sonnet)|tell me(?: a| an)?(?: \w+)? (?:story|joke|riddle)|make up(?: a| an)? (?:story|poem|joke)|sing(?: me)?(?: a| an)? song)\b/i;

const ROLEPLAY_RE =
  /\b(?:role[\s-]?play(?:ing)?|let'?s pretend|pretend (?:you(?:'re| are)|to be|i(?:'m| am))|act as (?:if )?(?:a|an|my|the)\b|you are now (?:a|an|my)\b|imagine you(?:'re| are) (?:a|an))\b/i;

const TRIVIA_RE =
  /\b(?:trivia(?: question)?|pop quiz|riddle me|what(?:'s| is) the capital of|who (?:won|invented|wrote|painted|directed|discovered|composed)\b|what year did|fun fact)\b/i;

const PERSONAL_CHAT_RE =
  /\b(?:how are you(?: doing| today)?|what(?:'s| is) your name|who are you\b(?!\s+\w)|i love you|be my (?:friend|companion|girlfriend|boyfriend|buddy|pal)|keep me company|can we (?:just )?(?:chat|talk)|let'?s (?:just )?(?:chat|talk|hang out)|what should i (?:have for )?(?:dinner|lunch|breakfast)|recommend a (?:movie|book|restaurant|recipe)|tell me a joke)\b/i;

/**
 * Personal chat, roleplay, trivia, or creative writing, not a business IT or
 * security situation to match against allow-listed DE services.
 */
export function isOffTopicSituation(text: string): boolean {
  const t = String(text || "").trim().replace(/[\u2019\u2018]/g, "'");
  if (!t) return false;
  return (
    SOCIAL_ONLY_RE.test(t) ||
    CREATIVE_WRITING_RE.test(t) ||
    ROLEPLAY_RE.test(t) ||
    TRIVIA_RE.test(t) ||
    PERSONAL_CHAT_RE.test(t)
  );
}
