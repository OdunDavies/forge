import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";

// Exercise the actual route components, React hooks, DOM and QueryClient.
// Only auth, server calls, analytics and router navigation are replaced.
const root = fileURLToPath(new URL("../", import.meta.url));
const validDraft = {
  step: 11,
  dream: "muscular",
  experience: "beginner",
  path: "guided",
  sex: "prefer-not-to-say",
  age: 25,
  units: "imperial",
  weight: 220.462,
  heightCm: 177.8,
  name: "Ada",
  location: "gym",
  days: [1, 3],
  minutes: 60,
  extraFocus: [],
  injuries: "Left shoulder",
};
const savedProfile = {
  userId: "account-a",
  handle: "ada",
  displayName: "Saved name",
  bio: "",
  sex: null,
  birthYear: 1990,
  heightCm: 177.8,
  weightKg: 100,
  units: "imperial",
  experience: "beginner",
  goal: "strength",
  daysPerWeek: 2,
  sessionMinutes: 60,
  equipment: ["dumbbell"],
  injuries: "Left shoulder",
  availableDays: [1, 3],
  focusMuscles: ["chest"],
  onboardedAt: null,
  baseline_lifts: { squat: 100 },
  personalRecords: {},
  sessionHistory: [],
  trainedDaysPerWeek: [],
  focusWeekHistory: [],
  tweaksApplied: [],
  sharedSessions: [],
  xp: 0,
  xpThisWeek: 0,
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
  "@/lib/auth/use-current-user": `export const useCurrentUserState = () => window.fixture.auth; export const useCurrentUser = () => window.fixture.auth.user;`,
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
      return {plan:window.fixture.nullPlan ? null : {id:42,title:'Starter',days:[]},source:'starter'};
    }
  `,
  "@/lib/api/sessions": `export const listMyHistory = async () => []; export const getPersonalRecords = async () => [];`,
  "@/lib/api/goal-scan": `export const compareBodyPhotos = async () => {throw new Error("Photo analysis unavailable");};`,
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
  await page.addInitScript(
    ({ options, savedProfile }) => {
      window.fixture = {
        auth: {
          user: { id: "account-a", displayName: "Ada", isDevFallback: false },
          isPending: false,
        },
        profile: null,
        defaultProfile: savedProfile,
        ...options,
      };
      for (const [key, value] of Object.entries(options.storage ?? {}))
        localStorage.setItem(key, value);
      if (options.draft)
        sessionStorage.setItem(
          "forge-onboarding-dream-v1:account-a",
          JSON.stringify(options.draft),
        );
    },
    { options, savedProfile },
  );
  await page.goto(`${server.resolvedUrls.local[0]}onboarding-test.html`, {
    waitUntil: "commit",
    timeout: 90000,
  });
  await page.waitForFunction(() => typeof window.renderRoute === "function");
}
async function events(type) {
  return page.evaluate((type) => window.events.filter((event) => event.type === type), type);
}
async function complete() {
  await page.getByRole("button", { name: "Use this program", exact: true }).click();
  await page.waitForFunction(() =>
    window.events.some((event) => event.type === "navigate" && event.to === "/today"),
  );
}

describe("Onboarding route regressions", { concurrency: false }, () => {
  before(async () => {
    server = await createServer({
      root,
      configFile: false,
      cacheDir: "node_modules/.vite-onboarding-tests",
      resolve: { alias: { "@": `${root.replaceAll("\\", "/")}src` } },
      optimizeDeps: {
        noDiscovery: true,
        include: [
          "react",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "react-dom/client",
          "@tanstack/react-query",
          "@radix-ui/react-slot",
          "@radix-ui/react-label",
          "class-variance-authority",
          "clsx",
          "tailwind-merge",
          "sonner",
        ],
      },
      server: { host: "127.0.0.1", port: 0, watch: null },
      plugins: [
        {
          name: "onboarding-regression-fixture",
          enforce: "pre",
          resolveId(id) {
            if (id === "virtual:onboarding-test") return `\0${id}`;
            const key = Object.keys(mocks).find(
              (key) =>
                key === id ||
                (key.startsWith("@/") &&
                  id.replaceAll("\\", "/") === `${root.replaceAll("\\", "/")}src/${key.slice(2)}`),
            );
            if (key) return `\0${key}`;
          },
          load(id) {
            if (id === "\0virtual:onboarding-test") return entry;
            return mocks[id.slice(1)];
          },
          configureServer(server) {
            server.middlewares.use((req, res, next) => {
              if (req.url !== "/onboarding-test.html") return next();
              res.setHeader("Content-Type", "text/html");
              res.end(
                '<link rel="icon" href="data:,"><div id="root"></div><script type="module" src="/@id/__x00__virtual:onboarding-test"></script>',
              );
            });
          },
        },
      ],
    });
    await server.listen();
    // Use an installed browser on Windows, with standard Playwright Chromium elsewhere.
    browser = await chromium.launch({
      headless: true,
      ...(process.platform === "win32" ? { channel: "msedge" } : {}),
    });
  });
  after(async () => {
    await browser?.close();
    await server?.close();
  });
  beforeEach(async () => {
    page = await browser.newPage();
    errors = [];
    page.setDefaultTimeout(60000);
    page.on("pageerror", (error) => errors.push(error.message));
  });
  afterEach(async () => {
    await page.close();
    assert.deepEqual(errors, [], "No React hook or browser runtime errors");
  });

  it("offers preset goals and optional photo comparison", async () => {
    await open();
    await page.getByRole("button", { name: "Build my plan", exact: true }).click();
    await page.getByRole("heading", { name: "What are you working toward?" }).waitFor();
    await page.getByRole("button", { name: "Use my photos", exact: true }).click();
    assert.equal(await page.locator("input[type=file]").count(), 2);
    assert.equal(
      await page.getByRole("button", { name: "Continue", exact: true }).isEnabled(),
      false,
    );
    await page.getByRole("button", { name: "Choose a goal", exact: true }).click();
    await page.getByRole("button", { name: /Muscular/ }).click();
    assert.equal(
      await page.getByRole("button", { name: "Continue", exact: true }).isEnabled(),
      true,
    );
  });

  it("saves the reviewed profile, builds a plan, then marks onboarding complete", async () => {
    await open({ draft: validDraft });
    await complete();
    const saved = (await events("save"))[0].data;
    assert.equal(saved.displayName, "Ada");
    assert.equal(saved.sex, null);
    assert.equal(saved.heightCm, 177.8);
    assert.ok(Math.abs(saved.weightKg - 100) < 0.001);
    assert.deepEqual(saved.availableDays, [1, 3]);
    assert.equal(saved.goal, "hypertrophy");
    const types = await page.evaluate(() => window.events.map((e) => e.type));
    assert.ok(types.indexOf("save") < types.indexOf("plan"));
    assert.ok(types.indexOf("plan") < types.indexOf("complete"));
    assert.equal(
      await page.evaluate(() => sessionStorage.getItem("forge-onboarding-dream-v1:account-a")),
      null,
    );
  });

  it("preserves the draft when plan generation fails and allows retry", async () => {
    await open({ draft: validDraft, planError: true });
    await page.getByRole("button", { name: "Use this program", exact: true }).click();
    await page.getByText("Plan failed", { exact: true }).waitFor();
    assert.equal((await events("complete")).length, 0);
    assert.equal((await events("navigate")).length, 0);
    assert.ok(
      await page.evaluate(() => sessionStorage.getItem("forge-onboarding-dream-v1:account-a")),
    );
    await page.evaluate(() => {
      window.fixture.planError = false;
    });
    await complete();
  });

  it("redirects signed-out visitors without requesting their profile", async () => {
    await open({ auth: { user: null, isPending: false } });
    await page.locator('[data-redirect="/login"]').waitFor();
    assert.equal((await events("get-profile")).length, 0);
  });

  it("shows profile errors with a retry action", async () => {
    await open({ profileError: true });
    await page.getByRole("alert").waitFor();
    assert.equal(await page.getByRole("button", { name: "Retry", exact: true }).count(), 1);
  });
  it("saves profile measurements before rebuilding and caches the plan itself", async () => {
    await open({ route: "profile", profile: savedProfile });
    await page.locator("#profile-height").waitFor();
    assert.equal(await page.locator("#profile-height").inputValue(), "70");
    await page.locator("#profile-name").fill("Updated athlete");
    await page.getByRole("button", { name: "Save & rebuild plan", exact: true }).click();
    await page.waitForFunction(() => window.qc.getQueryData(["plan"])?.id === 42);
    const saved = (await events("save"))[0].data;
    assert.equal(saved.displayName, "Updated athlete");
    assert.ok(Math.abs(saved.heightCm - 177.8) < 0.001);
    assert.ok(Math.abs(saved.weightKg - 100) < 0.001);
    assert.equal((await events("plan"))[0].profile.displayName, "Updated athlete");
  });
});
