// Feature flags: separate from Balance Config, take effect immediately (ticket 12).
import { z } from 'zod';

export const FeatureFlagsSchema = z.object({
  coop: z.boolean().default(true).describe('Co-op rooms enabled'),
  scoreSubmit: z.boolean().default(true).describe('Score submission enabled'),
  bloodMoon: z.boolean().default(true).describe('Blood Moon event enabled'),
  dragon: z.boolean().default(true).describe('Inferno Dragon enabled'),
  rival: z.boolean().default(true).describe('Shadow Rival enabled'),
  maintenance: z.boolean().default(false).describe('Maintenance mode: online features paused'),
  minClientBuild: z.number().int().min(0).default(0).describe('Clients older than this build must reload'),
});
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
export const DEFAULT_FLAGS: FeatureFlags = FeatureFlagsSchema.parse({});
