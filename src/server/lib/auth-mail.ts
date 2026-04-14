async function getMailerTransport() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration missing: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS')
  }

  const nodemailer = await import('nodemailer')
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

export async function sendTwoFactorCodeEmail(targetEmail: string, code: string) {
  const transporter = await getMailerTransport()

  await transporter.sendMail({
    from: 'foundary@lankoping.se',
    to: targetEmail,
    subject: 'Your Lan Foundary login code',
    text: `Your Lan Foundary verification code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your Lan Foundary verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
  })
}

export async function sendAdminPasswordResetEmail(params: {
  targetEmail: string
  temporaryPassword: string
  requestedBy: string
}) {
  const { targetEmail, temporaryPassword, requestedBy } = params
  const transporter = await getMailerTransport()

  await transporter.sendMail({
    from: 'foundary@lankoping.se',
    to: targetEmail,
    subject: 'Lan Foundary password reset',
    text: [
      `A staff member (${requestedBy}) reset your Lan Foundary password.`,
      '',
      `Temporary password: ${temporaryPassword}`,
      '',
      'Please sign in and change your password immediately.',
    ].join('\n'),
    html: [
      `<p>A staff member (<strong>${requestedBy}</strong>) reset your Lan Foundary password.</p>`,
      `<p><strong>Temporary password:</strong> <code>${temporaryPassword}</code></p>`,
      '<p>Please sign in and change your password immediately.</p>',
    ].join(''),
  })
}
