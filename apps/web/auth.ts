import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    {
      id: "neon-auth",
      name: "Neon Auth",
      type: "oidc",
      issuer: process.env.NEON_AUTH_URL,
      // NextAuth requires clientId and clientSecret, fallback to dummy values if not provided
      clientId: process.env.NEON_AUTH_CLIENT_ID || "neon-client-id",
      clientSecret: process.env.NEON_AUTH_CLIENT_SECRET || "neon-client-secret",
      wellKnown: `${process.env.NEON_AUTH_URL}/.well-known/openid-configuration`,
      authorization: { params: { scope: "openid email profile" } },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name ?? profile.preferred_username,
          email: profile.email,
          image: profile.picture,
          username: profile.preferred_username,
        };
      },
    },
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).username = token.username;
      }
      return session;
    },
  },
});
