// tests/utils/smtp.util.ts
import { SMTPServer, SMTPServerDataStream } from 'smtp-server';
import { simpleParser, ParsedMail } from 'mailparser';
import { Stream } from 'stream';

export class SmtpTestServer {
    private server: SMTPServer;
    private lastMail: ParsedMail | null = null;
    private mailReceivedPromise: Promise<ParsedMail> | null = null;
    private resolveMailReceived: ((mail: ParsedMail) => void) | null = null;

    constructor(port: number, host: string) {
        this.server = new SMTPServer({
            authOptional: false,
            disabledCommands: ['STARTTLS'],
            onAuth: (auth, session, callback) => {
                callback(null, { user: auth.username });
            },
            onData: (stream, session, callback) => {
                this.handleData(stream, callback);
            },
        });

        this.server.on('error', err => {
            console.error('SMTP Server Error:', err);
        });
    }

    private handleData(stream: SMTPServerDataStream, callback: (err?: Error | null) => void) {
        simpleParser(stream as Stream)
            .then(parsed => {
                this.lastMail = parsed;
                if (this.resolveMailReceived) {
                    this.resolveMailReceived(parsed);
                }
                callback();
            })
            .catch(err => {
                callback(err);
            });
    }

    public resetMailPromise() {
        this.mailReceivedPromise = new Promise<ParsedMail>((resolve) => {
            this.resolveMailReceived = resolve;
        });
    }

    public start(port: number, host: string): Promise<void> {
        this.resetMailPromise();
        return new Promise((resolve) => {
            this.server.listen(port, host, () => {
                console.log(`Test SMTP Server listening on ${host}:${port}`);
                resolve();
            });
        });
    }

    public stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server.close(() => {
                console.log('Test SMTP Server stopped.');
                resolve();
            });
        });
    }

    public waitForMail(): Promise<ParsedMail> {
        if (!this.mailReceivedPromise) {
            throw new Error("SMTP server not started or promise not initialized.");
        }
        return this.mailReceivedPromise;
    }
}