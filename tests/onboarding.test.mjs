import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";

// Exercise the actual route components, React hooks, DOM and QueryClient.
// Only auth, server calls, analytics and router navigation are replaced.
const root = fileURLToPath(new URL("../", import.meta.url));
const validDraft = {
  step: 7, goal: "strength", focusMuscles: ["chest"], experience: "beginner",
  equipment: ["dumbbell"], availableDays: [1, 3], sessionMinutes: 60,
  units: "imperial", weight: "220.462", height: "70", injuries: "Left shoulder",
  sex: "prefer-not-to-say", birthYear: 1990, squat: "100", bench: "60",
  deadlift: "120", overheadPress: "40",
};
const savedProfile = {
  userId: "account-a", handle: "ada", displayName: "Saved name", bio: "",
  sex: null, birthYear: 1990, heightCm: 177.8, weightKg: 100, units: "imperial",
  experience: "beginner", goal: "strength", daysPerWeek: 2, sessionMinutes: 60,
  equipment: ["dumbbell"], injuries: "Left shoulder", availableDays: [1, 3],
  focusMuscles: ["chest"], onboardedAt: null, baseline_lifts: { squat: 100 },
  plan: "free", personalRecords: {}, sessionHistory: [], trainedDaysPerWeek: [],
  focusWeekHistory: [], tweaksApplied: [], sharedSessions: [], xp: 0, xpThisWeek: 0,
};

const mocks = {
  "@tanstack/react-router": `
    import { createElement, useEffect } from 'react';
    export const createFileRoute = () => options => ({options});
    const navigate = async ({to}) => {
      const userId = window.fixture.auth.user?.id;
      window.events.push({type:'navigate', to,
        profile:window.qc.getQueryData(['me',userId]),
        sharedProfile:window.qc.getQueryData(['me']), plan:window.qc.getQueryData(['plan'])});
    };
    export const useNavigate = () => navigate;
    export function Navigate({to}) { useEffect(() => { void navigate({to}); }, [to]); return createElement('p', {'data-redirect':to}, to); }
    export const Link = ({children,to,...props}) => createElement('a',{href:to,...props},children);
    export const Outlet = () => createElement('p',{'data-outlet':true},'Protected app');
  `,
  "@/lib/auth/use-current-user": `export const useCurrentUserState = () => window.fixture.auth;`,
  "@/lib/auth/gates": `
    import {createElement} from 'react';
    import {Navigate} from '@tanstack/react-router';
    export const RedirectToSignIn = () => createElement(Navigate,{to:'/login'});
    export const UserButton = () => null;
  `,
  "@/lib/api/profile": `
    export async function getMyProfile() {
      window.events.push({type:'get-profile'});
      if (window.fixture.profileError) throw new Error('Profile unavailable');
      return window.fixture.profile;
    }
    export async function upsertMyProfile({data}) {
      window.events.push({type:data.markOnboarded ? 'complete' : 'save',data});
      if (window.fixture.saveError) throw new Error('Save failed');
      if (data.markOnboarded && window.fixture.completeError) throw new Error('Completion failed');
      window.fixture.profile = {...(window.fixture.profile ?? window.fixture.defaultProfile), ...data,
        onboardedAt:data.markOnboarded ? '2026-09-29T12:00:00.000Z' : window.fixture.profile?.onboardedAt ?? null};
      return window.fixture.profile;
    }
  `,
  "@/lib/api/plan": `
    export async function generateFirstPlan() {
      window.events.push({type:'plan',profile:window.fixture.profile});
      if (window.fixture.planPending) await new Promise(resolve => {window.releasePlan = resolve;});
      if (window.fixture.planError) throw new Error('Plan failed');
      return window.fixture.nullPlan ? null : {id:42,title:'Starter',days:[]};
    }
  `,
  "@/lib/api/billing": `export const coachQuota = async () => ({plan:'free',limit:null});`,
  "@/lib/api/sessions": `export const listMyHistory = async () => []; export const getPersonalRecords = async () => [];`,
  "@/lib/analytics": `export const track = () => {};`,
  "@/lib/plan/fallback": `export const determineSplit = () => 'Full Body';`,
  "@/components/layout/app-shell": `export const AppShell = ({children}) => children;`,
};
const entry = `
  import {createElement, StrictMode} from 'react';
  import {createRoot} from 'react-dom/client';
  import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
  import {Route as onboarding} from '/src/routes/onboarding.tsx';
  import {Route as app} from '/src/routes/_app.tsx';
  import {Route as profile} from '/src/routes/_app/profile.tsx';
  import * as helpers from '/src/lib/onboarding.ts';
  window.helpers = helpers;
  window.events = [];
  window.qc = new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  const root = createRoot(document.getElementById('root'));
  window.renderRoute = () => root.render(createElement(StrictMode, null,
    createElement(QueryClientProvider,{client:window.qc},
      createElement(({onboarding,app,profile})[window.fixture.route ?? 'onboarding'].options.component))));
  window.renderRoute();
`;

