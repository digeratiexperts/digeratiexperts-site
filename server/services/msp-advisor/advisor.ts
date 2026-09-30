import { getOpenAI } from "../../openaiService";
import { withOpenAIGuard } from "../openai-config";
import {
  classifyMode,
  isPromptInjectionAttempt,
  isMetaDialogue,
  isCannedLanguageComplaint,
  askedForHuman,
  isThinFollowUp,
} from "./classify";
import { selectKnowledgeSlice } from "./knowledge";
import {
  extractProfileFromText,
  mergeProfile,
  knownFactsList,
  extractContactNameFromText,
  extractCompanyNameFromText,
  isSubstantiveAdvisorQuestion,
  isInformalCompanyName,
  isDeInternalCompanyAnswer,
} from "./profile";
import { buildSystemPrompt, INTERNAL_REFUSAL, BANNED_CANNED_OPENER } from "./prompt";
import { sanitizeActions, assertNoInternalLeak, defaultActionsForMode, materializeAction, ensureLoginAction } from "./actions";
import { buildHeuristicReply, ensureFreshReply, isNearDuplicate } from "./fallback";
import {
  appendMessage,
  getOrCreateSession,
  updateProfile,
} from "./session";
import { appendDeskMessage, isDeskAgentLive } from "./persist";
import type {
  AdvisorChatRequest,
  AdvisorChatResponse,
  ConversationProfile,
  ModelAdvisorOutput,
} from "./types";

async function persistTurn(
  sessionId: string,
  userMessage: string,
  assistantReply: string,
  profile: { email?: string | null; contactName?: string | null; companyName?: string | null },
  pagePath?: string,
): Promise<{ messageId?: string; messageCreatedAt?: string }> {
  try {
    const meta = {
      email: profile.email || null,
      contactName: profile.contactName || null,
      companyName: profile.companyName || null,
      pagePath: pagePath || null,
    };
    await appendDeskMessage({ sessionId, role: "user", content: userMessage, ...meta });
    const assistant = await appendDeskMessage({
      sessionId,
      role: "assistant",
      content: assistantReply,
      ...meta,
    });
    return { messageId: assistant.id, messageCreatedAt: assistant.createdAt };
  } catch (err: any) {
    console.warn("[msp-advisor] persist failed (non-blocking):", err?.message || err);
    return {};
  }
}

function parseModelJson(raw: string): ModelAdvisorOutput | null {
  try {
    const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end < 0) return null;
    return JSON.parse(trimmed.slice(start, end + 1)) as ModelAdvisorOutput;
  } catch {
    return null;
  }
}

function applyCompanyGuess(profile: ConversationProfile, raw: string): ConversationProfile {
  if (isDeInternalCompanyAnswer(raw)) {
    return mergeProfile(profile, {
      companyName: "Digerati Experts",
      deInternal: true,
      companyInformal: false,
    });
  }
  if (isInformalCompanyName(raw)) {
    return mergeProfile(profile, { companyName: "Walk-in", companyInformal: true, deInternal: false });
  }
  return mergeProfile(profile, { companyName: raw, companyInformal: false });
}

async function callModel(system: string, history: Array<{ role: "user" | "assistant"; content: string }>, userMessage: string): Promise<string | null> {
  return withOpenAIGuard(async () => {
    const client = getOpenAI();
    if (!client) return null;

    const result = await client.chat.completions.create({
      // Stronger default tier (Joe 2026-08-31: "improve the intelligence").
      // Env-overridable so cost can be tuned without a deploy.
      model: process.env.MSP_ADVISOR_MODEL || "gpt-4o",
      temperature: 0.4,
      max_tokens: 550,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        ...history.slice(-10),
        { role: "user", content: userMessage },
      ],
    });

    return result.choices[0]?.message?.content?.trim() || null;
  });
}

function identityNamePrompt(): string {
  return "Before we continue, what's your name?";
}

function identityCompanyPrompt(contactName?: string): string {
  const first = (contactName || "").split(" ")[0];
  return first
    ? `Thanks, ${first}. What company are you with?`
    : "What company are you with?";
}

function identityReadyPrompt(profile: ConversationProfile): string {
  const first = (profile.contactName || "").split(" ")[0];
  if (profile.deInternal) {
    return first
      ? `${first}, you're with DE — I won't treat that as an outside company. What's on the desk?`
      : "You're with DE — I won't treat that as an outside company. What's on the desk?";
  }
  return first
    ? `Got it, ${first}. What should we look at?`
    : "Got it. What should we look at?";
}

