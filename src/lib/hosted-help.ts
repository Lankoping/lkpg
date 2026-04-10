export type HostedHelpFaqItem = {
  id: string
  question: string
  answer: string
  tags: string[]
}

export const hostedHelpIntro =
  'Lan Foundary hosted gives your organization one shared workspace for applications, support tickets, and storage perks. Submit requests, reply in the same ticket thread, and track decisions in one place.'

export const hostedHelpFaq: HostedHelpFaqItem[] = [
  {
    id: 'funding-review-time',
    question: 'How does funding review work?',
    answer:
      'Submit an application ticket with clear event details, budget context, and timeline. Staff reviews the ticket thread, may ask for more information, and then approves or rejects directly from the same ticket.',
    tags: ['funding', 'application', 'review'],
  },
  {
    id: 'ticket-flow',
    question: 'When should I open a support ticket?',
    answer:
      'Open a support ticket for account access, technical issues, storage problems, and platform questions. If your issue blocks event operations or deadline delivery, mark it high priority and include exact impact.',
    tags: ['support', 'priority', 'triage'],
  },
  {
    id: 'storage-access',
    question: 'How do storage perks unlock?',
    answer:
      'Storage perks unlock after the organization has an approved request and accepted storage terms. Until then, upload and CDN actions can be restricted.',
    tags: ['storage', 'perks', 'access'],
  },
  {
    id: 'good-ticket',
    question: 'What details make a ticket faster to resolve?',
    answer:
      'Include what happened, expected behavior, exact error text, steps to reproduce, what changed recently, and any screenshots or links. For account issues, include account email and organization name.',
    tags: ['support', 'debugging', 'quality'],
  },
  {
      id: 'getting-started',
      question: 'What is Lan Foundary hosted and how do I get started?',
      answer:
        'Lan Foundary hosted is a collaboration workspace for organizations to submit funding applications, manage team members, request storage resources, and get support from one unified platform. Start by: 1) Get invited to an organization (ask your team organizer), 2) Activate your account via email, 3) Join your team in the Team section, 4) Check what features your role has access to in the sidebar.',
      tags: ['getting-started', 'onboarding', 'account'],
    },
    {
      id: 'application-requirements',
      question: 'What should I include in an application to maximize approval chances?',
      answer:
        'Include: clear event name and date, realistic attendance estimates, detailed event description explaining its purpose, specific breakdown of requested funds with justification, your organization status (nonprofit/group), payment method preference (HCB transfer or reimbursement), and any relevant links or documents. Be specific about how funds will be used (catering, equipment, venue, etc).',
      tags: ['applications', 'funding', 'best-practices'],
    },
    {
      id: 'team-member-permissions',
      question: 'What permissions can I grant to team members?',
      answer:
        'Organization organizers can grant individual permissions: (1) Manage Team - add/remove members and update permissions, (2) Request Funds - submit applications and create funding requests, (3) Manage Tickets - create and respond to support tickets, (4) Access Storage - request and manage storage resources. Each member can have different permission combinations.',
      tags: ['team', 'permissions', 'management'],
    },
    {
      id: 'invite-members',
      question: 'How do I invite new team members?',
      answer:
        'Go to Team section and click "Invite member". Enter their email address. They\'ll receive an activation email with a link to join your organization. Once they click it and set their password, they\'ll appear in your team list. The organizer can then grant specific permissions for each member.',
      tags: ['team', 'members', 'invitations'],
    },
    {
      id: 'reset-password',
      question: 'What if I forgot my password or cannot log in?',
      answer:
        'Open a support ticket describing the issue. Include your account email and organization name. The support team can send you a password reset email. For 2FA issues, mention what device/method you\'re using (TOTP, SMS, etc). Provide as much detail as possible so we can help quickly.',
      tags: ['account', 'security', 'login'],
    },
    {
      id: 'storage-upload-file-not-working',
      question: 'Why can\'t I upload files to storage or why is it timing out?',
      answer:
        'First check: (1) Is your organization\'s storage request approved? Storage requires an approved request AND signed terms before uploads work. (2) Try a smaller file first (under 100MB). (3) Check your file type - some formats are blocked for security. (4) Try from a different browser or device. (5) If still failing, open a support ticket with the exact file name, size, type, and error message you see.',
      tags: ['storage', 'upload', 'troubleshooting'],
    },
    {
      id: 'cdn-links-expire',
      question: 'How long are CDN links valid? Can they expire?',
      answer:
        'CDN links are permanent public URLs to your uploaded files. They do not expire automatically. However, if you delete a file from storage, its CDN link will stop working. Treat CDN links as published URLs - they can be shared widely and will remain active as long as the underlying file exists.',
      tags: ['storage', 'cdn', 'files'],
    },
    {
      id: 'hcb-vs-reimbursement',
      question: 'What is the difference between HCB transfer and reimbursement?',
      answer:
        'HCB transfer: Funds are sent directly to your HCB account. You control spending and reimburse other organizers as needed. Reimbursement: You pay out-of-pocket for expenses, collect receipts, and submit them for reimbursement. HCB is faster for organizations with accounts. Reimbursement works for groups without HCB.',
      tags: ['funding', 'payment', 'HCB'],
    },
    {
      id: 'organization-status-nonprofit',
      question: 'What organization status should I select?',
      answer:
        'Select "Registered nonprofit at Hackclub Bank" if your organization is an official nonprofit with an HCB account. Select "Individual group for reimbursements only" if you\'re an informal group or club without nonprofit status. The status affects eligibility and payment options available to you.',
      tags: ['organization', 'status', 'setup'],
    },
    {
      id: 'ai-first-responder',
      question: 'What is the AI first responder in support tickets?',
      answer:
        'When you create a support ticket, an AI assistant (Nano) automatically responds to gather key details and categorize your issue. It asks clarifying questions and sets a priority level. This helps staff route your issue faster. The AI categorizes as: account access, billing, storage, application, or technical issue. If you feel you\'ve provided all necessary info, mention it in your reply.',
      tags: ['support', 'ai', 'triage'],
    },
    {
      id: 'priority-levels',
      question: 'When should I mark a ticket as high priority or urgent?',
      answer:
        'Use High Priority if the issue significantly blocks your operation or has an important deadline (e.g., event in 2 days, authentication broken for half your team). Use Urgent only for critical outages or security issues affecting all users immediately. Low/Normal priority is fine for general questions and non-blocking issues.',
      tags: ['support', 'priority', 'best-practices'],
    },
    {
      id: 'application-status-pending',
      question: 'How long do applications take to review?',
      answer:
        'Applications are typically reviewed within 3-5 business days. Keep an eye on your application ticket in the Hosted section - staff will ask clarifying questions or request additional information right in the ticket thread. You\'ll see the approval or rejection decision in the same thread. More complete applications with clear budgets and event details review faster.',
      tags: ['applications', 'timeline', 'review'],
    },
    {
      id: 'cannot-access-feature',
      question: 'Why can\'t I see or access a feature?',
      answer:
        'Check two things: (1) Does your role have permission for that feature? Ask your organizer if you need "Request Funds", "Manage Tickets", "Access Storage", or "Manage Team" enabled. (2) If applying for storage or funding, your organization might need approval or to accept terms first. The Team page shows your current organization status.',
      tags: ['permissions', 'access', 'troubleshooting'],
    },
]

export const hostedHelpContext = [
  hostedHelpIntro,
  '',
  'FAQ:',
  ...hostedHelpFaq.map(
    (item) => `- Q: ${item.question}\n  A: ${item.answer}\n  Tags: ${item.tags.join(', ')}`,
  ),
].join('\n')
