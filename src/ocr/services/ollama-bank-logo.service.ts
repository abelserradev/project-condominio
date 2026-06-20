import { Injectable, Logger } from '@nestjs/common';
import { withRetry } from '../../common/utils/retry.util';

const OLLAMA_BASE_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = 'moondream:1.8b';
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_OCR_TIMEOUT_MS) || 90_000;

const BANK_LOGO_PROMPT = `¿Qué banco emitió este comprobante de pago? Observa el logo o marca en la parte superior de la imagen.
Responde ÚNICAMENTE con el nombre del banco (ej: Mercantil, Bancamiga, BNC, Banco de Venezuela, Provincial). Sin explicaciones.`;

@Injectable()
export class OllamaBankLogoService {
  private readonly logger = new Logger(OllamaBankLogoService.name);

  async identificarBancoPorLogo(imageBuffer: Buffer): Promise<string | null> {
    const base64 = imageBuffer.toString('base64');

    try {
      const nombre = await withRetry(() => this.callOllama(base64), {
        maxAttempts: 2,
        delays: [1000, 2000],
      });
      return nombre;
    } catch (err) {
      this.logger.warn(
        `Ollama bank logo falló: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async callOllama(base64: string): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [
            {
              role: 'user',
              content: BANK_LOGO_PROMPT,
              images: [base64],
            },
          ],
          stream: false,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Ollama ${response.status}: ${body.slice(0, 150)}`);
      }

      const data = (await response.json()) as {
        message?: { content?: string };
      };
      const raw = (data?.message?.content ?? '').trim();
      if (!raw) return null;

      const normalizado = this.normalizarNombreBanco(raw);
      if (normalizado) {
        this.logger.log(`Ollama identificó banco por logo: ${normalizado}`);
      }
      return normalizado;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Ollama no respondió a tiempo');
      }
      throw err;
    }
  }

  private normalizarNombreBanco(texto: string): string | null {
    const t = texto.toLowerCase().trim();
    if (/mercantil/i.test(t)) return 'Banco Mercantil';
    if (/venezuela|bdv/i.test(t)) return 'Banco de Venezuela';
    if (/bancamiga/i.test(t)) return 'Bancamiga';
    if (/bnc|nacional\s*cr[eé]dito/i.test(t)) return 'BNC Banco Universal';
    if (/provincial/i.test(t)) return 'Banco Provincial';
    if (/bod|occidental/i.test(t)) return 'Banco Occidental de Descuento (BOD)';
    if (/banesco/i.test(t)) return 'Banesco';
    if (/bicentenario/i.test(t)) return 'Banco Bicentenario del Pueblo';
    if (t.length >= 3) return texto.trim();
    return null;
  }
}
