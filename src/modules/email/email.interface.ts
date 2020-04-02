export interface MailInfo {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  content: string;
  attachments: MailAttachment[];
}

export interface MailAttachment {
  name: string;
  prefix: string;
  filename: string;
}
