import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface SupportPerson {
  firstName: string;
  lastName: string;
  email?: string;
}

export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type SupportTicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface SupportTicketHistory {
  id: string;
  status: SupportTicketStatus;
  createdAt: string;
  actor: SupportPerson;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  module: string;
  issueType: string;
  description: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  currentRoute?: string;
  appVersion?: string;
  createdAt: string;
  updatedAt: string;
  requester?: SupportPerson;
  assignedTo?: SupportPerson | null;
  history?: SupportTicketHistory[];
}

export interface HelpArticle {
  id: string;
  category: string;
  title: string;
  content: string;
  relatedModule?: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  data: T;
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: { page: number; page_size: number; total: number; total_pages: number };
}

export interface TicketQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  priority?: string;
  sortBy?: string;
  sortOrder?: string;
}

@Injectable({ providedIn: 'root' })
export class SupportApiService {
  private readonly http = inject(HttpClient);

  articles(search = '', category = '') {
    let params = new HttpParams().set('page_size', 100);
    if (search) params = params.set('search', search);
    if (category) params = params.set('category', category);
    return this.http.get<PaginatedResponse<HelpArticle>>('/api/v1/support/articles', { params });
  }

  contacts() {
    return this.http.get<ApiResponse<Record<string, string>>>('/api/v1/support/contacts');
  }

  tickets(query: TicketQuery) {
    let params = new HttpParams().set('page', query.page).set('page_size', query.pageSize);
    if (query.search) params = params.set('search', query.search);
    if (query.status) params = params.set('status', query.status);
    if (query.priority) params = params.set('priority', query.priority);
    if (query.sortBy) params = params.set('sort_by', query.sortBy);
    if (query.sortOrder) params = params.set('sort_order', query.sortOrder);
    return this.http.get<PaginatedResponse<SupportTicket>>('/api/v1/support/tickets', { params });
  }

  ticket(id: string) {
    return this.http.get<ApiResponse<SupportTicket>>(`/api/v1/support/tickets/${id}`);
  }

  create(value: Record<string, unknown>) {
    return this.http.post<ApiResponse<SupportTicket>>('/api/v1/support/tickets', value);
  }

  updateTicket(id: string, status: SupportTicketStatus) {
    return this.http.patch<ApiResponse<SupportTicket>>(`/api/v1/support/tickets/${id}`, {
      status,
    });
  }
}
