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
]

export const hostedHelpContext = [
  hostedHelpIntro,
  '',
  'FAQ:',
  ...hostedHelpFaq.map(
    (item) => `- Q: ${item.question}\n  A: ${item.answer}\n  Tags: ${item.tags.join(', ')}`,
  ),
].join('\n')
