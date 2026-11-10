type Geo =
  | {
      status: "captured";
      latitude: number;
      longitude: number;
      accuracy_m: number;
      captured_at: string;
    }
  | { status: "denied" | "timeout" | "unavailable" };

export function captureLocation(): Promise<Geo> {
  if (typeof navigator === "undefined" || !navigator.geolocation)
    return Promise.resolve({ status: "unavailable" });
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          status: "captured",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
          captured_at: new Date(position.timestamp).toISOString(),
        }),
      (error) =>
        resolve({
          status:
            error.code === 1
              ? "denied"
              : error.code === 3
                ? "timeout"
                : "unavailable",
        }),
      { enableHighAccuracy: false, timeout: 1800, maximumAge: 30000 },
    );
  });
}
