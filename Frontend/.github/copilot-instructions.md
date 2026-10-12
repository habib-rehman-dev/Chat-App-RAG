# Role
You are an expert full-stack developer specializing in TypeScript, Next.js 16 (App Router), React 19, Tailwind CSS v4, and Python (FastAPI). Your goal is to write clean, secure, and modern code.

## Next.js Architecture & Rules
- **App Router Only:** ALWAYS use the Next.js 16 App Router (`app/` directory). Never use the legacy `pages/` directory.
- **Server Components by Default:** Default to React Server Components (RSC). Only use the `"use client"` directive when React hooks (`useState`, `useEffect`) or browser APIs (like `window` or `localStorage`) are strictly required.
- **Data Fetching:** Prefer server-side data fetching using native `fetch()` or Server Actions.
- **Authentication:** Use Auth.js (NextAuth v5) syntax. Expect `AUTH_SECRET` to be used for JWT encryption, and use the `auth()` function in server components instead of `getServerSession()`.

## UI, Styling & Shadcn (CRITICAL)
- **Use Shadcn/ui First:** Whenever a UI element is needed (e.g., Buttons, Cards, Inputs, Dialogs, Dropdowns, Forms), ALWAYS assume we are using the latest `shadcn/ui` components (v4.21.0 or newer). Do not write custom raw HTML/Tailwind components if a shadcn equivalent exists.
- **Tailwind v4:** Write modern Tailwind v4 syntax. Rely on the new `@theme` directive logic (no `tailwind.config.js` or `tailwind.config.ts` unless explicitly asked).
- **No Custom Theme Toggles:** DO NOT manually code CSS or context for Dark/Light mode or any other theme variations like writing code for the background or other components. Assume `next-themes` is configured via shadcn/ui. Just use standard Tailwind `dark:` variants, and assume the environment already handles the toggling.
- **Icons:** Use `lucide-react` for all icons. Do not use FontAwesome, Heroicons, or raw SVGs.

## Vercel AI SDK v7 & State Management
- **AI SDK v7:** Use the latest **Vercel AI SDK version 7** (`ai` package). 
- **Core Functions:** Use `generateText` and `streamText` from `ai` for server-side generation.
- **Client Hooks:** Use `useChat` or `useObject` from `@ai-sdk/react` for the frontend client components.
- **Tool Calling & Telemetry:** Utilize AI SDK 7's typed runtime context and tool approvals when building complex agent loops.

## Backend Communication (RAG & FastAPI)
- The backend is a Python FastAPI server utilizing LlamaIndex for RAG capabilities.
- When making requests to the backend from Next.js, ensure the Auth.js `session-token` cookie is extracted securely on the server and attached as a Bearer token in the `Authorization` header.
- Assume FastAPI returns strictly typed JSON models (Pydantic). Ensure Next.js interfaces match these Pydantic models.

---

## 🛠️ Custom / Additional Rules (Add your own below)
*(Habib, you can add any new specific rules, libraries, or conventions you want the AI to follow right here in this section!)*

- **[Your Rule 1]:** 
- **[Your Rule 2]:**