import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import {
  createCapturedRequest,
  getCapturedRequests,
  deleteCapturedRequest,
  deleteCapturedRequestsBySession,
  type CreateCapturedRequestParams,
} from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id') ?? undefined;
    const componentTag = searchParams.get('component_tag') ?? undefined;

    const requests = getCapturedRequests(sessionId, componentTag);
    return NextResponse.json({ requests });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get captured requests';
    console.error('[GET /api/traffic-capture] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, method, url, request_headers, request_body, response_status, response_headers, response_body, component_tag } = body;

    if (!session_id || !method || !url) {
      return NextResponse.json({ error: 'session_id, method, and url are required' }, { status: 400 });
    }

    const params: CreateCapturedRequestParams = {
      id: nanoid(),
      session_id,
      method,
      url,
      request_headers,
      request_body,
      response_status,
      response_headers,
      response_body,
      component_tag,
    };

    createCapturedRequest(params);
    return NextResponse.json({ id: params.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create captured request';
    console.error('[POST /api/traffic-capture] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const sessionId = searchParams.get('session_id');

    if (id) {
      const deleted = deleteCapturedRequest(id);
      return NextResponse.json({ deleted });
    }

    if (sessionId) {
      const count = deleteCapturedRequestsBySession(sessionId);
      return NextResponse.json({ deleted: count });
    }

    return NextResponse.json({ error: 'id or session_id is required' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete captured request';
    console.error('[DELETE /api/traffic-capture] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
