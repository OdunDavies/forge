import { chromium } from "playwright";

const publicBase = "http://127.0.0.1:8080";
const appBase = "http://127.0.0.1:8081";
const failures = [];
const results = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const browserErrors = [];
page.on("pageerror", (error) => browserErrors.push(`page: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
});

async function check(url, expected, { finalPath } = {}) {
  browserErrors.length = 0;
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(700);
  const body = await page.locator("body").innerText();
  const status = response?.status() ?? 0;
  const pathname = new URL(page.url()).pathname;
  const badBody = /\{"status":500|unhandled[^\n]*HTTPError|Something went wrong/i.test(body);
  const passed = status < 400 && !badBody && browserErrors.length === 0 &&
    (!expected || body.toLowerCase().includes(expected.toLowerCase())) &&
    (!finalPath || pathname === finalPath);
  const item = { url, status, pathname, expected, passed, errors: [...browserErrors] };
  results.push(item);
  if (!passed) failures.push({ ...item, body: body.slice(0, 500) });
}

await check(`${publicBase}/`, "Train with intent");
await check(`${publicBase}/pricing`, "Forge membership");
await check(`${publicBase}/login`, "Welcome back");
await check(`${publicBase}/today`, "Welcome back", { finalPath: "/login" });
await check(`${publicBase}/definitely-missing`, "Page not found");

await page.goto(`${appBase}/onboarding`, { waitUntil: "domcontentloaded", timeout: 45_000 });
await page.getByRole("button", { name: "Build my plan" }).click();
await page.getByRole("button", { name: /Athletic/ }).click();
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("button", { name: /Intermediate/ }).click();
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("button", { name: /Build me a program/ }).click();
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("button", { name: "Prefer not to say" }).click();
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("button", { name: "Continue" }).click();
await page.getByPlaceholder("Enter your full name").fill("QA Athlete");
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("button", { name: /I work out at home/ }).click();
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("button", { name: "Design my program" }).click();
await page.getByRole("button", { name: "Use this program" }).click();
await page.waitForURL("**/today", { timeout: 45_000 });

for (const [path, marker] of [
  ["/today", "Today"],
  ["/plan", "Training plan"],
  ["/log", "Workout"],
  ["/library", "Movement library"],
  ["/history", "Training history"],
  ["/feed", "Training feed"],
  ["/coach", "Coach"],
  ["/profile", "Profile"],
]) {
  await check(`${appBase}${path}`, marker, { finalPath: path });
}

const exerciseHref = await page.goto(`${appBase}/library`, { waitUntil: "domcontentloaded" })
  .then(async () => page.locator('a[href^="/library/"]').first().getAttribute("href"));
if (exerciseHref) await check(`${appBase}${exerciseHref}`, "Instructions", { finalPath: exerciseHref });
else failures.push({ url: `${appBase}/library`, reason: "No exercise detail link" });

console.log(JSON.stringify({ ok: failures.length === 0, results, failures }, null, 2));
await browser.close();
process.exitCode = failures.length ? 1 : 0;
