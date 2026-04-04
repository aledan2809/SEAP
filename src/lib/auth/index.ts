import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { prisma } from '@/lib/db';
import { compare } from 'bcryptjs';
import type { Provider } from 'next-auth/providers';
import { logAction, AuditActions } from '@/lib/audit-log';

// In-memory login attempt tracker for brute-force protection
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function checkLoginAttempt(email: string): { allowed: boolean; remainingMs?: number } {
  const entry = loginAttempts.get(email);
  if (!entry) return { allowed: true };

  const now = Date.now();
  if (entry.lockedUntil > now) {
    return { allowed: false, remainingMs: entry.lockedUntil - now };
  }

  // Reset if lockout expired
  if (now > entry.lockedUntil && entry.count >= MAX_ATTEMPTS) {
    loginAttempts.delete(email);
    return { allowed: true };
  }

  return { allowed: true };
}

function recordFailedLogin(email: string): void {
  const entry = loginAttempts.get(email) || { count: 0, lockedUntil: 0 };
  entry.count++;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
  loginAttempts.set(email, entry);
}

function clearLoginAttempts(email: string): void {
  loginAttempts.delete(email);
}

// Cleanup stale entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of loginAttempts.entries()) {
    if (now > entry.lockedUntil + LOCKOUT_DURATION_MS) {
      loginAttempts.delete(email);
    }
  }
}, 30 * 60 * 1000);

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

      const email = (credentials.email as string).toLowerCase();

      // Brute-force protection: check if account is locked
      const attemptCheck = checkLoginAttempt(email);
      if (!attemptCheck.allowed) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { email },
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
        recordFailedLogin(email);
        return null;
      }

      const isPasswordValid = await compare(
        credentials.password as string,
        user.password
      );

      if (!isPasswordValid) {
        recordFailedLogin(email);
        return null;
      }

      // Successful login — clear failed attempts
      clearLoginAttempts(email);

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
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours — tokens expire and require re-login
  },
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
    async signIn({ user }) {
      if (user?.email) {
        await logAction({
          userId: user.id,
          userEmail: user.email,
          action: AuditActions.LOGIN,
          resource: 'auth',
        });
      }
      return true;
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
