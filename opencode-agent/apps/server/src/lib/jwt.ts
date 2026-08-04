import { SignJWT, jwtVerify } from 'jose'
import { env } from '../env.js'

const secret = new TextEncoder().encode(env.jwt.secret)

export interface JwtPayload {
  sub: number // user id
  username: string
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ username: payload.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(payload.sub))
    .setIssuedAt()
    .setExpirationTime(env.jwt.expiresIn)
    .sign(secret)
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    const sub = Number(payload.sub)
    if (!Number.isFinite(sub)) return null
    return { sub, username: String(payload.username ?? '') }
  } catch {
    return null
  }
}
