import { z } from 'zod';

export const voteStateSchema = z.object({
  remainingVotes: z.number().int().min(0),
  maxVotes: z.number().int().positive(),
  votedVenueIds: z.array(z.string().uuid()),
  resetAt: z.string().datetime(),
});

export const castVoteBody = z.object({
  venueId: z.string().uuid(),
});

export const removeVoteParams = z.object({
  venueId: z.string().uuid(),
});

export type VoteState = z.infer<typeof voteStateSchema>;
export type CastVoteBody = z.infer<typeof castVoteBody>;
