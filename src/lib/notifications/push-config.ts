const hosts = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
];

export function isAllowedPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      url.pathname !== "/" &&
      (hosts.includes(url.hostname) ||
        url.hostname.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}

export function getPushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  const secret = process.env.NOTIFICATION_DISPATCH_SECRET;
  if (
    process.env.PUSH_DISPATCH_ENABLED !== "true" ||
    process.env.VERCEL_ENV === "preview" ||
    !publicKey ||
    !privateKey ||
    !subject ||
    !secret ||
    secret.length < 32
  )
    return null;
  return { publicKey, privateKey, subject, secret };
}
