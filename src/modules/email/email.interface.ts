import type { Attachment } from 'nodemailer/lib/mailer';

export interface MailInfo {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  content: string;
  attachments?: MailAttachment[] | Attachment[];
}

export interface MailAttachment {
  name: string;
  prefix: string;
  filename: string;
}

export function isMailAttachment(attachment): attachment is MailAttachment {
  return !!attachment.name;
}

export function isAttachment(attachment): attachment is Attachment {
  return !attachment.name;
}
