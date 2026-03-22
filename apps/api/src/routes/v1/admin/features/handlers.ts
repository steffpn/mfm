import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../../../lib/prisma.js";
import type { FeatureParams, FeatureBody } from "./schema.js";

/**
 * GET /admin/features - List all features with their plan associations.
 */
export async function listFeatures(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const features = await prisma.feature.findMany({
    include: { plans: { include: { plan: true } } },
    orderBy: { createdAt: "desc" },
  });

  return reply.send(
    features.map((f) => ({
      id: f.id,
      key: f.key,
      name: f.name,
      description: f.description,
      category: f.category,
      roles: f.roles,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      plans: f.plans.map((pf) => ({
        id: pf.plan.id,
        name: pf.plan.name,
        slug: pf.plan.slug,
      })),
    })),
  );
}

/**
 * POST /admin/features - Create a feature.
 */
export async function createFeature(
  request: FastifyRequest<{ Body: FeatureBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { key, name, description, category, roles } = request.body;

  const feature = await prisma.feature.create({
    data: { key, name, description, category, roles },
  });

  return reply.status(201).send({
    id: feature.id,
    key: feature.key,
    name: feature.name,
    description: feature.description,
    category: feature.category,
    roles: feature.roles,
    createdAt: feature.createdAt,
    updatedAt: feature.updatedAt,
  });
}

/**
 * PATCH /admin/features/:id - Update a feature.
 */
export async function updateFeature(
  request: FastifyRequest<{ Params: FeatureParams; Body: Partial<FeatureBody> }>,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params;

  const existing = await prisma.feature.findUnique({ where: { id } });
  if (!existing) {
    return reply.status(404).send({ error: "Feature not found" });
  }

  const feature = await prisma.feature.update({
    where: { id },
    data: request.body,
  });

  return reply.send({
    id: feature.id,
    key: feature.key,
    name: feature.name,
    description: feature.description,
    category: feature.category,
    roles: feature.roles,
    createdAt: feature.createdAt,
    updatedAt: feature.updatedAt,
  });
}

/**
 * DELETE /admin/features/:id - Delete a feature.
 */
export async function deleteFeature(
  request: FastifyRequest<{ Params: FeatureParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params;

  const existing = await prisma.feature.findUnique({ where: { id } });
  if (!existing) {
    return reply.status(404).send({ error: "Feature not found" });
  }

  await prisma.feature.delete({ where: { id } });

  return reply.status(204).send();
}
