/**
 * Chatbot (assistant) API response shapes. Like the Chat controller, the chatbot
 * web-chat endpoints wrap their payload in the standard v4 { Data } envelope.
 */

export interface ChatbotChannelData {
  ChatChannelId: string;
  Name?: string | null;
  LastMessageSeq: number;
  LastMessageOn?: string | null;
}

export interface ChatbotChannelResponse {
  Data?: ChatbotChannelData | null;
}

export interface ChatbotSendData {
  ChatMessageId: string;
  MessageSeq: number;
  SentOn: string;
}

export interface ChatbotSendResponse {
  Data?: ChatbotSendData | null;
}

export interface ChatbotSessionResponse {
  Success: boolean;
}

/**
 * Answer to a command-board question. Unlike the chat endpoints (queued, reply arrives over
 * SignalR), the incident assistant answers in the same round-trip so the board can render it in
 * place — a commander asking for a PAR shouldn't be waiting on a channel hop.
 */
export interface IncidentAssistantAnswerData {
  Answer: string;
  /** Intent the server classified the question as ("IncidentPar", "Unknown", ...). */
  Intent?: string | null;
  Confidence?: number;
  /** False when the assistant couldn't answer (unresolved incident, no permission, rate limited). */
  Processed: boolean;
}

export interface IncidentAssistantAnswerResponse {
  Data?: IncidentAssistantAnswerData | null;
}

/** Suggested questions for an incident, tailored to its inferred ICS type. */
export interface IncidentAssistantSuggestionsData {
  IncidentType: string;
  /** Matches the app's own playbook ids in `services/incident-assistant/ics-playbooks`. */
  IncidentTypeKey: string;
  Questions: string[];
}

export interface IncidentAssistantSuggestionsResponse {
  Data?: IncidentAssistantSuggestionsData | null;
}
