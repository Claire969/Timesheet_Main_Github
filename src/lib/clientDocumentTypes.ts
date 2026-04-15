export interface DocClient {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface DocCategory {
  id: string;
  client_id: string;
  name: string;
  created_at: string;
}

export interface DocDocument {
  id: string;
  category_id: string;
  client_id: string;
  name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  created_at: string;
}

// FUTURE: add DocClientAccess { user_id, client_id } when per-user
// client visibility is implemented. Update RLS SELECT policies accordingly.
export interface DocClientAccess {
  user_id: string;
  client_id: string;
}
