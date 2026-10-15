import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'node:net';
import * as tls from 'node:tls';
import { MailMessage, buildMimeMessage } from '../../shared/reporting/email';
import { ResolvedEmailSettings } from './email-settings.service';

/** Linha lida de uma resposta SMTP aguardando um consumidor. */
interface LineWaiter {
  resolve: (line: string) => void;
  reject: (error: Error) => void;
}

/**
 * Sessao SMTP minima (sem dependencias): EHLO, STARTTLS opcional, AUTH LOGIN,
 * MAIL/RCPT/DATA/QUIT. Suficiente para o envio do Relatorio Financeiro.
 */
class SmtpSession {
  private buffer = '';
  private lines: string[] = [];
  private waiters: LineWaiter[] = [];
  private lastCode = 0;
  supportsStartTls = false;

  private constructor(private socket: net.Socket | tls.TLSSocket) {
    this.attach(socket);
  }

  private attach(socket: net.Socket | tls.TLSSocket): void {
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => this.onData(chunk));
    socket.on('error', (error: Error) => {
      const waiter = this.waiters.shift();
      if (waiter) waiter.reject(error);
    });
  }

  static async connect(
    host: string,
    port: number,
    secure: boolean,
  ): Promise<SmtpSession> {
    const socket = secure
      ? tls.connect({ host, port, servername: host })
      : net.connect({ host, port });
    const session = new SmtpSession(socket);
    await session.readResponse();
    return session;
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let index = this.buffer.indexOf('\r\n');
    while (index >= 0) {
      const line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 2);
      const waiter = this.waiters.shift();
      if (waiter) waiter.resolve(line);
      else this.lines.push(line);
      index = this.buffer.indexOf('\r\n');
    }
  }

  private readLine(): Promise<string> {
    const queued = this.lines.shift();
    if (queued !== undefined) return Promise.resolve(queued);
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
  }

  private async readResponse(): Promise<string> {
    let line = await this.readLine();
    const collected = [line];
    while (/^\d{3}-/.test(line)) {
      line = await this.readLine();
      collected.push(line);
    }
    const match = /^(\d{3})/.exec(collected[collected.length - 1]);
    this.lastCode = match ? Number(match[1]) : 0;
    return collected.join('\n');
  }

  async command(command: string): Promise<string> {
    this.socket.write(`${command}\r\n`);
    const response = await this.readResponse();
    if (this.lastCode >= 400) {
      throw new ServiceUnavailableException(
        `SMTP falhou em "${command.split(' ')[0]}": ${response}`,
      );
    }
    return response;
  }

  async ehlo(hostname: string): Promise<void> {
    const response = await this.command(`EHLO ${hostname}`);
    this.supportsStartTls = /STARTTLS/i.test(response);
  }

  async authLogin(user: string, password: string): Promise<void> {
    await this.command('AUTH LOGIN');
    await this.command(Buffer.from(user, 'utf8').toString('base64'));
    await this.command(Buffer.from(password, 'utf8').toString('base64'));
  }

  async data(message: Buffer): Promise<void> {
    await this.command('DATA');
    const body = message
      .toString('utf8')
      .replace(/\r\n\./g, '\r\n..');
    this.socket.write(body);
    this.socket.write('\r\n.\r\n');
    await this.readResponse();
    if (this.lastCode >= 400) throw new ServiceUnavailableException('SMTP rejeitou o DATA');
  }

  async upgradeToTls(host: string): Promise<void> {
    const upgraded = await new Promise<tls.TLSSocket>((resolve, reject) => {
      const socket = tls.connect({ socket: this.socket, servername: host }, () =>
        resolve(socket),
      );
      socket.once('error', reject);
    });
    this.socket = upgraded;
    this.attach(upgraded);
  }

  close(): void {
    try {
      this.socket.write('QUIT\r\n');
      this.socket.end();
      this.socket.destroy();
    } catch {
      // ignora erros de fechamento
    }
  }
}

/**
 * Envio de e-mail (D-030) via SMTP ou Microsoft Graph. Nunca registra segredos.
 * SMTP e' implementado sem dependencias; Graph via HTTP (client credentials).
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly config: ConfigService) {}

  async send(message: MailMessage, settings: ResolvedEmailSettings): Promise<void> {
    // `sendable` (transporte + remetente) basta para o envio; o `enabled` e'
    // exigido apenas pelos fluxos de negocio (ex.: Relatorio Financeiro, D-036).
    if (!settings.sendable) {
      throw new ServiceUnavailableException('Envio de e-mail nao configurado');
    }
    if (message.to.length === 0) {
      throw new ServiceUnavailableException('Informe ao menos um destinatario');
    }
    if (settings.transport === 'GRAPH') {
      await this.sendViaGraph(message, settings);
      return;
    }
    await this.sendViaSmtp(message, settings);
  }

  private async sendViaSmtp(
    message: MailMessage,
    settings: ResolvedEmailSettings,
  ): Promise<void> {
    const session = await SmtpSession.connect(
      settings.smtpHost,
      settings.smtpPort,
      settings.smtpSecure,
    );
    try {
      await session.ehlo('suporte-skills');
      if (!settings.smtpSecure && session.supportsStartTls) {
        await session.command('STARTTLS');
        await session.upgradeToTls(settings.smtpHost);
        await session.ehlo('suporte-skills');
      }
      if (settings.smtpUser !== '' && settings.smtpPassword !== '') {
        await session.authLogin(settings.smtpUser, settings.smtpPassword);
      }
      await session.command(`MAIL FROM:<${settings.fromAddress}>`);
      for (const to of message.to) await session.command(`RCPT TO:<${to}>`);
      await session.data(buildMimeMessage(message));
      await session.command('QUIT');
    } finally {
      session.close();
    }
  }

  private async sendViaGraph(
    message: MailMessage,
    settings: ResolvedEmailSettings,
  ): Promise<void> {
    const loginBase = this.config.get<string>('email.graphLoginBaseUrl') ?? '';
    const graphBase = this.config.get<string>('email.graphBaseUrl') ?? '';

    const tokenBody = new URLSearchParams({
      client_id: settings.graphClientId,
      client_secret: settings.graphClientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });
    const tokenResponse = await fetch(
      `${loginBase}/${encodeURIComponent(settings.graphTenantId)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
      },
    );
    const tokenJson = (await tokenResponse.json().catch(() => ({}))) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokenResponse.ok || !tokenJson.access_token) {
      throw new ServiceUnavailableException(
        `Falha ao autenticar no Graph: ${tokenJson.error_description ?? tokenJson.error ?? tokenResponse.status}`,
      );
    }

    const payload = {
      message: {
        subject: message.subject,
        body: { contentType: 'HTML', content: message.html },
        from: {
          emailAddress: {
            address: settings.fromAddress,
            name: settings.fromName,
          },
        },
        toRecipients: message.to.map((address) => ({
          emailAddress: { address },
        })),
        attachments: (message.attachments ?? []).map((attachment) => ({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: attachment.filename,
          contentType: attachment.contentType,
          contentBytes: attachment.content.toString('base64'),
        })),
      },
      saveToSentItems: true,
    };

    const sendResponse = await fetch(
      `${graphBase}/users/${encodeURIComponent(settings.fromAddress)}/sendMail`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${tokenJson.access_token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
    if (!sendResponse.ok) {
      const detail = await sendResponse.text().catch(() => '');
      throw new ServiceUnavailableException(
        `Graph respondeu HTTP ${sendResponse.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
      );
    }
  }
}
