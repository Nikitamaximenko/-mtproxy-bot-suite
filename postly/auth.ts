import NextAuth from "next-auth"
import Nodemailer from "next-auth/providers/nodemailer"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

function emailServer() {
  return {
    host: process.env.EMAIL_SERVER_HOST || "localhost",
    port: Number(process.env.EMAIL_SERVER_PORT) || 1025,
    auth: {
      user: process.env.EMAIL_SERVER_USER || "dev",
      pass: process.env.EMAIL_SERVER_PASSWORD || "dev",
    },
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  providers: [
    Nodemailer({
      server: emailServer(),
      from: process.env.EMAIL_FROM || "Postly <noreply@postly.local>",
      sendVerificationRequest: async ({ identifier, url }) => {
        if (process.env.NODE_ENV !== "production") {
          console.log("\n========================================")
          console.log("🔗 MAGIC LINK для", identifier)
          console.log(url)
          console.log("========================================\n")
          return
        }
        throw new Error("Email sending not configured for production yet")
      },
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
  },
  session: { strategy: "database" },
})
