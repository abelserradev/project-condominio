import { Injectable, Logger } from '@nestjs/common';

export type WelcomeEmailParams = {
  to: string;
  nombreEdificio: string;
  portalUrl: string;
  loginUrl: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendWelcomeEmail(params: WelcomeEmailParams): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.MAIL_FROM?.trim() ?? 'noreply@buildforge.work';

    const subject = `Tu portal ${params.nombreEdificio} está listo`;
    const html = `
      <p>Hola,</p>
      <p>Tu edificio <strong>${params.nombreEdificio}</strong> ya tiene portal activo.</p>
      <p><strong>Portal:</strong> <a href="${params.portalUrl}">${params.portalUrl}</a></p>
      <p><strong>Usuario de acceso:</strong> ${params.to}</p>
      <p>Entra con la contraseña que definiste al registrarte:</p>
      <p><a href="${params.loginUrl}">Iniciar sesión en el panel admin</a></p>
      <p>Si no reconoces este registro, ignora este correo.</p>
    `.trim();

    if (!apiKey) {
      this.logger.log(
        `[mail-fallback] Bienvenida → ${params.to} | portal: ${params.portalUrl} | login: ${params.loginUrl}`,
      );
      return false;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: params.to,
          subject,
          html,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`Resend falló (${res.status}): ${body}`);
        return false;
      }
      this.logger.log(`Email de bienvenida enviado a ${params.to}`);
      return true;
    } catch (err) {
      this.logger.warn(`No se pudo enviar email de bienvenida: ${err}`);
      return false;
    }
  }
}
