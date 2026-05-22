import nodemailer from "nodemailer";

const EMAIL_USER = process.env.EMAIL_USER || "";
const EMAIL_PASS = process.env.EMAIL_PASS || "";

// Create reusable SMTP transporter (Gmail)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS, // Use Gmail App Password (not your regular Gmail password)
  },
});

/**
 * Sends a styled OTP email to the officer for password reset.
 */
export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const mailOptions = {
    from: `"Kerala Police Intelligence Wing" <${EMAIL_USER}>`,
    to,
    subject: "🔐 Password Reset OTP — Kerala Police Intelligence Wing",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: 'Arial', sans-serif; background: #0f172a; margin: 0; padding: 0; }
          .wrapper { max-width: 520px; margin: 40px auto; background: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid #334155; }
          .header { background: linear-gradient(135deg, #1d4ed8, #2563eb); padding: 32px; text-align: center; }
          .header img { width: 64px; height: 64px; }
          .header h1 { color: #ffffff; font-size: 20px; margin: 16px 0 4px; letter-spacing: 2px; text-transform: uppercase; }
          .header p { color: #93c5fd; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; margin: 0; }
          .body { padding: 40px 32px; text-align: center; }
          .body p { color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 24px; }
          .otp-box { display: inline-block; background: #0f172a; border: 2px solid #2563eb; border-radius: 12px; padding: 20px 40px; margin: 8px 0 32px; }
          .otp-box span { font-size: 42px; font-weight: 900; letter-spacing: 12px; color: #facc15; font-family: 'Courier New', monospace; }
          .warning { background: #422006; border: 1px solid #854d0e; border-radius: 8px; padding: 14px 18px; color: #fde68a; font-size: 13px; text-align: left; line-height: 1.6; }
          .footer { background: #0f172a; padding: 20px; text-align: center; color: #475569; font-size: 11px; border-top: 1px solid #1e293b; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <div style="font-size:48px;">🛡️</div>
            <h1>Kerala Police</h1>
            <p>Intelligence Wing — Secure Portal</p>
          </div>
          <div class="body">
            <p>A password reset was requested for your officer account. Use the OTP below to proceed. This code is valid for <strong style="color:#f1f5f9;">10 minutes</strong>.</p>
            <div class="otp-box">
              <span>${otp}</span>
            </div>
            <div class="warning">
              ⚠️ <strong>Security Notice:</strong> If you did not request a password reset, please ignore this email and contact your system administrator immediately. Never share this OTP with anyone.
            </div>
          </div>
          <div class="footer">
            Kerala Police Intelligence Wing &bull; Confidential &bull; Do not reply to this email
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`[Email] OTP sent to ${to}`);
}
