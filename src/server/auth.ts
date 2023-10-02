import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { type GetServerSidePropsContext } from "next";
import {
  getServerSession,
  type DefaultSession,
  type NextAuthOptions,
} from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import GitHubProvider from "next-auth/providers/github";

import { env } from "@/env.mjs";
import { db } from "@/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: DefaultSession["user"] & {
      id: string;
      // ...other properties
      // role: UserRole;
    };
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = {
  debug: true,
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
    // jwt: ({ token, account }) => {
    //   // console.log({ account, token });
    //   if (account?.accessToken) {
    //     token.accessToken = account.accessToken;
    //   }
    //   return token;
    // },
    // jwt: async (token, user, account, profile, isNewUser) => {
    //   // Add access_token to the token right after signin
    //   if (account?.accessToken) {
    //     token.accessToken = account.accessToken;
    //   }
    //   return token;
    // },
  },
  adapter: PrismaAdapter(db),
  providers: [
    {
      id: "simas-id",
      name: "SIMAS-ID",
      type: "oauth",
      version: "2.0",
      clientId: "simas-id-elian",
      clientSecret: "ZpBhWSxN4iP1x1nQjLH4jybWVexMVAqE",
      authorization: {
        url: "https://login-dev.simas-id.com/v2/oidc/authorize",
        params: {
          scope: "openid email profile",
          code_challenge: "NX8_pQ7wcPVSfNtiiQhLfZHasAfvPxGX5SpKXHsVq-g",
          code_challenge_method: "SHA256",
          response_type: "code",
        },
      },
      checks: ["pkce", "state"],
      // authorization: "https://github.com/login/oauth/authorize",
      token: {
        url: "https://api-dev.simas-id.com/v1/oidc/token",
        // params: {
        //   grant_type: "authorization_code",
        //   client_id: "simas-id-elian",
        //   code_verifier: "HHMbPYFqJzpFm9UbZtdhMZlrWTZ0u3276VEHF9GNz_0",
        //   redirect_uri: "http://localhost:3000/api/auth/callback/simas-id",
        // },
        async request(context) {
          const response = await fetch(
            "https://api-dev.simas-id.com/v1/oidc/token",
            {
              method: "POST",
              headers: {
                Accept: "application.json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                grant_type: "authorization_code",
                client_id: "simas-id-elian",
                code: context.params.code,
                code_verifier: "HHMbPYFqJzpFm9UbZtdhMZlrWTZ0u3276VEHF9GNz_0",
                redirect_uri:
                  "http://localhost:3000/api/auth/callback/simas-id",
              }),
            },
          );
          const { refresh_expires_in, ...body } = await response.json();
          return { tokens: body };
        },
      },
      // userinfo: "https://kapi.kakao.com/v2/user/me",
      profile(profile: { sub: string; preferred_username: string }) {
        return {
          id: profile.sub,
          name: profile.preferred_username,
          email: `${profile.preferred_username}@gmail.com`,
          image: "",
        };
      },
    },
    DiscordProvider({
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
    }),
    GitHubProvider({ clientId: "", clientSecret: "" }),
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
};

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = (ctx: {
  req: GetServerSidePropsContext["req"];
  res: GetServerSidePropsContext["res"];
}) => {
  return getServerSession(ctx.req, ctx.res, authOptions);
};
