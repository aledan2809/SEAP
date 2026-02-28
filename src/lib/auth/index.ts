import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { prisma } from '@/lib/db';
import { compare } from 'bcryptjs';
import type { Provider } from 'next-auth/providers';

// Local type definition for user with organization
interface UserWithOrg {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  password: string | null;
  activeOrganizationId: string | null;
  organizations: Array<{
    role: string;
    organizationId: string;
  }>;
}

// Build providers array conditionally
const providers: Provider[] = [
  Credentials({
    name: 'credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { email: credentials.email as string },
        include: {
          organizations: {
            select: {
              role: true,
              organizationId: true,
            },
          },
        },
      }) as UserWithOrg | null;

      if (!user || !user.password) {
        return null;
      }

      const isPasswordValid = await compare(
        credentials.password as string,
        user.password
      );

      if (!isPasswordValid) {
        return null;
      }

      // Get role from active organization or first organization
      const activeOrgLink = user.organizations.find(
        (o) => o.organizationId === user.activeOrganizationId
      ) || user.organizations[0];

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: activeOrgLink?.role || 'MEMBER',
        organizationId: user.activeOrganizationId,
      };
    },
  }),
];

// Add Google provider only if credentials are configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    newUser: '/register',
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role || 'MEMBER';
        token.organizationId = (user as { organizationId?: string | null }).organizationId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.organizationId = token.organizationId as string | null;
      }
      return session;
    },
  },
});

// Type augmentation for session
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
      organizationId: string | null;
    };
  }
}
