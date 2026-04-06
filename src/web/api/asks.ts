/**
 * Ask sessions API client
 */
import { api } from './client'
import type {
  AskFeedback,
  AskSession,
  AskSessionDetails,
  CreateAskSessionRequest,
} from '../../shared/types'

export const asksApi = {
  create: (data: CreateAskSessionRequest) =>
    api.post<AskSession, CreateAskSessionRequest>('/asks', data),

  get: (id: string) =>
    api.get<AskSessionDetails>(`/asks/${id}`),

  getFeedback: (id: string) =>
    api.get<AskFeedback>(`/asks/${id}/feedback`),

  continue: (id: string) =>
    api.post<AskSession>(`/asks/${id}/continue`, {}),

  cancel: (id: string) =>
    api.post<AskSession>(`/asks/${id}/cancel`, {}),
}
