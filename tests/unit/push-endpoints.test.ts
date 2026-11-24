import { expect, test } from "vitest";
import { isAllowedPushEndpoint } from "../../src/lib/notifications/push-config";

test("el despacho solo permite endpoints HTTPS de los proveedores de Push admitidos", () => {
  expect(isAllowedPushEndpoint("https://web.push.apple.com/example")).toBe(
    true,
  );
  expect(
    isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/example"),
  ).toBe(true);
  expect(
    isAllowedPushEndpoint(
      "https://updates.push.services.mozilla.com/wpush/v2/example",
    ),
  ).toBe(true);
  expect(
    isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/example"),
  ).toBe(false);
  expect(isAllowedPushEndpoint("https://localhost/private")).toBe(false);
  expect(
    isAllowedPushEndpoint("https://fcm.googleapis.com.ejemplo.invalid/token"),
  ).toBe(false);
  expect(
    isAllowedPushEndpoint("https://fcm.googleapis.com@localhost/private"),
  ).toBe(false);
  expect(isAllowedPushEndpoint("https://fcm.googleapis.com:8443/token")).toBe(
    false,
  );
});
