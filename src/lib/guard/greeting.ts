export function greetingForTime(date: Date, timezone: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .find((part) => part.type === "hour")?.value,
  );
  if (hour >= 5 && hour < 12) return "Buenos días ☀️";
  if (hour >= 12 && hour < 18) return "Buenas tardes 🌤️";
  return "Buenas noches 🌙";
}
