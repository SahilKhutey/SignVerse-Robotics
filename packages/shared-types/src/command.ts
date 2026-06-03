export interface CommandRequest {
  naturalLanguage: string;
}

export interface CommandResponse {
  parsedIntent: string;
  motionPrimitive: string;
  params: Record<string, any>;
  success: boolean;
}
