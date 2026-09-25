// Component-specific type definitions

// Map Component Types
export interface MapPOI {
  id: string;
  name: string;
  category: string;
  latitude: number | string;
  longitude: number | string;
  priority?: number;
  rating?: number;
  timeToSpend?: string;
  budget?: string;
  dogFriendly?: boolean;
}

// Chat Message Types
export interface ChatMessage {
  type: "user" | "assistant" | "error";
  content: string;
  timestamp: Date;
  id?: string;
}

// Filter Types
export interface FilterState {
  categories: string[];
  timeToSpend: string[];
  budget: string[];
  accessibility: string[];
  dogFriendly: boolean;
}

// Auth Types
export interface User {
  id: string;
  email: string;
  username?: string;
  firstname?: string;
  lastname?: string;
  age?: number;
  city?: string;
  country?: string;
  about_you?: string;
  display_name?: string;
  profile_image_url?: string;
  is_active: boolean;
  email_verified_at?: string;
  last_login_at?: string;
  theme?: string;
  language?: string;
  role?: string;
  created_at: string;
  updated_at: string;
}

// Location Types
export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}
