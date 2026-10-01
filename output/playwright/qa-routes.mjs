import { chromium } from "playwright";

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
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  if (expected) {
    await page.getByText(expected, { exact: false }).first().waitFor({ timeout: 30_000 }).catch(() => null);
  }
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

await check(`${appBase}/pricing`, "Forge membership");

await page.goto(`${appBase}/onboarding`, { waitUntil: "domcontentloaded", timeout: 120_000 });
await Promise.race([
  page.waitForURL("**/today", { timeout: 90_000 }).catch(() => null),
  page.getByRole("button", { name: "Build my plan" }).waitFor({ timeout: 90_000 }).catch(() => null),
]);
if (new URL(page.url()).pathname !== "/today") {
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
try {
  await page.waitForURL("**/today", { timeout: 90_000 });
} catch (error) {
  const body = await page.locator("body").innerText().catch(() => "");
  throw new Error(`Onboarding did not reach /today: ${error.message}\n${body.slice(0, 1200)}\n${browserErrors.join("\n")}`);
}
}

for (const [path, marker] of [
  ["/today", "Today"],
  ["/plan", "upper-lower"],
  ["/log", "Mark it done"],
  ["/library", "How to move"],
  ["/history", "History"],
  ["/feed", "Work worth sharing"],
  ["/coach", "Coach"],
  ["/profile", "QA Athlete"],
]) {
  await check(`${appBase}${path}`, marker, { finalPath: path });
}

await page.goto(`${appBase}/library`, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.getByRole("heading", { name: "How to move" }).waitFor({ timeout: 30_000 });
const exerciseLinks = page.locator('a[href^="/library/"]');
const hasExerciseLink = (await exerciseLinks.count()) > 0;
const exerciseHref = hasExerciseLink ? await exerciseLinks.first().getAttribute("href") : null;
const exerciseName = hasExerciseLink ? (await exerciseLinks.first().locator("h2").innerText()) : null;
if (exerciseHref && exerciseName) await check(`${appBase}${exerciseHref}`, exerciseName, { finalPath: exerciseHref });
else failures.push({ url: `${appBase}/library`, reason: "No exercise detail link" });

console.log(JSON.stringify({ ok: failures.length === 0, results, failures }, null, 2));
await browser.close();
process.exitCode = failures.length ? 1 : 0;
