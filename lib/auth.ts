import bcrypt from "bcryptjs";
import { turso } from "./turso";

export type UserRole = "admin" | "worker" | "client";

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: string;
}

const SALT_ROUNDS = 12;
const SESSION_DURATION_DAYS = 7;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  role: UserRole = "client"
): Promise<User> {
  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID().replace(/-/g, "");

  await turso.execute({
    sql: `INSERT INTO users (id, email, password_hash, first_name, last_name, role) 
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, email.toLowerCase(), passwordHash, firstName, lastName, role],
  });

  return {
    id,
    email: email.toLowerCase(),
    first_name: firstName,
    last_name: lastName,
    role,
    phone: null,
    created_at: new Date().toISOString(),
  };
}

export async function getUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
  const result = await turso.execute({
    sql: `SELECT id, email, password_hash, first_name, last_name, role, phone, created_at 
          FROM users WHERE email = ?`,
    args: [email.toLowerCase()],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    email: row.email as string,
    password_hash: row.password_hash as string,
    first_name: row.first_name as string,
    last_name: row.last_name as string,
    role: row.role as UserRole,
    phone: row.phone as string | null,
    created_at: row.created_at as string,
  };
}

export async function getUserById(id: string): Promise<User | null> {
  const result = await turso.execute({
    sql: `SELECT id, email, first_name, last_name, role, phone, created_at 
          FROM users WHERE id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    email: row.email as string,
    first_name: row.first_name as string,
    last_name: row.last_name as string,
    role: row.role as UserRole,
    phone: row.phone as string | null,
    created_at: row.created_at as string,
  };
}

export async function createSession(userId: string): Promise<Session> {
  const id = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await turso.execute({
    sql: `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
    args: [id, userId, expiresAt.toISOString()],
  });

  return {
    id,
    user_id: userId,
    expires_at: expiresAt.toISOString(),
  };
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const result = await turso.execute({
    sql: `SELECT id, user_id, expires_at FROM sessions 
          WHERE id = ? AND expires_at > datetime('now')`,
    args: [sessionId],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    expires_at: row.expires_at as string,
  };
}

export async function deleteSession(sessionId: string): Promise<void> {
  await turso.execute({
    sql: `DELETE FROM sessions WHERE id = ?`,
    args: [sessionId],
  });
}

export async function login(
  email: string,
  password: string
): Promise<{ user: User; session: Session } | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;

  const session = await createSession(user.id);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash: _omit, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, session };
}

