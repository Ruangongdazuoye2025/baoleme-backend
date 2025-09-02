import { SmtpTestServer } from "../utils/smtp.util";
import { execSync } from "child_process"

const SMTP_PORT = 1025;
const SMTP_HOST = '127.0.0.1';

const smtpServer = new SmtpTestServer(SMTP_PORT, SMTP_HOST);
(global as any).smtpServer = smtpServer;

beforeAll(async () => {
    await smtpServer.start(SMTP_PORT, SMTP_HOST);
    execSync('npx prisma migrate reset -f --skip-generate');
}, 30000);

afterAll(async () => {
    await smtpServer.stop();
}, 30000);