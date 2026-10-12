


import NextAuth from "next-auth";
import GitHubProvider from "next-auth/providers/github";
// in the next line import the google provider from next-auth/providers/google
import GoogleProvider from "next-auth/providers/google";







export const {handlers , signIn , signOut , auth} = NextAuth({
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_ID as string,
      clientSecret: process.env.GOOGLE_SECRET as string,
    }),
    ],session: {
    strategy: "jwt",
  },
  callbacks: {
    // 1. This runs when the user logs in
    async jwt({ token, account, user }) {
      if (account && user) {
        // Now it will look like: "github:304984153" or "google:10423..."
        token.sub = `${account.provider}:${account.providerAccountId}`; 
      }
      return token;
    },
    // 2. This makes sure the stable ID is available in the session
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub; 
      }
      return session;
    },
  },
})