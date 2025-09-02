import { SmtpTestServer } from "../utils/smtp.util";

const SMTP_PORT = 1025;
const SMTP_HOST = '127.0.0.1';

const smtpServer = new SmtpTestServer(SMTP_PORT, SMTP_HOST);
(global as any).smtpServer = smtpServer;

beforeAll(async () => {
    await smtpServer.start(SMTP_PORT, SMTP_HOST);
}, 30000);

afterAll(async () => {
    await smtpServer.stop();
}, 30000);