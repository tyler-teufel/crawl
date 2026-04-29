import { randomUUID } from 'node:crypto';

export interface Vote {
  id: string;
  userId: string;
  venueId: string;
  votedAt: string;
  createdAt: string;
}

export interface VoteRepository {
  findByUserAndDate(userId: string, date: string): Promise<Vote[]>;
  findByUserVenueDate(userId: string, venueId: string, date: string): Promise<Vote | null>;
  create(userId: string, venueId: string): Promise<Vote>;
  delete(userId: string, venueId: string): Promise<boolean>;
  resetByDate(date: string): Promise<number>;
  countByVenueAndDate(venueId: string, date: string): Promise<number>;
}

const today = () => new Date().toISOString().slice(0, 10);

export class InMemoryVoteRepository implements VoteRepository {
  private votes: Map<string, Vote> = new Map();

  async findByUserAndDate(userId: string, date: string): Promise<Vote[]> {
    return [...this.votes.values()].filter((v) => v.userId === userId && v.votedAt === date);
  }

  async findByUserVenueDate(userId: string, venueId: string, date: string): Promise<Vote | null> {
    return (
      [...this.votes.values()].find(
        (v) => v.userId === userId && v.venueId === venueId && v.votedAt === date
      ) ?? null
    );
  }

  async create(userId: string, venueId: string): Promise<Vote> {
    const vote: Vote = {
      id: randomUUID(),
      userId,
      venueId,
      votedAt: today(),
      createdAt: new Date().toISOString(),
    };
    this.votes.set(vote.id, vote);
    return vote;
  }

  async delete(userId: string, venueId: string): Promise<boolean> {
    const vote = [...this.votes.values()].find(
      (v) => v.userId === userId && v.venueId === venueId && v.votedAt === today()
    );
    if (!vote) return false;
    this.votes.delete(vote.id);
    return true;
  }

  async resetByDate(date: string): Promise<number> {
    let count = 0;
    for (const [id, vote] of this.votes) {
      if (vote.votedAt === date) {
        this.votes.delete(id);
        count++;
      }
    }
    return count;
  }

  async countByVenueAndDate(venueId: string, date: string): Promise<number> {
    return [...this.votes.values()].filter((v) => v.venueId === venueId && v.votedAt === date)
      .length;
  }
}
