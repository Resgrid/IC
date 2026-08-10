import { type ChatbotChannelResponse, type ChatbotSendResponse, type ChatbotSessionResponse, type IncidentAssistantAnswerResponse, type IncidentAssistantSuggestionsResponse } from '@/models/v4/chat';

import { api } from '../common/client';

const CHATBOT = '/Chatbot';

/** Gets (creating if needed) the caller's chatbot conversation channel. */
export const getChatbotChannel = async (signal?: AbortSignal) => {
  const response = await api.get<ChatbotChannelResponse>(`${CHATBOT}/GetChatChannel`, { signal });
  return response.data?.Data ?? null;
};

/**
 * Sends a message to the chatbot. The reply arrives asynchronously in the same
 * channel over SignalR (chatbotMessageReceived). Idempotent via clientMessageId.
 */
export const sendChatbotMessage = async (text: string, clientMessageId: string) => {
  const response = await api.post<ChatbotSendResponse>(`${CHATBOT}/SendChatMessage`, {
    Text: text,
    ClientMessageId: clientMessageId,
  });
  return response.data?.Data ?? null;
};

/** Resets the chatbot conversational session (message history is retained). */
export const newChatbotSession = async () => {
  const response = await api.post<ChatbotSessionResponse>(`${CHATBOT}/NewChatSession`, {});
  return response.data;
};

/**
 * Asks the incident assistant a command-board question and gets the answer back in the same
 * round-trip. `callId` scopes the question to the board the caller has open, so "PAR" resolves
 * against that incident rather than guessing among the department's active commands.
 */
export const askIncidentAssistant = async (callId: number, question: string, signal?: AbortSignal) => {
  const response = await api.post<IncidentAssistantAnswerResponse>(`${CHATBOT}/AskIncident`, { Question: question, CallId: callId }, { signal });
  return response.data?.Data ?? null;
};

/** Server-side suggested questions for an incident, from the ICS playbook it infers for the call. */
export const getIncidentAssistantSuggestions = async (callId: number, signal?: AbortSignal) => {
  const response = await api.get<IncidentAssistantSuggestionsResponse>(`${CHATBOT}/IncidentSuggestions`, { params: { callId }, signal });
  return response.data?.Data ?? null;
};