export async function handleAdvisorChat(req: AdvisorChatRequest): Promise<AdvisorChatResponse> {
  const userTurn = (req.message || "").trim().slice(0, 4000);
  if (!userTurn) {
    throw Object.assign(new Error("Message is required"), { status: 400 });
  }
  let message = userTurn;

  const session = getOrCreateSession(req.sessionId, req.pageContext);
  const page = req.pageContext || session.pageContext;
  const priorName = session.profile.contactName;
  const priorCompany = session.profile.companyName;
  const priorDeInternal = session.profile.deInternal;

  // Merge heuristic extraction before model so known facts are available
  let profile = mergeProfile(session.profile, extractProfileFromText(message));
  if (priorName) {
    profile = mergeProfile(profile, { contactName: priorName });
  } else {
    const named = extractContactNameFromText(message);
    if (named) profile = mergeProfile(profile, { contactName: named });
  }
  updateProfile(session, profile);

  // When a portal agent has joined, skip AI and hand the turn to the human.
  const agentStatus = await isDeskAgentLive(session.id);
  if (agentStatus.live) {
    appendMessage(session, "user", message);
    try {
      await appendDeskMessage({
        sessionId: session.id,
        role: "user",
        content: message,
        email: profile.email || null,
        contactName: profile.contactName || null,
        companyName: profile.companyName || null,
        pagePath: page?.pathname || null,
      });
    } catch (err: any) {
      console.warn("[msp-advisor] agent-live persist failed:", err?.message || err);
    }
    const agentLabel = agentStatus.agentName || "a Digerati specialist";
    const reply = `${agentLabel} is with you now — your message was delivered. They’ll reply in this chat shortly.`;
    // Persist the ack so portal sees it; visitor already shows it from this response.
    let messageId: string | undefined;
    let messageCreatedAt: string | undefined;
    try {
      const ack = await appendDeskMessage({
        sessionId: session.id,
        role: "assistant",
        content: reply,
        senderName: agentStatus.agentName || "DE Desk",
        email: profile.email || null,
        contactName: profile.contactName || null,
        companyName: profile.companyName || null,
        pagePath: page?.pathname || null,
      });
      messageId = ack.id;
      messageCreatedAt = ack.createdAt;
    } catch (err: any) {
      console.warn("[msp-advisor] agent-live ack persist failed:", err?.message || err);
    }
    return {
      sessionId: session.id,
      reply,
      mode: session.lastMode || "existing_client",
      profile,
      actions: defaultActionsForMode(session.lastMode || "existing_client"),
      analyticsEvents: ["support_routed"],
      knownFacts: knownFactsList(profile),
      agentLive: true,
      agentName: agentStatus.agentName,
      messageId,
      messageCreatedAt,
    };
  }

  let mode = classifyMode(message, page);

  if (isPromptInjectionAttempt(message)) {
    const reply =
      "I can’t share internal instructions or secrets. I’m here to help with business IT, cybersecurity, compliance, and Digerati Experts services — what technology or security challenge are you working through?";
    appendMessage(session, "user", message);
    appendMessage(session, "assistant", reply);
    session.lastMode = mode === "off_topic" ? "msp_discovery" : mode;
    const persisted = await persistTurn(session.id, message, reply, profile, page?.pathname);
    return {
      sessionId: session.id,
      reply,
      mode: session.lastMode,
      profile,
      actions: defaultActionsForMode(session.lastMode),
      analyticsEvents: ["qualified_question"],
      knownFacts: knownFactsList(profile),
      ...persisted,
    };
  }

  const skipIdentity = mode === "security_incident" || mode === "existing_client";
  if (!skipIdentity && !profile.contactName) {
    if (isSubstantiveAdvisorQuestion(message) && !session.heldUserMessage) {
      session.heldUserMessage = message;
      session.originalIntent = session.originalIntent || message;
    }
    const reply = identityNamePrompt();
    appendMessage(session, "user", message);
    appendMessage(session, "assistant", reply);
    session.lastAssistantReply = reply;
    session.lastMode = mode === "off_topic" ? "msp_discovery" : mode;
    const persisted = await persistTurn(session.id, message, reply, profile, page?.pathname);
    return {
      sessionId: session.id,
      reply,
      mode: session.lastMode,
      profile,
      actions: [],
      analyticsEvents: ["conversation_started"],
      knownFacts: knownFactsList(profile),
      ...persisted,
    };
  }

  let justCollectedInformalCompany = false;
  let justCollectedDeInternal = Boolean(!priorDeInternal && profile.deInternal);
  if (!skipIdentity && !profile.companyName) {
    const collectedNameThisTurn = Boolean(!priorName && profile.contactName);
    const companyGuess = extractCompanyNameFromText(message, { allowBare: !collectedNameThisTurn });
    if (companyGuess && companyGuess.toLowerCase() !== (profile.contactName || "").toLowerCase()) {
      justCollectedInformalCompany = isInformalCompanyName(companyGuess);
      justCollectedDeInternal = isDeInternalCompanyAnswer(companyGuess);
      profile = applyCompanyGuess(profile, companyGuess);
      updateProfile(session, profile);
    }
  }

  const justCollectedCompany = Boolean(!priorCompany && profile.companyName);

  if (!skipIdentity && !profile.companyName) {
    const reply = identityCompanyPrompt(profile.contactName);
    appendMessage(session, "user", message);
    appendMessage(session, "assistant", reply);
    session.lastAssistantReply = reply;
    session.lastMode = mode === "off_topic" ? "msp_discovery" : mode;
    const persisted = await persistTurn(session.id, message, reply, profile, page?.pathname);
    return {
      sessionId: session.id,
      reply,
      mode: session.lastMode,
      profile,
      actions: [],
      analyticsEvents: ["conversation_started"],
      knownFacts: knownFactsList(profile),
      ...persisted,
    };
  }

  // Identity just finished and they have not asked anything yet — greet locally.
  // Skip the model so "Joe" / "yours" does not wait on a heavy prompt.
  if (
    justCollectedCompany &&
    !session.heldUserMessage &&
    !isSubstantiveAdvisorQuestion(userTurn)
  ) {
    const reply = identityReadyPrompt(profile);
    appendMessage(session, "user", message);
    appendMessage(session, "assistant", reply);
    session.lastAssistantReply = reply;
    session.lastMode = mode === "off_topic" ? "msp_discovery" : mode;
    const persisted = await persistTurn(session.id, message, reply, profile, page?.pathname);
    return {
      sessionId: session.id,
      reply,
      mode: session.lastMode,
      profile,
      actions: [],
      analyticsEvents: ["conversation_started"],
      knownFacts: knownFactsList(profile),
      ...persisted,
    };
  }

  const held = session.heldUserMessage;
  if (held && !session.originalIntent) {
    session.originalIntent = held;
  } else if (!session.originalIntent && isSubstantiveAdvisorQuestion(userTurn)) {
    session.originalIntent = userTurn;
  }
  session.heldUserMessage = undefined;

  const cannedComplaint = isCannedLanguageComplaint(userTurn);
  const metaTurn = isMetaDialogue(userTurn) || cannedComplaint;
  if (metaTurn && session.lastMode && session.lastMode !== "off_topic") {
    mode = session.lastMode;
  } else if (held && held !== userTurn) {
    mode = classifyMode(held, page);
  } else if (isThinFollowUp(userTurn) && session.lastMode && session.lastMode !== "off_topic") {
    mode = session.lastMode;
  } else {
    mode = classifyMode(userTurn, page);
  }

  const knowledge = selectKnowledgeSlice(mode, page);
  const system = buildSystemPrompt({
    mode,
    knowledge,
    profile,
    page,
    originalIntent: session.originalIntent,
    lastUserMessage: userTurn,
  });

  const history = session.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  appendMessage(session, "user", userTurn);

  const modelUserTurn = [
    session.originalIntent && session.originalIntent !== userTurn
      ? `Original request (still open): ${session.originalIntent}`
      : "",
    profile.companyInformal
      ? "Company was given informally — treat as a walk-in. Do not moralize or dump a sales pitch."
      : "",
    profile.deInternal
      ? "Visitor indicated they work at Digerati Experts. Acknowledge as staff/internal. Do not treat them as a client. Do not invent portal features. Never echo throwaway company words like yours, us, here, or DE as an outside company name."
      : "",
    `Latest message: ${userTurn}`,
  ]
    .filter(Boolean)
    .join("\n");

  const heuristicInput = {
    mode,
    userMessage: userTurn,
    originalIntent: session.originalIntent,
    profile,
    lastAssistantReply: session.lastAssistantReply,
    fallbackVariant: session.fallbackVariant || 0,
    justCollectedInformalCompany,
    cannedComplaint,
    askedForHuman: askedForHuman(userTurn),
  };

  let modelOut: ModelAdvisorOutput | null = null;
  // Staff-affiliation turns stay local/heuristic so we do not wait on the model
  // just to echo a garbled company name.
  if (!justCollectedDeInternal) {
    try {
      const raw = await callModel(system, history, modelUserTurn);
      if (raw) modelOut = parseModelJson(raw);
    } catch (err) {
      console.error("[msp-advisor] model call failed:", err);
    }
  }

  if (!modelOut?.reply) {
    modelOut = buildHeuristicReply(heuristicInput);
    session.fallbackVariant = (session.fallbackVariant || 0) + 1;
  }

  // Prefer heuristic mode for safety-critical modes
  if (mode === "security_incident" || mode === "off_topic" || mode === "existing_client") {
    modelOut.mode = mode;
  } else if (modelOut.mode) {
    mode = modelOut.mode;
  }

  if (!assertNoInternalLeak(modelOut.reply)) {
    modelOut.reply = INTERNAL_REFUSAL;
  }

  if (new RegExp(BANNED_CANNED_OPENER, "i").test(modelOut.reply)) {
    modelOut = buildHeuristicReply(heuristicInput);
    session.fallbackVariant = (session.fallbackVariant || 0) + 1;
  }

  if (justCollectedInformalCompany && !/walk-in/i.test(modelOut.reply)) {
    modelOut.reply = `I'll put you down as a walk-in for now. ${modelOut.reply}`;
  }
  if (cannedComplaint && !/\b(right|sorry|fair|canned)\b/i.test(modelOut.reply)) {
    modelOut.reply = `You're right — I'll drop the script. ${modelOut.reply}`;
  }

  modelOut.reply = ensureFreshReply(modelOut.reply, {
    ...heuristicInput,
    mode,
    fallbackVariant: session.fallbackVariant || 0,
  });
  if (isNearDuplicate(modelOut.reply, session.lastAssistantReply)) {
    session.fallbackVariant = (session.fallbackVariant || 0) + 1;
    modelOut.reply = buildHeuristicReply({
      ...heuristicInput,
      mode,
      fallbackVariant: session.fallbackVariant,
    }).reply;
  }

  profile = mergeProfile(profile, modelOut.profilePatch);
  profile = mergeProfile(profile, extractProfileFromText(userTurn));
  updateProfile(session, profile);

  let actions = sanitizeActions(modelOut.proposedActions, { mode });
  // Deterministic emergency escalation: an active incident ALWAYS leads with
  // the emergency-callback path and fires support_routed, even if the model
  // forgot. DE is an IT company — an emergency never stays a chat thread.
  // (Joe, 2026-08-31.) Adversarial-review corrections, same day: keep the
  // module's 3-action cap after injection, and do NOT inject
  // existing_client_support here — it routes through the Client Portal login
  // wall, which an anonymous incident visitor can't pass. The in-desk
  // security-incident path is already surfaced via suggestSupportChips and
  // the reply itself.
  if (mode === "security_incident") {
    if (!actions.some((a) => a.type === "request_callback")) {
      const cb = materializeAction("request_callback", "Request an emergency callback");
      if (cb) actions.unshift(cb);
    }
    actions = actions.slice(0, 3);
    if (!(modelOut.analyticsEvents || []).includes("support_routed")) {
      modelOut.analyticsEvents = [...(modelOut.analyticsEvents || []), "support_routed"];
    }
  }
  actions = ensureLoginAction(actions, userTurn, mode);
  const analyticsEvents = Array.from(
    new Set(
      (modelOut.analyticsEvents || []).filter((e) =>
        [
          "qualified_question",
          "service_recommended",
          "assessment_offered",
          "lead_capture_started",
          "booking_clicked",
          "support_routed",
          "off_topic_redirected",
        ].includes(e),
      ),
    ),
  );

  if (!session.analyticsFlags.conversation_started) {
    session.analyticsFlags.conversation_started = true;
    analyticsEvents.unshift("conversation_started");
  }

  appendMessage(session, "assistant", modelOut.reply);
  session.lastAssistantReply = modelOut.reply;
  session.lastMode = mode;

  const persisted = await persistTurn(session.id, userTurn, modelOut.reply, profile, page?.pathname);
  const suggestSupportChips = mode === "it_support" || mode === "security_incident";

  return {
    sessionId: session.id,
    reply: modelOut.reply,
    mode,
    profile,
    actions,
    analyticsEvents,
    knownFacts: knownFactsList(profile),
    suggestSupportChips,
    ...persisted,
  };
}
