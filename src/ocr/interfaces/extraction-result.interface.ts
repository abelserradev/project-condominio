export interface ExtractionResult {
  raw: string;
  structured?: Record<string, unknown>;
  engine: string;
  confidence?: number;
}