let server, browser, page, errors;
async function open(options = {}) {
  await page.addInitScript(({ options, savedProfile }) => {
    window.fixture = {
      auth: { user: { id: "account-a", displayName: "Ada", isDevFallback: false }, isPending: false },
      profile: null, defaultProfile: savedProfile, ...options,
    };
    for (const [key, value] of Object.entries(options.storage ?? {})) localStorage.setItem(key, value);
    if (options.draft) localStorage.setItem("forge-onboarding-draft-v3:account-a", JSON.stringify(options.draft));
  }, { options, savedProfile });
  await page.goto(`${server.resolvedUrls.local[0]}onboarding-test.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.renderRoute === "function");
}
async function events(type) {
  return page.evaluate((type) => window.events.filter((event) => event.type === type), type);
}
async function complete() {
  await page.getByRole("button", { name: "Build my plan", exact: true }).click();
  await page.waitForFunction(() => window.events.some((event) => event.type === "navigate" && event.to === "/today"));
}

describe("Onboarding route regressions", { concurrency: false }, () => {
  before(async () => {
    server = await createServer({
      root, configFile: false,
      cacheDir: "node_modules/.vite-onboarding-tests",
      resolve: { alias: { "@": `${root.replaceAll("\\", "/")}src` } },
      optimizeDeps: { noDiscovery: true, include: ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom/client", "@tanstack/react-query", "@radix-ui/react-slot", "@radix-ui/react-label", "class-variance-authority", "clsx", "tailwind-merge", "sonner"] },
      server: { host: "127.0.0.1", port: 0, watch: null },
      plugins: [{
        name: "onboarding-regression-fixture", enforce: "pre",
        resolveId(id) {
          if (id === "virtual:onboarding-test") return `\0${id}`;
          const key = Object.keys(mocks).find((key) => key === id || (key.startsWith("@/") && id.replaceAll("\\", "/") === `${root.replaceAll("\\", "/")}src/${key.slice(2)}`));
          if (key) return `\0${key}`;
        },
        load(id) { if (id === "\0virtual:onboarding-test") return entry; return mocks[id.slice(1)]; },
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url !== "/onboarding-test.html") return next();
            res.setHeader("Content-Type", "text/html");
            res.end('<link rel="icon" href="data:,"><div id="root"></div><script type="module" src="/@id/__x00__virtual:onboarding-test"></script>');
          });
        },
      }],
    });
    await server.listen();
    // Use an installed browser on Windows, with standard Playwright Chromium elsewhere.
    browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
  });
  after(async () => { await browser?.close(); await server?.close(); });
  beforeEach(async () => {
    page = await browser.newPage(); errors = [];
    page.setDefaultTimeout(20000);
    page.on("pageerror", (error) => errors.push(error.message));
  });
  afterEach(async () => { await page.close(); assert.deepEqual(errors, [], "No React hook or browser runtime errors"); });

  it("welcomes the authenticated name, including pending-to-loaded hook transitions", async () => {
    await open({ auth: { user: null, isPending: true } });
    await page.getByRole("status").waitFor();
    await page.evaluate(() => {
      window.fixture.auth = { user: { id: "account-a", displayName: "Ada" }, isPending: false };
      window.renderRoute();
    });
    await page.getByRole("heading", { name: "Welcome Ada" }).waitFor();
  });

  it("has no name input and never restores a hidden draft name", async () => {
    await open({ draft: { ...validDraft, step: 0, displayName: "Wrong draft name" } });
    await page.getByRole("heading", { name: "Welcome Ada" }).waitFor();
    assert.equal(await page.getByRole("textbox").count(), 0);
    await page.getByRole("button", { name: "Go to step 8", exact: true }).click();
    await complete();
    assert.equal((await events("save"))[0].data.displayName, "Ada");
  });

  it("shows exactly one sex choice group with a persisted prefer-not-to-say state", async () => {
    await open();
    await page.getByRole("heading", { name: "Welcome Ada" }).waitFor();
    const group = page.getByRole("group", { name: "Sex", exact: true });
    assert.equal(await group.count(), 1);
    assert.equal(await group.getByRole("button").count(), 3);
    assert.equal(await page.getByRole("button", { name: "Continue", exact: true }).isEnabled(), false);
    await group.getByRole("button", { name: "Prefer not to say" }).click();
    await page.reload();
    await page.getByRole("heading", { name: "Welcome Ada" }).waitFor();
    assert.equal(await group.getByRole("button", { name: "Prefer not to say" }).getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: "Go to step 2", exact: true }).click();
    assert.equal(await page.getByRole("group", { name: "Sex", exact: true }).count(), 0);
  });

  it("submits the exact final mutation payload, including focus, null sex and baseline lifts", async () => {
    await open({ draft: validDraft });
    await complete();
    assert.deepEqual((await events("save"))[0].data, {
      displayName: "Ada", goal: "strength", focusMuscles: ["chest"], experience: "beginner",
      equipment: ["dumbbell"], availableDays: [1, 3], daysPerWeek: 2, sessionMinutes: 60,
      units: "imperial", weightKg: 100, heightCm: 177.8, injuries: "Left shoulder",
      sex: null, birthYear: 1990, baseline_lifts: { squat: 100, bench: 60, deadlift: 120, overheadPress: 40 },
    });
  });

  it("marks completion only after plan success and fills caches before redirect", async () => {
    await open({ draft: validDraft });
    await complete();
    const order = await page.evaluate(() => window.events.map((event) => event.type).filter((type) => type !== "get-profile"));
    assert.deepEqual(order.slice(0, 4), ["save", "plan", "complete", "navigate"]);
    assert.deepEqual((await events("complete"))[0].data, { displayName: "Ada", markOnboarded: true });
    for (const redirect of await events("navigate")) {
      assert.equal(redirect.to, "/today");
      assert.ok(redirect.profile.onboardedAt);
      assert.ok(redirect.sharedProfile.onboardedAt);
      assert.equal(redirect.plan.id, 42);
    }
    assert.equal(await page.evaluate(() => localStorage.getItem("forge-onboarding-draft-v3:account-a")), null);
  });

  it("reports plan failure without false completion or redirect, preserving a retryable draft", async () => {
    await open({ draft: validDraft, planError: true });
    await page.getByRole("button", { name: "Build my plan", exact: true }).click();
    await page.getByRole("alert").waitFor();
    assert.match(await page.getByRole("alert").innerText(), /Plan failed/);
    assert.equal((await events("complete")).length, 0);
    assert.equal((await events("navigate")).length, 0);
    assert.ok(await page.evaluate(() => localStorage.getItem("forge-onboarding-draft-v3:account-a")));
    await page.evaluate(() => { window.fixture.planError = false; });
    await complete();
    assert.equal((await events("complete")).length, 1);
  });

  it("synchronously rejects double clicks and disables controls throughout a pending plan", async () => {
    await open({ draft: validDraft, planPending: true });
    await page.getByRole("button", { name: "Build my plan", exact: true }).evaluate((button) => { button.click(); button.click(); });
    await page.waitForFunction(() => typeof window.releasePlan === "function");
    assert.equal((await events("save")).length, 1);
    assert.equal((await events("plan")).length, 1);
    assert.equal((await events("complete")).length, 0);
    assert.equal(await page.getByRole("button", { name: "Back", exact: true }).isEnabled(), false);
    assert.equal(await page.getByRole("button", { name: "Go to step 1", exact: true }).isEnabled(), false);
    assert.equal(await page.getByLabel("Squat (kg)", { exact: true }).isEnabled(), false);
    await page.evaluate(() => window.releasePlan());
    await page.waitForFunction(() => window.events.some((event) => event.type === "navigate"));
    assert.equal((await events("complete")).length, 1);
  });

  it("isolates accounts, ignores unscoped legacy drafts and validates restored bounds", async () => {
    await open({ storage: {
      "forge-onboarding-draft-v2": JSON.stringify(validDraft),
      "forge-onboarding-draft-v3:account-b": JSON.stringify(validDraft),
      "forge-onboarding-draft-v3:account-a": JSON.stringify({ ...validDraft, step: 999, goal: "invalid", availableDays: [-1, 8], sessionMinutes: 999, weight: "NaN" }),
    } });
    await page.getByRole("heading", { name: "What's the mission?" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Go to step 8", exact: true }).isEnabled(), false);
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem("forge-onboarding-draft-v3:account-a")));
    assert.equal(restored.step, 1); assert.equal(restored.sessionMinutes, 60);
    assert.deepEqual(restored.availableDays, []); assert.equal(restored.weight, "");
    await page.evaluate(() => {
      window.fixture.auth.user = { id: "account-c", displayName: "Grace" };
      window.renderRoute();
    });
    await page.getByRole("heading", { name: "Welcome Grace" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Go to step 2", exact: true }).isEnabled(), false);
  });

  it("hydrates saved profiles, persists edits through refresh and validates optional numbers", async () => {
    await open({ profile: savedProfile });
    await page.getByRole("heading", { name: "Welcome Ada" }).waitFor();
    await page.getByRole("button", { name: "Go to step 7", exact: true }).click();
    assert.equal(await page.getByLabel("Height (in)", { exact: true }).inputValue(), "70");
    await page.getByLabel("Injuries or limitations").fill("Knee limitation");
    await page.reload();
    await page.getByRole("heading", { name: "Optional vitals" }).waitFor();
    assert.equal(await page.getByLabel("Injuries or limitations").inputValue(), "Knee limitation");
    await page.getByLabel("Bodyweight (lb)", { exact: true }).fill("not a number");
    assert.equal(await page.getByRole("button", { name: "Continue", exact: true }).isEnabled(), false);
    assert.equal(await page.getByRole("button", { name: "Go to step 8", exact: true }).isEnabled(), false);
    await page.getByLabel("Bodyweight (lb)", { exact: true }).fill("");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("Squat (kg)", { exact: true }).fill("-5");
    assert.equal(await page.getByRole("button", { name: "Build my plan", exact: true }).isEnabled(), false);
  });

  it("redirects signed-out visitors without issuing profile requests", async () => {
    await open({ auth: { user: null, isPending: false } });
    await page.locator('[data-redirect="/login"]').waitFor();
    assert.equal((await events("get-profile")).length, 0);
  });

  it("surfaces query errors instead of treating them as a missing profile", async () => {
    await open({ route: "app", profileError: true });
    await page.getByRole("alert").waitFor();
    assert.equal((await events("navigate")).length, 0);
    assert.equal(await page.locator("[data-outlet]").count(), 0);
    await page.evaluate(() => { window.fixture.profileError = false; window.fixture.profile = { ...window.fixture.defaultProfile, onboardedAt: "done" }; });
    await page.getByRole("button", { name: "Retry" }).click();
    await page.locator("[data-outlet]").waitFor();
  });

  it("keeps drafts and reports save, empty-plan and completion failures without redirect", async () => {
    for (const failure of ["saveError", "nullPlan", "completeError"]) {
      await page.close(); page = await browser.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await open({ draft: validDraft, [failure]: true });
      await page.getByRole("button", { name: "Build my plan", exact: true }).click();
      await page.getByRole("alert").waitFor();
      assert.equal((await events("navigate")).length, 0);
      assert.ok(await page.evaluate(() => localStorage.getItem("forge-onboarding-draft-v3:account-a")));
      if (failure !== "completeError") assert.equal((await events("complete")).length, 0);
    }
  });

  it("converts profile imperial height and unit toggles, clears measurements and saves before rebuilding", async () => {
    await open({ route: "profile", profile: { ...savedProfile, onboardedAt: "done" } });
    await page.getByLabel("Height (in)", { exact: true }).waitFor();
    await page.waitForFunction(() => document.getElementById("profile-height").value === "70");
    await page.getByRole("button", { name: "metric", exact: true }).click();
    assert.equal(await page.getByLabel("Height (cm)", { exact: true }).inputValue(), "177.8");
    assert.equal(await page.getByLabel("Bodyweight (kg)", { exact: true }).inputValue(), "100");
    await page.getByRole("button", { name: "imperial", exact: true }).click();
    assert.equal(await page.getByLabel("Height (in)", { exact: true }).inputValue(), "70");
    await page.getByLabel("Height (in)", { exact: true }).fill("");
    await page.getByLabel("Bodyweight (lb)", { exact: true }).fill("");
    await page.getByLabel("Injuries", { exact: true }).fill("Updated injury");
    await page.getByRole("button", { name: "Save & rebuild plan", exact: true }).click();
    await page.waitForFunction(() => window.events.some((event) => event.type === "plan"));
    assert.equal((await events("save"))[0].data.heightCm, null);
    assert.equal((await events("save"))[0].data.weightKg, null);
    assert.equal((await events("plan"))[0].profile.injuries, "Updated injury");
    assert.deepEqual(await page.evaluate(() => window.events.map((e) => e.type).filter((type) => type !== "get-profile")), ["save", "plan"]);
  });
});
