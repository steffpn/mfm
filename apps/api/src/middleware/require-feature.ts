import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";

/**
 * Factory that returns a preHandler checking if the user's plan includes a feature.
 * Must be used after the authenticate middleware.
 *
 * If the user has an active/trialing subscription, checks their plan's features.
 * If not, falls back to the FREE plan for their role.
 *
 * Usage: fastify.get("/premium-route", { preHandler: requireFeature("artist.detailed_analytics") }, handler)
 */
export function requireFeature(
  featureKey: string,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.currentUser;
    if (!user) {
      reply.code(401).send({ error: "Authentication required" });
      return;
    }

    const hasFeature = await userHasFeature(user.id, user.role, featureKey);
    if (!hasFeature) {
      reply.code(403).send({
        error: "Premium feature",
        message: "Upgrade your plan to access this feature",
        featureKey,
      });
      return;
    }
  };
}

/**
 * Check if a user has access to a feature based on their subscription.
 * Useful for conditional logic in handlers (show limited vs full data).
 */
export async function userHasFeature(
  userId: number,
  userRole: string,
  featureKey: string,
): Promise<boolean> {
  // Check active subscription first
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ["active", "trialing"] },
    },
    include: {
      plan: {
        include: {
          features: {
            include: { feature: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (subscription) {
    return subscription.plan.features.some((pf) => pf.feature.key === featureKey);
  }

  // Fall back to free plan for role
  const freePlan = await prisma.plan.findFirst({
    where: { role: userRole, tier: "FREE", isActive: true },
    include: {
      features: {
        include: { feature: true },
      },
    },
  });

  if (!freePlan) return false;
  return freePlan.features.some((pf) => pf.feature.key === featureKey);
}

/**
 * Get all feature keys for the user's current plan.
 * Useful for sending the feature list to the client.
 */
export async function getUserFeatures(
  userId: number,
  userRole: string,
): Promise<string[]> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ["active", "trialing"] },
    },
    include: {
      plan: {
        include: {
          features: { include: { feature: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (subscription) {
    return subscription.plan.features.map((pf) => pf.feature.key);
  }

  const freePlan = await prisma.plan.findFirst({
    where: { role: userRole, tier: "FREE", isActive: true },
    include: {
      features: { include: { feature: true } },
    },
  });

  return freePlan?.features.map((pf) => pf.feature.key) || [];
}
